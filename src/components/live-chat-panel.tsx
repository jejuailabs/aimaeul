'use client'

import Link from 'next/link'
import { MessageCircle, Lock, Loader2 } from 'lucide-react'
import { useChatSocket, type ChatMessage } from '@/hooks/use-chat-socket'
import { MessageBubble } from '@/components/message-bubble'
import { Button } from '@/components/ui/button'
import type { Photo } from '@prisma/client'

type Props = {
  communityId: string
  initialMessages: ChatMessage[]
  photoMap: Map<string, Photo>
  communityName: string
  readOnly?: boolean
  loggedIn?: boolean
}

/**
 * 마을 홈페이지 Live Chat 영역 (05 문서).
 * 회원 채팅 앱과 동일 socket room 구독 → 실시간 반영.
 * 비회원(readOnly)은 읽기 전용.
 */
export function LiveChatPanel({
  communityId,
  initialMessages,
  photoMap,
  communityName,
  readOnly = true,
  loggedIn = false,
}: Props) {
  const { messages, online } = useChatSocket(communityId, initialMessages, 30)
  const recent = messages.slice(-30)

  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            <MessageCircle className="h-4 w-4 text-primary" />
            마을 광장 (Live Chat)
          </h2>
          <p className="text-xs text-muted-foreground">
            {online > 0 ? `${online}명 접속 중 · ` : ''}최근 대화가 실시간으로 표시돼요
          </p>
        </div>
        {readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> 읽기 전용
          </span>
        )}
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl bg-muted/30 p-3">
        {recent.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            아직 대화가 없어요.
          </div>
        )}
        {recent.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={false}
            photo={m.photoId ? photoMap.get(m.photoId) || null : null}
            compact
          />
        ))}
      </div>

      {readOnly && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-primary/10 p-3">
          <p className="text-xs text-muted-foreground">
            대화에 참여하려면 로그인이 필요해요.
          </p>
          <Button asChild size="sm" className="rounded-full">
            <Link href={loggedIn ? `/app/chat/${communityId}` : `/login?callbackUrl=/app/chat/${communityId}`}>
              {loggedIn ? '채팅 앱으로' : '참여하기'}
            </Link>
          </Button>
        </div>
      )}
      {!readOnly && (
        <div className="mt-3">
          <Button asChild className="w-full rounded-full" size="sm">
            <Link href={`/app/chat/${communityId}`}>
              <MessageCircle className="mr-1 h-4 w-4" /> {communityName} 채팅방 열기
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}
