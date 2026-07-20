import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export type MessageData = {
  communityId: string
  authorUid: string
  authorName: string
  authorPhotoURL?: string | null
  type?: string
  text?: string | null
  photoId?: string | null
  emojiUrl?: string | null
  gameResultPayload?: any | null
}

export async function createMessageAndBroadcast(payload: MessageData) {
  const msgRef = adminDb
    .collection('communities')
    .doc(payload.communityId)
    .collection('messages')
    .doc()

  const msgData = {
    messageId: msgRef.id,
    authorUid: payload.authorUid,
    authorName: payload.authorName,
    authorPhotoURL: payload.authorPhotoURL ?? null,
    type: payload.type ?? 'text',
    text: payload.text ?? null,
    photoId: payload.photoId ?? null,
    emojiUrl: payload.emojiUrl ?? null,
    gameResultPayload: payload.gameResultPayload ?? null,
    createdAt: FieldValue.serverTimestamp(),
  }

  await msgRef.set(msgData)

  return { id: msgRef.id, ...msgData }
}
