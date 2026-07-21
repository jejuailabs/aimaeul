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

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) redirect('/app/chat')

  // Save the user's last read position for unread badge tracking
  adminDb
    .collection('users')
    .doc(user.uid)
    .collection('readPositions')
    .doc(communityId)
    .set({ lastReadAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => { /* best-effort, don't block page render */ })

  // 서로 의존하지 않는 조회를 순차로 기다리면 그 왕복 시간이 전부 더해져
  // 채팅방 진입이 1~2초씩 걸린다. 한 번에 가져온다.
  const commRef = adminDb.collection('communities').doc(communityId)
  const [commDoc, messagesSnap, memberSnap] = await Promise.all([
    commRef.get(),
    commRef.collection('messages').orderBy('createdAt', 'asc').limit(60).get(),
    adminDb.collection('users').where('communityIds', 'array-contains', communityId).get(),
  ])
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

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

  // 사진을 한 장씩 순차로 읽으면 사진 수만큼 왕복이 늘어난다. 일괄로 가져온다.
  const photoMap: Record<string, PhotoData> = {}
  const photoDocs =
    photoIds.length > 0
      ? await adminDb.getAll(
          ...photoIds.map((pid) => commRef.collection('photos').doc(pid))
        )
      : []
  for (const photoDoc of photoDocs) {
    if (photoDoc.exists) {
      const p = photoDoc.data()!
      photoMap[photoDoc.id] = {
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

  // 게임 참가자 후보 = 이 마을 회원. 위에서 병렬로 이미 가져왔다.
  const gameMembers = memberSnap.docs.map((d) => {
    const u = d.data()
    return {
      id: d.id,
      name: u.displayName ?? '익명',
      photoURL: u.photoURL ?? null,
    }
  })

  // 게임은 회장·관리자만 진행한다. 회원에게는 아이콘 자체를 보이지 않게
  // 서버에서 권한을 계산해 넘긴다(클라이언트에서 조회하면 잠깐 보였다 사라진다).
  const canRunGame =
    user.role === 'superadmin' || user.adminCommunities.includes(communityId)

  return (
    <ChatRoomClient
      canRunGame={canRunGame}
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
