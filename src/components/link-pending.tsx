'use client'

import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 링크가 눌린 직후 "지금 이동 중"임을 즉시 보여주는 표시.
 *
 * 반드시 <Link> 안에 렌더링해야 한다. useLinkStatus가 해당 Link의
 * 전환 상태를 읽기 때문이다.
 *
 * 이게 없으면 서버 응답을 기다리는 동안 아무 변화가 없어
 * 안 눌린 것으로 느껴지고 사용자가 계속 다시 누르게 된다.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <Loader2
      className={cn('h-3.5 w-3.5 shrink-0 animate-spin text-current', className)}
      aria-label="이동 중"
    />
  )
}

/**
 * 링크 전체를 흐리게 만들어 눌렸음을 알리는 래퍼.
 * 아이콘을 넣을 자리가 없는 카드형 링크에 쓴다.
 */
export function LinkPendingOverlay() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/60">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </span>
  )
}
