import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { OnboardingClient } from './onboarding-client'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/onboarding')
  if (user.communities.length > 0) redirect('/app/chat')

  const communities = await db.community.findMany({
    where: { isPublic: true },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const publicCommunities = communities.map((c) => ({
    id: c.id,
    name: c.name,
    communityType: c.communityType,
    regionName: c.regionName,
    lat: c.lat,
    lng: c.lng,
    coverImageUrl: c.coverImageUrl,
    description: c.description,
    memberCount: c._count.members,
  }))

  return <OnboardingClient communities={publicCommunities} />
}
