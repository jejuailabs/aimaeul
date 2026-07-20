import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { parseRegion } from '@/lib/regions'
import { OnboardingClient } from './onboarding-client'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/onboarding')
  if (user.communities.length > 0) redirect('/app/chat')

  // isPublic + createdAt 복합 인덱스를 요구하지 않도록 정렬은 메모리에서 처리한다.
  const commSnap = await adminDb
    .collection('communities')
    .where('isPublic', '==', true)
    .get()

  const commDocs = [...commSnap.docs].sort(
    (a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0)
  )

  const publicCommunities = await Promise.all(
    commDocs.map(async (doc) => {
      const c = doc.data()
      // 문서를 전부 가져오지 않고 집계만 한다.
      const membersSnap = await adminDb
        .collection('users')
        .where('communityIds', 'array-contains', doc.id)
        .count()
        .get()
      // 문서에 sido/sigungu가 없으면 regionName에서 추론한다(기존 데이터 호환).
      const parsed = parseRegion(c.regionName ?? '')
      return {
        id: doc.id,
        name: c.name ?? '',
        communityType: c.communityType ?? '',
        regionName: c.regionName ?? '',
        sido: c.sido ?? parsed.sido ?? '',
        sigungu: c.sigungu ?? parsed.sigungu ?? '',
        lat: c.lat ?? 0,
        lng: c.lng ?? 0,
        coverImageUrl: c.coverImageUrl ?? null,
        description: c.description ?? null,
        memberCount: membersSnap.data().count,
      }
    })
  )

  // 이미 낸 신청이 있으면 "승인 대기" 상태를 보여준다.
  const pendingSnap = await adminDb
    .collection('membershipRequests')
    .where('uid', '==', user.uid)
    .where('status', '==', 'pending')
    .get()

  const pendingRequests = pendingSnap.docs.map((d) => {
    const r = d.data()
    return {
      id: d.id,
      communityId: r.communityId,
      communityName: r.communityName ?? '',
      communityType: r.communityType ?? '',
      regionName: r.regionName ?? '',
    }
  })

  return (
    <OnboardingClient
      communities={publicCommunities}
      pendingRequests={pendingRequests}
      isSuperadmin={user.realRole === 'superadmin'}
    />
  )
}
