import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { ChatRoomClient } from './chat-room-client'
import type { Photo } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ communityId: string }>
}) {
  const { communityId } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?callbackUrl=/app/chat/${communityId}`)

  const community = await db.community.findUnique({ where: { id: communityId } })
  if (!community) notFound()

  const membership = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  })
  if (!membership) {
    redirect('/app/chat')
  }

  // 최근 메시지 + 관련 사진
  const messages = await db.message.findMany({
    where: { communityId },
    orderBy: { createdAt: 'asc' },
    take: 60,
  })
  const photoIds = messages
    .map((m) => m.photoId)
    .filter((x): x is string => !!x)
  const photos = photoIds.length
    ? await db.photo.findMany({ where: { id: { in: photoIds } } })
    : []
  const photoMap = new Map<string, Photo>(photos.map((p) => [p.id, p]))

  const initialMessages = messages.map((m) => ({
    ...m,
    gameResultPayload:
      m.gameResultPayload && m.gameResultPayload !== 'null'
        ? JSON.parse(m.gameResultPayload)
        : null,
  }))

  return (
    <ChatRoomClient
      community={{
        id: community.id,
        name: community.name,
        communityType: community.communityType,
        regionName: community.regionName,
        coverImageUrl: community.coverImageUrl,
      }}
      user={{
        id: user.id,
        name: user.name,
        photoURL: user.photoURL,
      }}
      initialMessages={initialMessages}
      photoMap={photoMap}
    />
  )
}
