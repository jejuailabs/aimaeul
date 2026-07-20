import { adminDb } from '@/lib/firebase-admin'

/**
 * 여러 마을의 최근 활동을 하나로 모은 전국 피드.
 *
 * collectionGroup으로 photos/messages를 한 번에 훑고, 공개 마을 것만 남긴다.
 * 마을 수만큼 쿼리를 돌리면 마을이 늘어날수록 느려지므로 이 방식을 쓴다.
 */

export type FeedItem = {
  id: string
  kind: 'photo' | 'message'
  communityId: string
  communityName: string
  communityType: string
  regionName: string
  authorName: string
  authorPhotoURL: string | null
  text: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  aiCaption: string | null
  exifAddress: string | null
  createdAt: string | null
}

type PublicCommunityMeta = {
  id: string
  name: string
  communityType: string
  regionName: string
}

function toIso(v: any): string | null {
  return v?.toDate?.()?.toISOString() ?? null
}

export async function fetchGlobalFeed(limit = 30): Promise<FeedItem[]> {
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
  if (publicMap.size === 0) return []

  /** 서브컬렉션 문서의 부모 마을 id를 경로에서 얻는다. */
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
      .limit(limit * 3)
      .get()
      .catch(() => null),
  ])

  const items: FeedItem[] = []

  for (const doc of photoSnap?.docs ?? []) {
    const cid = parentCommunityId(doc)
    const comm = publicMap.get(cid)
    if (!comm) continue
    const p = doc.data()
    items.push({
      id: `photo_${doc.id}`,
      kind: 'photo',
      communityId: cid,
      communityName: comm.name,
      communityType: comm.communityType,
      regionName: comm.regionName,
      authorName: p.uploaderName ?? '익명',
      authorPhotoURL: p.uploaderPhotoURL ?? null,
      text: null,
      imageUrl: p.storageUrl ?? null,
      thumbnailUrl: p.thumbnailUrl ?? p.storageUrl ?? null,
      aiCaption: p.aiCaption ?? null,
      exifAddress: p.exifAddress ?? null,
      createdAt: toIso(p.createdAt),
    })
  }

  for (const doc of msgSnap?.docs ?? []) {
    const cid = parentCommunityId(doc)
    const comm = publicMap.get(cid)
    if (!comm) continue
    const m = doc.data()
    // 시스템 메시지와 사진 메시지는 피드에 중복/노이즈가 되어 제외한다.
    if (m.type !== 'text') continue
    if (!m.text) continue
    items.push({
      id: `msg_${doc.id}`,
      kind: 'message',
      communityId: cid,
      communityName: comm.name,
      communityType: comm.communityType,
      regionName: comm.regionName,
      authorName: m.authorName ?? '익명',
      authorPhotoURL: m.authorPhotoURL ?? null,
      text: m.text,
      imageUrl: null,
      thumbnailUrl: null,
      aiCaption: null,
      exifAddress: null,
      createdAt: toIso(m.createdAt),
    })
  }

  items.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0
    return tb - ta
  })

  return items.slice(0, limit)
}
