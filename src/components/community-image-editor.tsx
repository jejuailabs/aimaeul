'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Kind = 'banner' | 'mascot'

/**
 * 마을 배너·마스코트 설정.
 *
 * 직접 올리거나 AI로 만들 수 있다.
 * AI 생성은 Vertex AI를 쓰는데, 프로젝트에서 켜져 있지 않으면
 * 무엇을 해야 하는지 그대로 안내한다.
 */
export function CommunityImageEditor({
  communityId,
  kind,
  initialUrl,
}: {
  communityId: string
  kind: Kind
  initialUrl: string | null
}) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [busy, setBusy] = useState<'upload' | 'generate' | 'delete' | null>(null)
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

  async function remove() {
    setBusy('delete')
    try {
      const res = await fetch(
        `/api/communities/${communityId}/images?kind=${kind}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        toast.error('삭제하지 못했어요.')
        return
      }
      setUrl(null)
      toast.success(`${label}을 지웠어요.`)
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
            onClick={remove}
            disabled={busy !== null}
            variant="ghost"
            size="icon"
            aria-label={`${label} 삭제`}
            className="h-8 w-8 rounded-full text-destructive"
          >
            {busy === 'delete' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* 미리보기 */}
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
        <Button
          onClick={generate}
          disabled={busy !== null}
          className="flex-1 rounded-xl"
        >
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
