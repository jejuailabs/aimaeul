import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { AppShell } from '@/components/app-shell'
import { PhotosClient } from './photos-client'

export const dynamic = 'force-dynamic'

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/photos')
  if (user.communities.length === 0) redirect('/onboarding')

  const sp = await searchParams
  const activeId = sp.c && user.communities.some((c) => c.id === sp.c) ? sp.c : user.communities[0].id

  const commDoc = await adminDb.collection('communities').doc(activeId).get()
  if (!commDoc.exists) redirect('/app/photos')
  const community = commDoc.data()!

  const photosSnap = await adminDb
    .collection('communities')
    .doc(activeId)
    .collection('photos')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  const serialized = photosSnap.docs.map((doc) => {
    const p = doc.data()
    let aiTags: string[] = []
    try {
      aiTags = typeof p.aiTags === 'string' ? JSON.parse(p.aiTags) : (p.aiTags ?? [])
    } catch { /* ignore */ }
    return {
      id: doc.id,
      storageUrl: p.storageUrl ?? '',
      thumbnailUrl: p.thumbnailUrl ?? '',
      uploaderName: p.uploaderName ?? '',
      exifTakenAt: p.exifTakenAt?.toDate?.()?.toISOString?.() ?? null,
      exifLat: p.exifLat ?? null,
      exifLng: p.exifLng ?? null,
      exifDevice: p.exifDevice ?? null,
      exifLens: p.exifLens ?? null,
      aiTags,
      aiCaption: p.aiCaption ?? null,
      createdAt: p.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    }
  })

  return (
    <AppShell title="사진">
      <PhotosClient
        communityId={activeId}
        communityName={community.name ?? ''}
        communities={user.communities}
        photos={serialized}
      />
    </AppShell>
  )
}
