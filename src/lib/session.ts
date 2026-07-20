import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export type CurrentUser = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
  communities: { id: string; name: string; communityType: string; regionName: string }[]
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return null

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return null

    const userData = userDoc.data()!
    const communityIds: string[] = userData.communityIds || []

    const communities: CurrentUser['communities'] = []
    for (const cid of communityIds) {
      const cDoc = await adminDb.collection('communities').doc(cid).get()
      if (cDoc.exists) {
        const d = cDoc.data()!
        communities.push({
          id: cid,
          name: d.name,
          communityType: d.communityType,
          regionName: d.regionName,
        })
      }
    }

    return {
      uid: decoded.uid,
      displayName: userData.displayName || '익명',
      email: userData.email || null,
      photoURL: userData.photoURL || null,
      communities,
    }
  } catch {
    return null
  }
}
