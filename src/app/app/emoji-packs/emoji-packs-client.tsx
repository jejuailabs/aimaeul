'use client'

import { useState, useEffect, useRef } from 'react'
import { ImagePlus, Loader2, Trash2, Plus, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type EmojiPack = {
  id: string
  name: string
  images: string[]
  isDefault?: boolean
  createdBy?: string
}

type Props = {
  communities: { id: string; name: string; communityType: string }[]
  userId: string
}

export function EmojiPacksClient({ communities, userId }: Props) {
  const [activeCommunity, setActiveCommunity] = useState(communities[0]?.id || '')
  const [packs, setPacks] = useState<EmojiPack[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [packName, setPackName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeCommunity) return
    setLoading(true)
    fetch(`/api/emoji-packs?communityId=${activeCommunity}`)
      .then((r) => r.json())
      .then((d) => setPacks(d.packs || []))
      .catch(() => setPacks([]))
      .finally(() => setLoading(false))
  }, [activeCommunity])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length + selected.length > 30) {
      toast.error('이모티콘은 최대 30개까지 업로드 가능합니다.')
      return
    }
    setFiles((prev) => [...prev, ...selected])
    const newPreviews = selected.map((f) => URL.createObjectURL(f))
    setPreviews((prev) => [...prev, ...newPreviews])
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index])
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    if (!packName.trim()) {
      toast.error('팩 이름을 입력해주세요.')
      return
    }
    if (files.length === 0) {
      toast.error('이모티콘 이미지를 선택해주세요.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('communityId', activeCommunity)
      fd.append('name', packName.trim())
      for (const f of files) fd.append('files', f)

      const res = await fetch('/api/emoji-packs', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '업로드에 실패했습니다.')
        return
      }
      const data = await res.json()
      setPacks((prev) => [...prev, data.pack])
      toast.success('이모티콘 팩이 등록되었습니다!')
      setCreateOpen(false)
      setPackName('')
      setFiles([])
      previews.forEach(URL.revokeObjectURL)
      setPreviews([])
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(packId: string) {
    try {
      const res = await fetch(`/api/emoji-packs/${packId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '삭제에 실패했습니다.')
        return
      }
      setPacks((prev) => prev.filter((p) => p.id !== packId))
      toast.success('이모티콘 팩이 삭제되었습니다.')
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="px-3 py-3">
      {/* 마을 선택 */}
      {communities.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {communities.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCommunity(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                c.id === activeCommunity
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      <Button
        onClick={() => setCreateOpen(true)}
        className="mb-4 w-full rounded-2xl"
        variant="outline"
      >
        <Plus className="mr-1 h-4 w-4" /> 새 이모티콘 팩 만들기
      </Button>

      {/* 팩 목록 */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : packs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Smile className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">등록된 이모티콘 팩이 없어요.</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG 이미지를 업로드해서 마을 전용 이모티콘을 만들어보세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => (
            <div key={pack.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{pack.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pack.isDefault ? '기본 제공' : `${pack.images.length}개`}
                  </p>
                </div>
                {!pack.isDefault && pack.createdBy === userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(pack.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pack.images.slice(0, 12).map((url, i) => (
                  <div key={i} className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-8 w-8 object-contain" />
                  </div>
                ))}
                {pack.images.length > 12 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
                    +{pack.images.length - 12}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 이모티콘 팩</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">팩 이름</label>
              <Input
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="예: 우리마을 이모티콘"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                이모티콘 이미지 (PNG, 투명 배경 권장)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
              >
                <ImagePlus className="h-4 w-4" />
                이미지 선택 ({files.length}/30)
              </button>
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={i} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-12 w-12 rounded-lg object-contain bg-muted/50" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {uploading ? '업로드 중...' : '등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
