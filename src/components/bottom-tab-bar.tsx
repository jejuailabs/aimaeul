'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Home, Image, Gamepad2, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/app/chat', label: '채팅', icon: MessageCircle },
  { href: '/app/home', label: '마을홈', icon: Home },
  { href: '/app/photos', label: '사진', icon: Image },
  { href: '/app/games', label: '게임', icon: Gamepad2 },
  { href: '/app/me', label: '내정보', icon: User },
] as const

/** 이동 중이면 아이콘 대신 스피너를 보여준다. Link 안에서만 동작한다. */
function TabIcon({
  Icon,
  active,
}: {
  Icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  const { pending } = useLinkStatus()
  const cls = cn('h-5 w-5', active && 'text-primary-foreground')
  if (pending) return <Loader2 className={cn(cls, 'animate-spin')} />
  return <Icon className={cls} />
}

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-safe"
      aria-label="하단 탭"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== '/app/chat' && pathname?.startsWith(tab.href))
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary'
                )}
              >
                {/* 눌린 즉시 스피너로 바뀌어 반응이 보이게 한다 */}
                <TabIcon Icon={Icon} active={active} />
              </div>
              <span className={cn(active && 'font-semibold')}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
