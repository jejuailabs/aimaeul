/**
 * 사진 직후에 이어진 대화를 그 사진의 코멘트로 묶는다.
 *
 * 채팅방에서는 사진을 올린 뒤 그에 대한 이야기가 바로 이어지는 경우가 많다.
 * 사진과 대화를 따로 보여주면 어떤 사진에 대한 말인지 알 수 없으므로,
 * 시간 근접성으로 묶어 사진 카드에 말풍선으로 함께 노출한다.
 */

export type PhotoComment = {
  id: string
  authorName: string
  authorPhotoURL: string | null
  text: string
  createdAt: string | null
}

/** 사진 뒤 이 시간 안에 올라온 대화만 코멘트로 본다. */
export const COMMENT_WINDOW_MS = 30 * 60 * 1000
export const MAX_COMMENTS_PER_PHOTO = 3

type PhotoLike = { id: string; createdAtMs: number }
type MessageLike = {
  id: string
  createdAtMs: number
  authorName: string
  authorPhotoURL: string | null
  text: string
  createdAt: string | null
  type?: string
}

/**
 * @returns photoId -> 코멘트 목록(오래된 순), 그리고 코멘트로 소비된 메시지 id 집합
 */
export function attachCommentsToPhotos(
  photos: PhotoLike[],
  messages: MessageLike[]
): { commentsByPhoto: Map<string, PhotoComment[]>; usedMessageIds: Set<string> } {
  const commentsByPhoto = new Map<string, PhotoComment[]>()
  const usedMessageIds = new Set<string>()

  // "직후" 판정을 위해 사진을 시간 오름차순으로 본다.
  const ordered = [...photos].sort((a, b) => a.createdAtMs - b.createdAtMs)
  if (ordered.length === 0) return { commentsByPhoto, usedMessageIds }

  for (const msg of messages) {
    if (msg.type && msg.type !== 'text') continue
    if (!msg.text) continue

    // 이 메시지 직전의 사진 찾기
    let target: PhotoLike | null = null
    for (const p of ordered) {
      if (p.createdAtMs <= msg.createdAtMs) target = p
      else break
    }
    if (!target) continue

    const gap = msg.createdAtMs - target.createdAtMs
    if (gap < 0 || gap > COMMENT_WINDOW_MS) continue

    const list = commentsByPhoto.get(target.id) ?? []
    if (list.length >= MAX_COMMENTS_PER_PHOTO) continue

    list.push({
      id: msg.id,
      authorName: msg.authorName,
      authorPhotoURL: msg.authorPhotoURL,
      text: msg.text,
      createdAt: msg.createdAt,
    })
    commentsByPhoto.set(target.id, list)
    usedMessageIds.add(msg.id)
  }

  for (const list of commentsByPhoto.values()) {
    list.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0
      return ta - tb
    })
  }

  return { commentsByPhoto, usedMessageIds }
}
