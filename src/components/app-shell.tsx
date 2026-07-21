'use client'

import Link from 'next/link'
import { ArrowLeft, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomTabBar } from '@/components/bottom-tab-bar'
import { ViewModeBadge } from '@/components/view-mode-badge'
import { cn } from '@/lib/utils'

/**
 * 회원 앱 공통 셸. 하단 5개 탭 + 본문.
 * `title`/`back` 옵션으로 상단 서브헤더 표시.
 */
export function AppShell({
  children,
  title,
  back,
  right,
  hideTabBar,
  className,
}: {
  children: React.ReactNode
  title?: string
  back?: string | boolean
  right?: React.ReactNode
  hideTabBar?: boolean
  className?: string
}) {
  const backHref = typeof back === 'string' ? back : back === true ? '/app/chat' : undefined
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 지도로 나가는 버튼이 항상 있어야 하므로 헤더는 조건 없이 렌더한다 */}
      {(
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/95 px-2 backdrop-blur">
          {backHref && (
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link href={backHref} aria-label="뒤로">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          {title && <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>}
          {!title && <div className="flex-1" />}
          {/* 슈퍼관리자만 보이며, 탭 한 번으로 회장/회원 시점 전환 */}
          <ViewModeBadge />
          {/* 앱 어디서든 지도(메인)로 나갈 수 있어야 한다 */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            aria-label="마을 지도로"
          >
            <Link href="/">
              <Map className="h-5 w-5" />
            </Link>
          </Button>
          {right}
        </header>
      )}
      <main className={cn('mx-auto w-full max-w-2xl flex-1', hideTabBar ? 'pb-4' : 'pb-24', className)}>
        {children}
      </main>
      {/* 채팅은 하단 탭 정중앙에 크게 있으므로 별도 버튼을 두지 않는다 */}
      {!hideTabBar && <BottomTabBar />}
    </div>
  )
}
