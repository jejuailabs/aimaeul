'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { LinkPending } from '@/components/link-pending'

/**
 * 어디서나 채팅 화면으로 돌아가는 버튼.
 *
 * 어르신에게 익숙한 기본 화면은 카카오톡 형태의 채팅방이다.
 * 깊은 화면으로 들어갔다가 길을 잃지 않도록, 채팅 화면이 아닌 모든
 * 앱 화면에 항상 같은 자리(우측 하단)에 떠 있게 한다.
 */
export function BackToChatFab() {
  const pathname = usePathname()

  // 이미 채팅 화면이면 필요 없다.
  if (!pathname || pathname.startsWith('/app/chat')) return null

  return (
    <Link
      href="/app/chat"
      aria-label="채팅으로 돌아가기"
      className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform active:scale-95"
    >
      <LinkPending />
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-bold">채팅</span>
    </Link>
  )
}
