import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Community, User } from '@prisma/client'

export type CurrentUser = User & {
  communities: { id: string; name: string; communityType: string; regionName: string }[]
}

/** Server-side: returns the logged-in user with their communities, or null (guest). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions)
  const uid = (session?.user as any)?.id as string | undefined
  if (!uid) return null
  const user = await db.user.findUnique({
    where: { id: uid },
    include: {
      communities: { include: { community: true } },
    },
  })
  if (!user) return null
  return {
    ...user,
    communities: user.communities.map((cm) => ({
      id: cm.community.id,
      name: cm.community.name,
      communityType: cm.community.communityType,
      regionName: cm.community.regionName,
    })),
  }
}

export type { Community, User }
