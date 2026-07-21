import Link from 'next/link'
import { List, MessageCircle, User } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { LinkPending } from '@/components/link-pending'

/**
 * 공개 메인 화면(지도)의 하단 고정 메뉴.
 *
 * 어르신이 가장 자주 쓰는 동작은 "내 채팅방으로 들어가기" 하나다.
 * 그래서 가운데 버튼을 가장 크게 두고, 나머지는 보조로 둔다.
 */
export async function PublicBottomNav() {
  const user = await getCurrentUser()

  // 소속 마을이 있으면 바로 그 채팅방, 없으면 참여 화면으로 보낸다.
  const primaryHref = !user
    ? '/login?callbackUrl=/app/chat'
    : user.communities.length > 0
      ? '/app/chat'
      : '/onboarding'

  const primaryLabel = !user
    ? '로그인하고 시작'
    : user.communities.length > 0
      ? '내 모임 바로 들어가기'
      : '마을 참여하기'

  return (
    <>
      {/* 고정 메뉴에 콘텐츠가 가리지 않도록 여백 확보 */}
      <div aria-hidden className="h-28" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-safe"
        aria-label="하단 메뉴"
      >
        <div className="mx-auto flex max-w-2xl items-end justify-around gap-2 px-3 py-2">
          <Link
            href="#village-list"
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <List className="h-5 w-5" />
            마을 목록
          </Link>

          {/* 가운데: 가장 크고 눈에 띄게 */}
          <Link
            href={primaryHref}
            className="flex flex-[1.6] flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-3 py-3 text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-1.5">
              <LinkPending />
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="text-center text-[13px] font-bold leading-tight">
              {primaryLabel}
            </span>
          </Link>

          <Link
            href={user ? '/app/me' : '/login?callbackUrl=/app/me'}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <User className="h-5 w-5" />
            내 정보
          </Link>
        </div>
      </nav>
    </>
  )
}
