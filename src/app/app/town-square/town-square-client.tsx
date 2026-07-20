'use client'

import { useEffect, useRef, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Loader2, Send } from 'lucide-react'
import { firestore } from '@/lib/firebase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
import { cn } from '@/lib/utils'
import { formatKoreanTime } from '@/lib/village'
import { toast } from 'sonner'

type CommunityRef = {
  id: string
  name: string
  communityType: string
  regionName: string
}

type TownMessage = {
  id: string
  authorUid: string
  authorName: string
  authorPhotoURL: string | null
  communityId: string
  communityName: string
  communityType: string
  regionName: string
  text: string
  createdAt: any
  pending?: boolean
}

export function TownSquareClient({
  uid,
  communities,
}: {
  uid: string
  communities: CommunityRef[]
}) {
  const [messages, setMessages] = useState<TownMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [speakingAs, setSpeakingAs] = useState(communities[0]?.id ?? '')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query(
      collection(firestore, 'townSquareMessages'),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TownMessage[]
        // 최신순으로 받아 화면에는 오래된 것부터 보여준다.
        setMessages(rows.reverse())
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return

    setSending(true)
    setText('')
    try {
      const res = await fetch('/api/town-square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, communityId: speakingAs }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '전송에 실패했어요.')
        setText(body) // 실패 시 입력 내용을 되돌려준다
      }
    } catch {
      toast.error('전송 중 오류가 발생했어요.')
      setText(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <p className="border-b border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        전국 마을 이웃들이 함께 쓰는 공간이에요. 마을과 이름이 함께 표시됩니다.
      </p>

      {/* 메시지 목록 */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            첫 인사를 남겨보세요!
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.authorUid === uid
            return (
              <div key={m.id} className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
                {!mine && (
                  <Avatar className="mt-5 h-8 w-8 shrink-0">
                    <AvatarImage src={m.authorPhotoURL || undefined} alt={m.authorName} />
                    <AvatarFallback className="bg-primary/20 text-xs font-semibold">
                      {m.authorName?.slice(0, 1) || '?'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
                  {/* 어느 마을 누구인지 항상 밝힌다 */}
                  <div
                    className={cn(
                      'mb-0.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground',
                      mine && 'flex-row-reverse'
                    )}
                  >
                    <span className="font-semibold text-foreground">{m.authorName}</span>
                    <CommunityBadge type={m.communityType} size="sm" />
                    <span className="truncate">{m.communityName}</span>
                  </div>
                  <div
                    className={cn(
                      'whitespace-pre-line break-words px-3 py-2 text-sm shadow-sm',
                      mine
                        ? 'bubble-me rounded-2xl rounded-br-md'
                        : 'bubble-other rounded-2xl rounded-bl-md'
                    )}
                  >
                    {m.text}
                  </div>
                  <span className={cn('mt-0.5 px-1 text-[10px] text-muted-foreground', mine && 'text-right')}>
                    {m.createdAt ? formatKoreanTime(m.createdAt) : '전송 중…'}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <form onSubmit={send} className="border-t border-border bg-background px-3 py-2">
        {communities.length > 1 && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 text-[11px] text-muted-foreground">이름 표시:</span>
            {communities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSpeakingAs(c.id)}
                className={cn(
                  'shrink-0 rounded-full border px-2 py-1 text-[11px] transition-colors',
                  c.id === speakingAs
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="전국 이웃들에게 인사해보세요"
            className="rounded-full"
            maxLength={1000}
          />
          <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
