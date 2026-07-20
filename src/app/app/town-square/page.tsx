import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/app-shell'
import { getCurrentUser } from '@/lib/session'
import { TownSquareClient } from './town-square-client'

export const dynamic = 'force-dynamic'

export default async function TownSquarePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/town-square')

  // 소속 마을이 없으면 "어느 마을 누구"인지 표시할 수 없으므로 쓰기를 막는다.
  if (user.communities.length === 0) {
    return (
      <AppShell title="마을 광장">
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p>마을에 참여하면 전국 이웃들과 이야기할 수 있어요.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link href="/onboarding">마을 참여하기</Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="마을 광장">
      <TownSquareClient
        uid={user.uid}
        communities={user.communities}
      />
    </AppShell>
  )
}
