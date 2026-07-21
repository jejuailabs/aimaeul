import Link from 'next/link'
import { LogIn, MessageCircle, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/session'
import { LinkPending } from '@/components/link-pending'

/**
 * 공개 화면(지도·마을 홈페이지) 우상단 인증 버튼.
 *
 * 로그인 상태에서도 "내 정보"로 갈 수 있어야 로그아웃/설정에 접근할 수 있다.
 * 화면마다 제각각 만들면 또 빠지므로 한 곳에서 관리한다.
 */
export async function AuthHeaderActions({
  chatHref = '/app/chat',
}: {
  /** 마을 홈페이지에서는 해당 마을 채팅방으로 바로 보낸다. */
  chatHref?: string
}) {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Button asChild size="sm" className="rounded-full">
        <Link href="/login">
          <LinkPending className="mr-1" /><LogIn className="mr-1 h-4 w-4" /> 로그인
        </Link>
      </Button>
    )
  }

  // "내 정보"는 하단 메뉴에 이미 있다. 여기까지 두면 헤더가 한쪽으로 쏠린다.
  if (user.communities.length > 0) {
    return (
      <Button asChild size="sm" className="rounded-full">
        <Link href={chatHref}>
          <LinkPending className="mr-1" />
          <MessageCircle className="mr-1 h-4 w-4" /> 채팅 앱으로
        </Link>
      </Button>
    )
  }

  return (
    <Button asChild size="sm" className="rounded-full">
      <Link href="/onboarding">
        <LinkPending className="mr-1" />
        <Plus className="mr-1 h-4 w-4" /> 마을 참여하기
      </Link>
    </Button>
  )
}
