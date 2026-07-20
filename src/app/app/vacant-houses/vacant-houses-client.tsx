'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2,
  Plus,
  X,
  Home,
  ListPlus,
  PenSquare,
  ImageIcon,
  MapPin,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatRent, relativeTime } from '@/lib/village'

type CommunityOption = {
  id: string
  name: string
  communityType: string
  regionName: string
}

type Listing = {
  id: string
  communityId: string
  posterId: string
  photos: string // JSON string array
  monthlyRent: number | null
  deposit: number | null
  description: string | null
  lat: number | null
  lng: number | null
  status: string
  createdAt: string
  updatedAt: string
  community?: CommunityOption
}

const HOUSE_STATUS = [
  { value: '게시중', label: '게시 중' },
  { value: '거래완료', label: '거래 완료' },
  { value: '게시중지', label: '게시 중지' },
] as const

const MAX_PHOTOS = 10

function parsePhotos(photosJson: string): string[] {
  try {
    const arr = JSON.parse(photosJson)
    if (Array.isArray(arr)) return arr.filter((p): p is string => typeof p === 'string')
  } catch {
    // ignore
  }
  return []
}

function statusBadgeClass(status: string) {
  switch (status) {
    case '게시중':
      return 'bg-primary/20 text-foreground border-primary/40'
    case '거래완료':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
    case '게시중지':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function VacantHousesClient({
  communities,
  userId,
}: {
  communities: CommunityOption[]
  userId: string
}) {
  const [tab, setTab] = useState<string>('public')
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Listing | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vacant-houses', { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data.listings)) setListings(data.listings)
    } catch {
      toast.error('매물을 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const publicListings = listings.filter((l) => l.status === '게시중')
  const myListings = listings.filter((l) => l.posterId === userId)

  return (
    <AppShell title="우리동네 빈집" back="/app/me">
      <div className="p-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="public">
              <Home className="h-3.5 w-3.5" /> 게시중
            </TabsTrigger>
            <TabsTrigger value="mine">
              <ListPlus className="h-3.5 w-3.5" /> 내 매물
            </TabsTrigger>
            <TabsTrigger value="new">
              <PenSquare className="h-3.5 w-3.5" /> 등록하기
            </TabsTrigger>
          </TabsList>

          {/* 게시중 탭 */}
          <TabsContent value="public" className="mt-4">
            {loading ? (
              <LoadingState />
            ) : publicListings.length === 0 ? (
              <EmptyState
                emoji="🏚"
                title="현재 게시 중인 빈집이 없어요"
                desc="첫 빈집을 등록해보세요."
                action={
                  <Button size="sm" className="rounded-full" onClick={() => setTab('new')}>
                    빈집 등록하기
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {publicListings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onClick={() => setSelected(l)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 내 매물 탭 */}
          <TabsContent value="mine" className="mt-4">
            {loading ? (
              <LoadingState />
            ) : myListings.length === 0 ? (
              <EmptyState
                emoji="📝"
                title="올린 매물이 없어요"
                desc="빈집을 등록해보세요."
                action={
                  <Button size="sm" className="rounded-full" onClick={() => setTab('new')}>
                    빈집 등록하기
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {myListings.map((l) => (
                  <MyListingRow
                    key={l.id}
                    listing={l}
                    onUpdated={(updated) => {
                      setListings((prev) =>
                        prev.map((x) => (x.id === updated.id ? updated : x))
                      )
                    }}
                    onView={() => setSelected(l)}
                  />
                ))}
              </ul>
            )}
          </TabsContent>

          {/* 등록하기 탭 */}
          <TabsContent value="new" className="mt-4">
            <NewListingForm
              communities={communities}
              onCreated={(listing) => {
                setListings((prev) => [listing, ...prev])
                setTab('mine')
                toast.success('빈집이 등록되었어요. 🏠')
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* 상세 다이얼로그 */}
      <ListingDetailDialog
        listing={selected}
        onClose={() => setSelected(null)}
      />
    </AppShell>
  )
}

/* ---------- Sub-components ---------- */

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
    </div>
  )
}

function EmptyState({
  emoji,
  title,
  desc,
  action,
}: {
  emoji: string
  title: string
  desc: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
      <div className="mb-2 text-4xl">{emoji}</div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function ListingCard({
  listing,
  onClick,
}: {
  listing: Listing
  onClick: () => void
}) {
  const photos = parsePhotos(listing.photos)
  const cover = photos[0]
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt="빈집 사진"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}
        <Badge
          variant="outline"
          className={cn('absolute left-2 top-2 border', statusBadgeClass(listing.status))}
        >
          {listing.status}
        </Badge>
        {photos.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur">
            <ImageIcon className="mr-0.5 inline h-3 w-3" /> {photos.length}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm font-bold text-foreground">
          {formatRent(listing.monthlyRent, listing.deposit)}
        </p>
        {listing.community && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {listing.community.regionName} · {listing.community.name}
          </p>
        )}
        {listing.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {listing.description}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {relativeTime(listing.createdAt)}
        </p>
      </div>
    </button>
  )
}

function MyListingRow({
  listing,
  onUpdated,
  onView,
}: {
  listing: Listing
  onUpdated: (updated: Listing) => void
  onView: () => void
}) {
  const [updating, setUpdating] = useState(false)
  const photos = parsePhotos(listing.photos)

  async function changeStatus(next: string) {
    if (next === listing.status) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/vacant-houses/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '상태 변경 실패')
        return
      }
      onUpdated(data.listing)
      toast.success(`상태가 ${next}로 변경되었어요.`)
    } catch {
      toast.error('상태 변경 중 오류가 발생했어요.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex gap-3 p-3">
        <button
          type="button"
          onClick={onView}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
          aria-label="상세 보기"
        >
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0]} alt="빈집" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold">
              {formatRent(listing.monthlyRent, listing.deposit)}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {relativeTime(listing.createdAt)}
            </span>
          </div>
          {listing.community && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {listing.community.regionName} · {listing.community.name}
            </p>
          )}
          {listing.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {listing.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Select
              value={listing.status}
              onValueChange={changeStatus}
              disabled={updating}
            >
              <SelectTrigger size="sm" className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUSE_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </div>
    </li>
  )
}

function NewListingForm({
  communities,
  onCreated,
}: {
  communities: CommunityOption[]
  onCreated: (listing: Listing) => void
}) {
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? '')
  const [photos, setPhotos] = useState<string[]>([])
  const [monthlyRent, setMonthlyRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [description, setDescription] = useState('')
  const [negotiable, setNegotiable] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (!communityId) {
      toast.error('마을을 먼저 선택해주세요.')
      e.target.value = ''
      return
    }
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 가능합니다.`)
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!communityId) {
      toast.error('마을을 선택해주세요.')
      return
    }
    if (photos.length === 0) {
      toast.error('사진을 최소 1장 업로드해주세요.')
      return
    }
    if (!negotiable) {
      if (!monthlyRent && !deposit) {
        toast.error('월세 또는 보증금을 입력하거나 "가격 협의"를 선택해주세요.')
        return
      }
    }

    const rentNum = negotiable ? null : monthlyRent ? Number(monthlyRent) : null
    const depositNum = negotiable ? null : deposit ? Number(deposit) : null

    if (!negotiable) {
      if (rentNum !== null && (Number.isNaN(rentNum) || rentNum < 0)) {
        toast.error('월세는 숫자로 입력해주세요.')
        return
      }
      if (depositNum !== null && (Number.isNaN(depositNum) || depositNum < 0)) {
        toast.error('보증금은 숫자로 입력해주세요.')
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/vacant-houses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId,
          photos,
          monthlyRent: rentNum,
          deposit: depositNum,
          description: description.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '등록 실패')
        return
      }
      // 폼 초기화
      setPhotos([])
      setMonthlyRent('')
      setDeposit('')
      setDescription('')
      setNegotiable(false)
      onCreated(data.listing)
    } catch {
      toast.error('등록 중 오류가 발생했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 마을 선택 */}
      {communities.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="vh-community">마을 선택</Label>
          <Select value={communityId} onValueChange={setCommunityId}>
            <SelectTrigger id="vh-community" className="w-full">
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

      {/* 사진 업로드 */}
      <div className="space-y-1.5">
        <Label>사진 ({photos.length}/{MAX_PHOTOS})</Label>
        <div className="flex flex-wrap gap-2">
          {photos.map((url, idx) => (
            <div
              key={url}
              className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`빈집 ${idx + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="사진 제거"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !communityId}
              className={cn(
                'flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                (uploading || !communityId) && 'cursor-not-allowed opacity-60'
              )}
              aria-label="사진 추가"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">추가</span>
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
          첫 번째 사진이 썸네일로 표시돼요. (최대 {MAX_PHOTOS}장)
        </p>
      </div>

      {/* 가격 */}
      <div className="space-y-2">
        <Label>임대 조건</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="보증금 (만원)"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              disabled={negotiable}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="월세 (만원)"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              disabled={negotiable}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="negotiable"
            checked={negotiable}
            onCheckedChange={(v) => setNegotiable(Boolean(v))}
          />
          <Label htmlFor="negotiable" className="cursor-pointer text-xs text-muted-foreground">
            가격 협의 (임대료 입력 생략)
          </Label>
        </div>
      </div>

      {/* 설명 */}
      <div className="space-y-1.5">
        <Label htmlFor="vh-desc">설명</Label>
        <Textarea
          id="vh-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 2층 단독주택, 마당 있음, 도보 5분 거리 마트. 도배/장판 가능."
          maxLength={2000}
          className="min-h-24 resize-none"
        />
        <div className="flex justify-end text-[11px] text-muted-foreground">
          {description.length}/2000
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full rounded-xl"
        disabled={submitting || uploading || photos.length === 0}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 등록 중…
          </>
        ) : (
          <>
            <Home className="h-4 w-4" /> 빈집 등록하기
          </>
        )}
      </Button>
    </form>
  )
}

function ListingDetailDialog({
  listing,
  onClose,
}: {
  listing: Listing | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!listing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg">
        {listing && (
          <ListingDetailBody key={listing.id} listing={listing} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ListingDetailBody({ listing }: { listing: Listing }) {
  const [activePhoto, setActivePhoto] = useState(0)
  const photos = parsePhotos(listing.photos)

  return (
    <>
      <DialogHeader className="px-4 pt-4">
        <DialogTitle className="text-base">빈집 상세</DialogTitle>
        <DialogDescription className="sr-only">
          {listing.community?.name} 빈집 상세 정보
        </DialogDescription>
      </DialogHeader>

      <div className="px-4 pb-4">
        {/* 메인 사진 */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
          {photos[activePhoto] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[activePhoto]}
              alt="빈집 사진"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          {photos.length > 1 && (
            <>
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur">
                {activePhoto + 1} / {photos.length}
              </span>
              <div className="absolute inset-x-0 bottom-0 flex gap-1 overflow-x-auto bg-gradient-to-t from-black/50 to-transparent p-2">
                {photos.map((p, i) => (
                  <button
                    key={p + i}
                    type="button"
                    onClick={() => setActivePhoto(i)}
                    className={cn(
                      'h-12 w-12 shrink-0 overflow-hidden rounded-md border-2',
                      i === activePhoto ? 'border-primary' : 'border-transparent opacity-70'
                    )}
                    aria-label={`사진 ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-bold">
              {formatRent(listing.monthlyRent, listing.deposit)}
            </p>
            <Badge
              variant="outline"
              className={cn('border', statusBadgeClass(listing.status))}
            >
              {listing.status}
            </Badge>
          </div>
          {listing.community && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {listing.community.regionName} · {listing.community.name}
            </p>
          )}
          {listing.description && (
            <p className="whitespace-pre-wrap break-words text-sm">
              {listing.description}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            등록 {relativeTime(listing.createdAt)}
          </p>

          <Button asChild className="mt-2 w-full rounded-xl">
            <Link
              href={`/login?callbackUrl=/app/chat/${listing.communityId}`}
            >
              <MessageCircle className="h-4 w-4" /> 채팅으로 문의하기
            </Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            로그인한 회원만 마을 채팅에 참여할 수 있어요.
          </p>
        </div>
      </div>
    </>
  )
}
