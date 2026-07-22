'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Loader2, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 하단 탭.
 *
 * 어르신이 가장 많이 쓰는 동작은 "채팅 들어가기" 하나다.
 * 그래서 채팅을 정중앙에 크게 두고 나머지는 양옆 보조로 둔다.
 *
 * - 사진: 마을홈 피드로 합쳐 별도 메뉴를 없앴다.
 * - 일기장: 채팅 입력창(이모티콘 옆)에서 바로 연다.
 * - 게임: 회장·관리자가 채팅방에서 시작하므로 회원 메뉴에 없다.
 */
const SIDE_TABS = {
  left: { href: '/app/home', label: '마을홈', icon: Home },
  right: { href: '/app/me', label: '내정보', icon: User },
} as const

function TabIcon({
  Icon,
  className,
}: {
  Icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const { pending } = useLinkStatus()
  if (pending) return <Loader2 className={cn(className, 'animate-spin')} />
  return <Icon className={className} />
}

/** 카카오톡 말풍선 느낌의 채팅 아이콘 */
function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 3C6.9 3 2.75 6.3 2.75 10.37c0 2.6 1.72 4.88 4.31 6.19-.19.69-.69 2.5-.79 2.89-.12.48.18.47.37.34.15-.1 2.4-1.63 3.37-2.29.65.09 1.31.14 1.99.14 5.1 0 9.25-3.3 9.25-7.37S17.1 3 12 3Z" />
    </svg>
  )
}

function ChatCenterIcon() {
  const { pending } = useLinkStatus()
  if (pending) return <Loader2 className="h-7 w-7 animate-spin text-primary-foreground" />
  return <ChatBubbleIcon className="h-7 w-7 text-primary-foreground" />
}

export function BottomTabBar() {
  const pathname = usePathname()
  const chatActive = pathname?.startsWith('/app/chat')

  // 사이드 탭의 활성 표시는 "색 + 굵기"로만 한다.
  // 노란 배경을 주면 중앙 채팅의 노란 원과 겹쳐, 뭐가 현재 화면인지 헷갈린다.
  const sideTab = (tab: (typeof SIDE_TABS)[keyof typeof SIDE_TABS]) => {
    const active = pathname === tab.href || pathname?.startsWith(tab.href)
    return (
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {/* 현재 화면 표시는 상단 짧은 바로 */}
        {active && (
          <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
        )}
        <TabIcon Icon={tab.icon} className="h-6 w-6" />
        <span className={cn(active && 'font-bold')}>{tab.label}</span>
      </Link>
    )
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-safe"
      aria-label="하단 탭"
    >
      <div className="mx-auto flex max-w-2xl items-end justify-around px-2">
        {sideTab(SIDE_TABS.left)}

        {/* 정중앙 채팅 — 가장 많이 누르는 곳이라 크게 띄운다.
            현재 채팅 화면이면 링을 둘러 "여기 있음"을 표시한다. */}
        <Link
          href="/app/chat"
          aria-label="채팅"
          aria-current={chatActive ? 'page' : undefined}
          className="relative flex flex-1 flex-col items-center justify-end gap-0.5 py-1.5"
        >
          <div
            className={cn(
              'flex h-14 w-14 -translate-y-2 items-center justify-center rounded-full bg-primary shadow-lg transition-transform active:scale-95',
              chatActive && 'ring-4 ring-primary/30'
            )}
          >
            <ChatCenterIcon />
          </div>
          <span
            className={cn(
              '-mt-1 text-[12px]',
              chatActive ? 'font-bold text-primary' : 'font-semibold text-muted-foreground'
            )}
          >
            채팅
          </span>
        </Link>

        {sideTab(SIDE_TABS.right)}
      </div>
    </nav>
  )
}
