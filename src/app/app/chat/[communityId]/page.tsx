import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ChatRoomClient } from './chat-room-client'
import type { PhotoData } from '@/components/message-bubble'

export const dynamic = 'force-dynamic'

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ communityId: string }>
}) {
  const { communityId } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?callbackUrl=/app/chat/${communityId}`)

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

  // Save the user's last read position for unread badge tracking
  adminDb
    .collection('users')
    .doc(user.uid)
    .collection('readPositions')
    .doc(communityId)
    .set({ lastReadAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => { /* best-effort, don't block page render */ })

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) redirect('/app/chat')

  const messagesSnap = await adminDb
    .collection('communities')
    .doc(communityId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(60)
    .get()

  const messages = messagesSnap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      communityId,
      authorUid: d.authorUid ?? '',
      authorName: d.authorName ?? '',
      authorPhotoURL: d.authorPhotoURL ?? null,
      type: d.type ?? 'text',
      text: d.text ?? null,
      photoId: d.photoId ?? null,
      emojiUrl: d.emojiUrl ?? null,
      gameResultPayload: d.gameResultPayload ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    }
  })

  const photoIds = messages
    .map((m) => m.photoId)
    .filter((x): x is string => !!x)

  const photoMap: Record<string, PhotoData> = {}
  for (const pid of photoIds) {
    const photoDoc = await adminDb
      .collection('communities')
      .doc(communityId)
      .collection('photos')
      .doc(pid)
      .get()
    if (photoDoc.exists) {
      const p = photoDoc.data()!
      photoMap[pid] = {
        id: photoDoc.id,
        storageUrl: p.storageUrl ?? '',
        thumbnailUrl: p.thumbnailUrl ?? '',
        uploaderName: p.uploaderName ?? undefined,
        exifTakenAt: p.exifTakenAt?.toDate?.()?.toISOString?.() ?? null,
        exifLat: p.exifLat ?? null,
        exifLng: p.exifLng ?? null,
        exifDevice: p.exifDevice ?? null,
        exifLens: p.exifLens ?? null,
        exifAddress: p.exifAddress ?? null,
        aiCaption: p.aiCaption ?? null,
      }
    }
  }

  // 게임 참가자 후보 = 이 마을 회원. 게임 모달에서 쓴다.
  const memberSnap = await adminDb
    .collection('users')
    .where('communityIds', 'array-contains', communityId)
    .get()
  const gameMembers = memberSnap.docs.map((d) => {
    const u = d.data()
    return {
      id: d.id,
      name: u.displayName ?? '익명',
      photoURL: u.photoURL ?? null,
    }
  })

  return (
    <ChatRoomClient
      gameMembers={gameMembers}
      community={{
        id: communityId,
        name: community.name ?? '',
        communityType: community.communityType ?? '',
        regionName: community.regionName ?? '',
        coverImageUrl: community.coverImageUrl ?? null,
      }}
      user={{
        id: user.uid,
        name: user.displayName,
        photoURL: user.photoURL,
      }}
      initialMessages={messages}
      photoMap={photoMap}
    />
  )
}
