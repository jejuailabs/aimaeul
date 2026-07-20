'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, Sparkles, ImagePlus, X, Loader2, Camera, BookOpen, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  exifAddress: string | null
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

export function PhotosClient({ communityId, communityName, communities, photos: initialPhotos }: Props) {
  const [allPhotos, setAllPhotos] = useState<PhotoItem[]>(initialPhotos)
  const [cursor, setCursor] = useState<string | null>(initialPhotos.length >= 30 ? initialPhotos[initialPhotos.length - 1]?.id : null)
  const [hasMore, setHasMore] = useState(initialPhotos.length >= 30)
  const [loadingMore, setLoadingMore] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/photos/list?communityId=${communityId}&cursor=${cursor}&limit=30`)
      if (!res.ok) return
      const data = await res.json()
      setAllPhotos((prev) => [...prev, ...data.photos])
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [communityId, cursor, hasMore, loadingMore])

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const photos = allPhotos
  const [query, setQuery] = useState('')
  const [aiSearching, setAiSearching] = useState(false)
  const [aiResults, setAiResults] = useState<PhotoItem[] | null>(null)
  const [uploading, setUploading] = useState(false)

  // AI 스토리 생성 상태
  const [storyDialogOpen, setStoryDialogOpen] = useState(false)
  const [storyResultOpen, setStoryResultOpen] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [storyLoading, setStoryLoading] = useState(false)
  const [generatedStory, setGeneratedStory] = useState<string | null>(null)

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

  function togglePhotoSelection(id: string) {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 20) {
          toast.error('사진은 최대 20장까지 선택할 수 있어요.')
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  async function handleGenerateStory() {
    if (selectedPhotoIds.size === 0) {
      toast.error('사진을 1장 이상 선택해주세요.')
      return
    }
    setStoryLoading(true)
    try {
      const res = await fetch('/api/ai/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId,
          photoIds: Array.from(selectedPhotoIds),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '스토리 생성에 실패했어요.')
        return
      }
      setGeneratedStory(data.story)
      setStoryDialogOpen(false)
      setStoryResultOpen(true)
    } catch {
      toast.error('스토리 생성 중 오류가 발생했어요.')
    } finally {
      setStoryLoading(false)
    }
  }

  function openStoryDialog() {
    setSelectedPhotoIds(new Set())
    setGeneratedStory(null)
    setStoryDialogOpen(true)
  }

  const selectedPhotos = photos.filter((p) => selectedPhotoIds.has(p.id))

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

      {/* Upload + AI Story buttons */}
      <div className="mb-3 flex gap-2">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? '올리는 중...' : '사진 올리기'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </label>
        <Button
          onClick={openStoryDialog}
          variant="outline"
          className="shrink-0 rounded-2xl py-3 h-auto"
          disabled={photos.length === 0}
        >
          <Sparkles className="h-4 w-4" />
          AI 스토리 만들기
        </Button>
      </div>

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
                  location: p.exifAddress ?? null,
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

      {/* 무한 스크롤 로더 */}
      {hasMore && !aiResults && (
        <div ref={loaderRef} className="flex justify-center py-6">
          {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* 사진 선택 다이얼로그 */}
      <Dialog open={storyDialogOpen} onOpenChange={setStoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 스토리 만들기
            </DialogTitle>
            <DialogDescription>
              스토리에 포함할 사진을 선택해주세요 (최대 20장)
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 py-2">
              {photos.map((p) => {
                const selected = selectedPhotoIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePhotoSelection(p.id)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnailUrl}
                      alt={p.aiCaption || `${p.uploaderName}님의 사진`}
                      className={cn(
                        'h-full w-full object-cover transition-opacity',
                        selected && 'opacity-75'
                      )}
                    />
                    {selected && (
                      <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-1 pt-4">
                      <p className="truncate text-[10px] text-white">{p.uploaderName}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {selectedPhotoIds.size}장 선택됨
              {selectedPhotoIds.size > 0 && (
                <button
                  onClick={() => setSelectedPhotoIds(new Set())}
                  className="ml-2 text-xs text-primary hover:underline"
                >
                  초기화
                </button>
              )}
            </p>
            <Button
              onClick={handleGenerateStory}
              disabled={storyLoading || selectedPhotoIds.size === 0}
            >
              {storyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  스토리 생성
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 생성된 스토리 다이얼로그 */}
      <Dialog open={storyResultOpen} onOpenChange={setStoryResultOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {communityName}의 이야기
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {/* 선택된 사진 미리보기 */}
            {selectedPhotos.length > 0 && (
              <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2">
                {selectedPhotos.map((p) => (
                  <div key={p.id} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnailUrl}
                      alt={p.aiCaption || ''}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 스토리 본문 */}
            <div className="rounded-2xl bg-muted/50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {generatedStory}
              </p>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline">닫기</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (generatedStory) {
                  navigator.clipboard.writeText(generatedStory)
                  toast.success('스토리를 복사했어요.')
                }
              }}
            >
              복사하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
