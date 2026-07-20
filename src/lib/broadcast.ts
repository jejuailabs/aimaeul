import { db } from '@/lib/db'
import type { Message } from '@prisma/client'

/**
 * 서버사이드에서 메시지를 DB에 쓰고 socket service 에 브로드캐스트 요청.
 * chat:send 소켓 이벤트와 동일 효과 (DB write + room broadcast).
 * 시스템 메시지, 게임 결과(API 경유), 사진 메시지 등에서 사용.
 */
export async function createMessageAndBroadcast(payload: {
  communityId: string
  authorId: string
  authorName: string
  authorPhotoURL?: string | null
  type?: string
  text?: string | null
  photoId?: string | null
  emojiUrl?: string | null
  gameResultPayload?: any | null
}): Promise<Message> {
  const msg = await db.message.create({
    data: {
      communityId: payload.communityId,
      authorId: payload.authorId,
      authorName: payload.authorName,
      authorPhotoURL: payload.authorPhotoURL ?? null,
      type: payload.type ?? 'text',
      text: payload.text ?? null,
      photoId: payload.photoId ?? null,
      emojiUrl: payload.emojiUrl ?? null,
      gameResultPayload: payload.gameResultPayload
        ? JSON.stringify(payload.gameResultPayload)
        : 'null',
    },
  })

  // socket service 에 브로드캐스트 (실패해도 메시지는 DB 에 있음 — 클라이언트가 새로고침 시 보임)
  const broadcastMsg = {
    ...msg,
    gameResultPayload:
      msg.gameResultPayload && msg.gameResultPayload !== 'null'
        ? JSON.parse(msg.gameResultPayload)
        : null,
  }
  try {
    await fetch('http://localhost:3003/internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId: payload.communityId, message: broadcastMsg }),
    })
  } catch (e) {
    console.error('[broadcast] socket service 호출 실패:', e)
  }

  return msg
}
