import Link from 'next/link'
import { LogIn, MessageCircle, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/session'

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
          <LogIn className="mr-1 h-4 w-4" /> 로그인
        </Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {user.communities.length > 0 ? (
        <Button asChild size="sm" className="rounded-full">
          <Link href={chatHref}>
            <MessageCircle className="mr-1 h-4 w-4" /> 채팅 앱으로
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" className="rounded-full">
          <Link href="/onboarding">
            <Plus className="mr-1 h-4 w-4" /> 마을 참여하기
          </Link>
        </Button>
      )}
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link href="/app/me">
          <User className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">내 정보</span>
        </Link>
      </Button>
    </div>
  )
}
