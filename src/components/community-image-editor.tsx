'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Kind = 'banner' | 'mascot'

/**
 * 마을 배너·마스코트 설정.
 *
 * 직접 올리거나 AI(OpenAI)로 만들 수 있고, 올리거나 만든 이미지는
 * 모두 갤러리에 쌓인다. 아래 썸네일에서 골라 언제든 바꿀 수 있다.
 */
export function CommunityImageEditor({
  communityId,
  kind,
  initialUrl,
  initialGallery,
}: {
  communityId: string
  kind: Kind
  initialUrl: string | null
  initialGallery: string[]
}) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [gallery, setGallery] = useState<string[]>(initialGallery)
  const [busy, setBusy] = useState<'upload' | 'generate' | 'delete' | 'select' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [setupHint, setSetupHint] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const label = kind === 'banner' ? '배너 이미지' : '마스코트'

  async function send(body: FormData, action: 'upload' | 'generate') {
    setBusy(action)
    setSetupHint(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/images`, {
        method: 'POST',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (d.needsSetup) setSetupHint(d.error)
        else toast.error(d.error || `${label}을 저장하지 못했어요.`)
        return
      }
      setUrl(d.url)
      // 새 이미지를 갤러리 맨 뒤에 추가(중복 방지)
      setGallery((prev) => (prev.includes(d.url) ? prev : [...prev, d.url]))
      toast.success(`${label}을 설정했어요.`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('kind', kind)
    fd.append('mode', 'upload')
    fd.append('file', file)
    send(fd, 'upload')
  }

  function generate() {
    const fd = new FormData()
    fd.append('kind', kind)
    fd.append('mode', 'generate')
    if (prompt.trim()) fd.append('prompt', prompt.trim())
    send(fd, 'generate')
  }

  // 갤러리에서 다른 이미지를 현재 것으로 고른다.
  async function select(target: string) {
    if (target === url) return
    setBusy('select')
    try {
      const res = await fetch(`/api/communities/${communityId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, url: target }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '바꾸지 못했어요.')
        return
      }
      setUrl(target)
      toast.success(`${label}을 바꿨어요.`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  // 현재 활성 이미지 해제 (갤러리는 유지)
  async function clearActive() {
    setBusy('delete')
    try {
      const res = await fetch(`/api/communities/${communityId}/images?kind=${kind}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error('해제하지 못했어요.')
        return
      }
      setUrl(null)
      toast.success(`${label}을 해제했어요.`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  // 갤러리에서 한 장을 완전히 삭제
  async function removeFromGallery(target: string) {
    setBusy('delete')
    try {
      const res = await fetch(
        `/api/communities/${communityId}/images?kind=${kind}&url=${encodeURIComponent(target)}`,
        { method: 'DELETE' }
      )
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || '삭제하지 못했어요.')
        return
      }
      setGallery((prev) => prev.filter((u) => u !== target))
      // 활성 이미지가 지워졌으면 서버가 대체값을 알려준다.
      if (url === target) setUrl(d.activeUrl ?? null)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">{label}</h3>
        {url && (
          <Button
            onClick={clearActive}
            disabled={busy !== null}
            variant="ghost"
            size="sm"
            className="h-7 rounded-full text-xs text-muted-foreground"
          >
            해제
          </Button>
        )}
      </div>

      {/* 현재 이미지 미리보기 */}
      <div
        className={cn(
          'mb-3 overflow-hidden rounded-xl bg-muted',
          kind === 'banner' ? 'aspect-video' : 'mx-auto aspect-square w-40'
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            아직 없어요
          </div>
        )}
      </div>

      {/* AI로 만들기 */}
      <div className="mb-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            kind === 'banner'
              ? '예: 노을 지는 감귤밭 (비워두면 마을 정보로 자동 생성)'
              : '예: 감귤을 든 귀여운 캐릭터 (비워두면 자동 생성)'
          }
          className="rounded-xl text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={generate} disabled={busy !== null} className="flex-1 rounded-xl">
          {busy === 'generate' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          AI로 만들기
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={upload}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          variant="outline"
          className="flex-1 rounded-xl"
        >
          {busy === 'upload' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-1 h-4 w-4" />
          )}
          직접 올리기
        </Button>
      </div>

      {/* 갤러리 — 이전에 올리거나 만든 이미지들. 눌러서 바꾼다. */}
      {gallery.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">
            만든 이미지 ({gallery.length}) · 눌러서 바꿀 수 있어요
          </p>
          <div className="flex flex-wrap gap-2">
            {gallery.map((g) => {
              const active = g === url
              return (
                <div key={g} className="group relative">
                  <button
                    type="button"
                    onClick={() => select(g)}
                    disabled={busy !== null}
                    className={cn(
                      'relative overflow-hidden rounded-lg border-2 transition-colors',
                      kind === 'banner' ? 'h-14 w-24' : 'h-16 w-16',
                      active ? 'border-primary' : 'border-transparent hover:border-border'
                    )}
                    aria-label={active ? '현재 이미지' : '이 이미지로 바꾸기'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g} alt="" className="h-full w-full object-cover" />
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                        <Check className="h-5 w-5 text-white drop-shadow" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromGallery(g)}
                    disabled={busy !== null}
                    aria-label="이 이미지 삭제"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {setupHint && (
        <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {setupHint}
          <br />
          그전까지는 &ldquo;직접 올리기&rdquo;로 설정할 수 있어요.
        </p>
      )}
    </div>
  )
}
