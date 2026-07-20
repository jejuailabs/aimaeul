'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Sparkles, ImagePlus, X, Loader2, Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PhotoWithExif } from '@/components/exif-overlay'
import { relativeTime } from '@/lib/village'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type PhotoItem = {
  id: string
  storageUrl: string
  thumbnailUrl: string
  uploaderName: string
  exifTakenAt: string | null
  exifLat: number | null
  exifLng: number | null
  exifDevice: string | null
  exifLens: string | null
  aiTags: string[]
  aiCaption: string | null
  createdAt: string
}

type Props = {
  communityId: string
  communityName: string
  communities: { id: string; name: string; communityType: string }[]
  photos: PhotoItem[]
}

export function PhotosClient({ communityId, communityName, communities, photos }: Props) {
  const [query, setQuery] = useState('')
  const [aiSearching, setAiSearching] = useState(false)
  const [aiResults, setAiResults] = useState<PhotoItem[] | null>(null)
  const [uploading, setUploading] = useState(false)

  // 로컬 키워드 필터 (AI 검색 전 폴백)
  const filtered = useMemo(() => {
    if (aiResults) return aiResults
    const q = query.trim().toLowerCase()
    if (!q) return photos
    return photos.filter((p) => {
      const hay = [
        p.uploaderName,
        p.aiCaption,
        p.exifDevice,
        ...(p.aiTags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [photos, query, aiResults])

  async function handleAiSearch() {
    const q = query.trim()
    if (!q) return
    setAiSearching(true)
    setAiResults(null)
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId, query: q }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'AI 검색 실패')
        setAiSearching(false)
        return
      }
      const data = await res.json()
      setAiResults(data.photos as PhotoItem[])
      toast.success(`${data.photos.length}장 찾았어요 ✨`)
    } catch {
      toast.error('AI 검색 중 오류')
    } finally {
      setAiSearching(false)
    }
  }

  function clearAi() {
    setAiResults(null)
    setQuery('')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('communityId', communityId)
        fd.append('broadcast', 'true')
        await fetch('/api/photos/upload', { method: 'POST', body: fd })
      }
      toast.success('사진을 올렸어요 📷')
      window.location.reload()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="px-3 py-3">
      {/* Community switcher */}
      {communities.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {communities.map((c) => {
            const active = c.id === communityId
            return (
              <Link
                key={c.id}
                href={`/app/photos?c=${c.id}`}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                )}
              >
                {c.name}
              </Link>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAiResults(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
            placeholder="감자캐기 사진, 작년 김장, 벚꽃..."
            className="rounded-full pl-9"
          />
          {aiResults && (
            <button
              onClick={clearAi}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleAiSearch}
          disabled={aiSearching || !query.trim()}
          size="sm"
          className="rounded-full"
        >
          {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-1 hidden sm:inline">AI검색</span>
        </Button>
      </div>

      {aiResults && (
        <p className="mb-2 px-1 text-xs text-muted-foreground">
          AI 검색 결과 "{query}" — {aiResults.length}장
        </p>
      )}

      {/* Upload button */}
      <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {uploading ? '올리는 중...' : '사진 올리기 (채팅방에도 자동 공유)'}
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </label>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Camera className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {query ? '검색된 사진이 없어요.' : '아직 사진이 없어요.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="space-y-1">
              <PhotoWithExif
                src={p.thumbnailUrl}
                alt={p.aiCaption || `${p.uploaderName}님의 사진`}
                exif={{
                  takenAt: p.exifTakenAt,
                  lat: p.exifLat,
                  lng: p.exifLng,
                  device: p.exifDevice,
                  lens: p.exifLens,
                }}
                className="aspect-square"
              />
              <div className="px-1">
                <p className="truncate text-[11px] font-medium">{p.uploaderName}</p>
                <p className="text-[10px] text-muted-foreground">{relativeTime(p.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
