'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, X, ImageIcon, Megaphone, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CommunityBadge } from '@/components/community-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/village'

type CommunityOption = {
  id: string
  name: string
  communityType: string
  regionName: string
}

type ReportItem = {
  id: string
  communityId: string
  description: string
  photoUrl: string | null
  status: string
  createdAt: string
  community?: CommunityOption
}

const MAX_PHOTOS = 3

// 상태별 색상 — Kakao 톤 유지, indigo/blue 금지
function statusBadgeClass(status: string) {
  switch (status) {
    case '접수':
      return 'bg-primary/20 text-foreground border-primary/40'
    case '안전신문고 전달완료':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
    case '처리중':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
    case '종료':
      return 'bg-muted text-muted-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function ReportClient({
  communities,
  userName,
}: {
  communities: CommunityOption[]
  userName?: string
}) {
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    setLoadingReports(true)
    fetch('/api/reports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data.reports)) setReports(data.reports)
      })
      .catch(() => {
        if (!cancelled) toast.error('제보 내역을 불러오지 못했어요.')
      })
      .finally(() => {
        if (!cancelled) setLoadingReports(false)
      })
    return () => {
      cancelled = true
    }
  }, [communityId])

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`)
      e.target.value = ''
      return
    }
    const remaining = MAX_PHOTOS - photos.length
    const list = Array.from(files).slice(0, remaining)

    setUploading(true)
    try {
      for (const file of list) {
        const form = new FormData()
        form.append('file', file)
        form.append('communityId', communityId)
        form.append('broadcast', 'false')
        const res = await fetch('/api/photos/upload', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || '사진 업로드 실패')
          continue
        }
        setPhotos((prev) => [...prev, data.photo.storageUrl])
      }
    } catch {
      toast.error('사진 업로드 중 오류가 발생했어요.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!communityId) {
      toast.error('마을을 선택해주세요.')
      return
    }
    if (!description.trim()) {
      toast.error('상황 설명을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId,
          description: description.trim(),
          photoUrl: photos[0] ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '제보 등록에 실패했어요.')
        return
      }
      toast.success('제보가 접수되었어요. 📋')
      // 폼 초기화
      setDescription('')
      setPhotos([])
      // 목록 새로고침
      const listRes = await fetch('/api/reports', { cache: 'no-store' })
      const listData = await listRes.json()
      if (Array.isArray(listData.reports)) setReports(listData.reports)
    } catch {
      toast.error('제보 등록 중 오류가 발생했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="제보하기" back="/app/me">
      <div className="space-y-6 p-4">
        {/* 안내 배너 */}
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-xs text-foreground/80">
          <p className="font-semibold">💡 제보 안내</p>
          <p className="mt-1 leading-relaxed">
            마을의 불편사항이나 위험 요소를 사진과 함께 남겨주세요. 운영자가 확인 후 안전신문고로 전달드려요. 제보 내용은 비공개로 처리됩니다.
          </p>
        </div>

        {/* 제보 폼 */}
        <form onSubmit={submitReport} className="space-y-4">
          {communities.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="community-select">마을 선택</Label>
              <Select value={communityId} onValueChange={setCommunityId}>
                <SelectTrigger id="community-select" className="w-full">
                  <SelectValue placeholder="마을 선택" />
                </SelectTrigger>
                <SelectContent>
                  {communities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.regionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 사진 첨부 */}
          <div className="space-y-1.5">
            <Label>사진 첨부 ({photos.length}/{MAX_PHOTOS})</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, idx) => (
                <div
                  key={url}
                  className="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`제보 사진 ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="사진 제거"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !communityId}
                  className={cn(
                    'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    (uploading || !communityId) && 'cursor-not-allowed opacity-60'
                  )}
                  aria-label="사진 추가"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span className="text-[10px]">사진 추가</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <p className="text-[11px] text-muted-foreground">
              사진의 EXIF(촬영일·위치) 정보가 자동으로 함께 저장돼요.
            </p>
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <Label htmlFor="description">상황 설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 교차로 신호등이 고장나서 위험해요."
              maxLength={1000}
              className="min-h-24 resize-none"
            />
            <div className="flex justify-end text-[11px] text-muted-foreground">
              {description.length}/1000
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl"
            disabled={submitting || uploading || !description.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 접수 중…
              </>
            ) : (
              <>
                <Megaphone className="h-4 w-4" /> 제보하기
              </>
            )}
          </Button>
        </form>

        {/* 내 제보 내역 */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">내 제보 내역</h2>
            {reports.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {reports.length}
              </span>
            )}
          </div>

          {loadingReports ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              아직 올린 제보가 없어요.
            </div>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="flex gap-3 p-3">
                    {r.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photoUrl}
                        alt="제보 사진"
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn('border', statusBadgeClass(r.status))}
                        >
                          {r.status}
                        </Badge>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {relativeTime(r.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-sm">
                        {r.description}
                      </p>
                      {r.community && (
                        <div className="mt-2">
                          <CommunityBadge type={r.community.communityType} size="sm" />
                          <span className="ml-1.5 align-middle text-[11px] text-muted-foreground">
                            {r.community.name} · {r.community.regionName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {userName && reports.length > 0 && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              {userName}님의 제보는 운영자만 확인할 수 있어요.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
