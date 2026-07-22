import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { ManageCommunityClient } from './manage-community-client'

export const dynamic = 'force-dynamic'

export default async function ManageCommunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?callbackUrl=/app/admin/communities/${id}`)

  const canManage =
    user.role === 'superadmin' || user.adminCommunities.includes(id)

  if (!canManage) {
    return (
      <AppShell title="마을 관리" back="/app/admin">
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p>이 마을을 관리할 권한이 없어요.</p>
          {user.realRole === 'superadmin' && (
            <p className="mt-2">
              체험 모드가 켜져 있어요. 상단 배지를 눌러 슈퍼관리자로 되돌리면 보입니다.
            </p>
          )}
        </div>
      </AppShell>
    )
  }

  const doc = await adminDb.collection('communities').doc(id).get()
  if (!doc.exists) notFound()
  const c = doc.data()!

  return (
    <AppShell title="마을 관리" back="/app/admin">
      <ManageCommunityClient
        community={{
          id,
          name: c.name ?? '',
          communityType: c.communityType ?? '',
          regionName: c.regionName ?? '',
          inviteCode: c.inviteCode ?? '',
          coverImageUrl: c.coverImageUrl ?? null,
          mascotImageUrl: c.mascotImageUrl ?? null,
          bannerGallery: c.bannerGallery ?? [],
          mascotGallery: c.mascotGallery ?? [],
        }}
        isSuperadmin={user.role === 'superadmin'}
      />
    </AppShell>
  )
}
