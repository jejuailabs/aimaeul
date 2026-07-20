import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { NewCommunityClient } from './new-community-client'

export const dynamic = 'force-dynamic'

export default async function NewCommunityPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/admin/communities/new')

  // 체험 모드로 권한을 낮춘 상태에서도 안내가 뜨도록 적용 권한으로 판단한다.
  if (user.role !== 'superadmin') {
    return (
      <AppShell title="새 마을 만들기">
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p>마을 생성은 운영자만 할 수 있어요.</p>
          {user.realRole === 'superadmin' && (
            <p className="mt-2">
              지금 체험 모드가 켜져 있어요. 내 정보에서 슈퍼관리자 모드로 되돌리면 사용할 수 있어요.
            </p>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="새 마을 만들기">
      <NewCommunityClient />
    </AppShell>
  )
}
