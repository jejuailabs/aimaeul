import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { MemberApprovalClient } from './member-approval-client'

export const dynamic = 'force-dynamic'

export default async function MemberApprovalPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/admin/members')

  const canManage = user.role === 'superadmin' || user.adminCommunities.length > 0
  if (!canManage) {
    return (
      <AppShell title="가입 승인">
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p>가입 승인 권한이 없어요.</p>
          <p className="mt-1">마을 회장님 또는 운영자만 접근할 수 있습니다.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="가입 승인">
      <MemberApprovalClient isSuperadmin={user.role === 'superadmin'} />
    </AppShell>
  )
}
