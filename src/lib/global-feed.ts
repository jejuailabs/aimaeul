import { adminDb } from '@/lib/firebase-admin'
import { attachCommentsToPhotos, type PhotoComment } from '@/lib/photo-comments'

/**
 * 여러 마을의 최근 활동을 하나로 모은 전국 피드.
 *
 * collectionGroup으로 photos/messages를 한 번에 훑고, 공개 마을 것만 남긴다.
 * 마을 수만큼 쿼리를 돌리면 마을이 늘어날수록 느려지므로 이 방식을 쓴다.
 *
 * 사진 소식이 가장 잘 보이도록 사진과 텍스트를 분리해서 돌려주고,
 * 사진 직후에 이어진 대화는 그 사진의 코멘트로 묶는다.
 */

export type FeedComment = PhotoComment

export type PhotoFeedItem = {
  id: string
  communityId: string
  communityName: string
  communityType: string
  regionName: string
  authorName: string
  authorPhotoURL: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  aiCaption: string | null
  exifAddress: string | null
  createdAt: string | null
  /** 이 사진 직후에 이어진 대화. 말풍선으로 함께 보여준다. */
  comments: FeedComment[]
}

export type TextFeedItem = {
  id: string
  communityId: string
  communityName: string
  communityType: string
  regionName: string
  authorName: string
  authorPhotoURL: string | null
  text: string
  createdAt: string | null
}

export type GlobalFeed = {
  photos: PhotoFeedItem[]
  texts: TextFeedItem[]
}

type PublicCommunityMeta = {
  id: string
  name: string
  communityType: string
  regionName: string
}

type RawMessage = {
  id: string
  communityId: string
  authorName: string
  authorPhotoURL: string | null
  text: string
  createdAtMs: number
  createdAt: string | null
}

function toIso(v: any): string | null {
  return v?.toDate?.()?.toISOString() ?? null
}

function toMs(v: any): number {
  return v?.toMillis?.() ?? 0
}

export async function fetchGlobalFeed(limit = 20): Promise<GlobalFeed> {
  // 공개 마을 목록을 먼저 확보해 비공개 마을 콘텐츠가 새어나가지 않게 한다.
  const commSnap = await adminDb.collection('communities').where('isPublic', '==', true).get()
  const publicMap = new Map<string, PublicCommunityMeta>()
  for (const d of commSnap.docs) {
    const c = d.data()
    publicMap.set(d.id, {
      id: d.id,
      name: c.name ?? '',
      communityType: c.communityType ?? '',
      regionName: c.regionName ?? '',
    })
  }
  if (publicMap.size === 0) return { photos: [], texts: [] }

  const parentCommunityId = (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
    doc.ref.parent.parent?.id ?? ''

  const [photoSnap, msgSnap] = await Promise.all([
    adminDb
      .collectionGroup('photos')
      .orderBy('createdAt', 'desc')
      .limit(limit * 2)
      .get()
      .catch(() => null),
    adminDb
      .collectionGroup('messages')
      .orderBy('createdAt', 'desc')
      .limit(limit * 5)
      .get()
      .catch(() => null),
  ])

  // 1) 사진 수집
  const photos: PhotoFeedItem[] = []
  for (const doc of photoSnap?.docs ?? []) {
    const cid = parentCommunityId(doc)
    const comm = publicMap.get(cid)
    if (!comm) continue
    const p = doc.data()
    photos.push({
      id: `photo_${doc.id}`,
      communityId: cid,
      communityName: comm.name,
      communityType: comm.communityType,
      regionName: comm.regionName,
      authorName: p.uploaderName ?? '익명',
      authorPhotoURL: p.uploaderPhotoURL ?? null,
      imageUrl: p.storageUrl ?? null,
      thumbnailUrl: p.thumbnailUrl ?? p.storageUrl ?? null,
      aiCaption: p.aiCaption ?? null,
      exifAddress: p.exifAddress ?? null,
      createdAt: toIso(p.createdAt),
      comments: [],
    })
  }

  // 2) 텍스트 메시지 수집 (시스템/사진/이모티콘/게임 메시지는 제외)
  const messages: RawMessage[] = []
  for (const doc of msgSnap?.docs ?? []) {
    const cid = parentCommunityId(doc)
    if (!publicMap.has(cid)) continue
    const m = doc.data()
    if (m.type !== 'text' || !m.text) continue
    messages.push({
      id: `msg_${doc.id}`,
      communityId: cid,
      authorName: m.authorName ?? '익명',
      authorPhotoURL: m.authorPhotoURL ?? null,
      text: m.text,
      createdAtMs: toMs(m.createdAt),
      createdAt: toIso(m.createdAt),
    })
  }

  // 3) 사진 직후에 이어진 대화를 그 사진의 코멘트로 묶는다.
  //    마을이 섞이면 안 되므로 마을별로 나눠서 계산한다.
  const usedAsComment = new Set<string>()
  const photoById = new Map(photos.map((p) => [p.id, p]))
  const communityIds = new Set(photos.map((p) => p.communityId))

  for (const cid of communityIds) {
    const cPhotos = photos
      .filter((p) => p.communityId === cid)
      .map((p) => ({ id: p.id, createdAtMs: p.createdAt ? Date.parse(p.createdAt) : 0 }))
    const cMessages = messages.filter((m) => m.communityId === cid)

    const { commentsByPhoto, usedMessageIds } = attachCommentsToPhotos(cPhotos, cMessages)
    for (const [photoId, comments] of commentsByPhoto) {
      const p = photoById.get(photoId)
      if (p) p.comments = comments
    }
    for (const id of usedMessageIds) usedAsComment.add(id)
  }

  // 4) 사진에 묶이지 않은 대화만 별도 섹션으로
  const texts: TextFeedItem[] = messages
    .filter((m) => !usedAsComment.has(m.id))
    .map((m) => {
      const comm = publicMap.get(m.communityId)!
      return {
        id: m.id,
        communityId: m.communityId,
        communityName: comm.name,
        communityType: comm.communityType,
        regionName: comm.regionName,
        authorName: m.authorName,
        authorPhotoURL: m.authorPhotoURL,
        text: m.text,
        createdAt: m.createdAt,
      }
    })

  const byNewest = <T extends { createdAt: string | null }>(a: T, b: T) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0
    return tb - ta
  }

  photos.sort(byNewest)
  texts.sort(byNewest)

  return {
    photos: photos.slice(0, limit),
    texts: texts.slice(0, limit),
  }
}
