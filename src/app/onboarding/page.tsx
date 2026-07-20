import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
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
      const membersSnap = await adminDb
        .collection('users')
        .where('communityIds', 'array-contains', doc.id)
        .get()
      return {
        id: doc.id,
        name: c.name ?? '',
        communityType: c.communityType ?? '',
        regionName: c.regionName ?? '',
        lat: c.lat ?? 0,
        lng: c.lng ?? 0,
        coverImageUrl: c.coverImageUrl ?? null,
        description: c.description ?? null,
        memberCount: membersSnap.size,
      }
    })
  )

  return <OnboardingClient communities={publicCommunities} />
}
