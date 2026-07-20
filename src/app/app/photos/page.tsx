import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
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

  const community = await db.community.findUnique({ where: { id: activeId } })
  if (!community) redirect('/app/photos')

  const photos = await db.photo.findMany({
    where: { communityId: activeId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const serialized = photos.map((p) => ({
    id: p.id,
    storageUrl: p.storageUrl,
    thumbnailUrl: p.thumbnailUrl,
    uploaderName: p.uploaderName,
    exifTakenAt: p.exifTakenAt?.toISOString() ?? null,
    exifLat: p.exifLat,
    exifLng: p.exifLng,
    exifDevice: p.exifDevice,
    exifLens: p.exifLens,
    aiTags: JSON.parse(p.aiTags || '[]') as string[],
    aiCaption: p.aiCaption,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <AppShell title="사진">
      <PhotosClient
        communityId={activeId}
        communityName={community.name}
        communities={user.communities}
        photos={serialized}
      />
    </AppShell>
  )
}
