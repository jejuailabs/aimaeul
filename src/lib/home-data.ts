import { unstable_cache } from 'next/cache'
import { adminDb } from '@/lib/firebase-admin'
import { fetchGlobalFeed, type GlobalFeed } from '@/lib/global-feed'

/**
 * 메인 화면의 공개 데이터(마을 목록 + 전국 피드).
 *
 * 로그인 여부와 무관한 데이터라 사용자마다 다시 계산할 이유가 없다.
 * 예전에는 요청마다 아래를 순차로 돌려 5초 넘게 걸렸다:
 *   세션 조회 → 마을 조회 → 피드 조회 → 마을 수만큼 인원수 카운트
 *
 * - 인원수는 마을마다 카운트 쿼리를 던지지 않고 users를 한 번만 읽어 집계한다.
 * - 결과 전체를 짧게 캐시해 연속 방문에서 Firestore를 다시 때리지 않는다.
 */

export type PublicCommunity = {
  id: string
  name: string
  communityType: string
  regionName: string
  sido: string
  sigungu: string
  lat: number | null
  lng: number | null
  coverImageUrl: string | null
  description: string | null
  memberCount: number
}

export type HomeData = {
  communities: PublicCommunity[]
  feed: GlobalFeed
}

async function loadHomeData(): Promise<HomeData> {
  // 마을 목록과 회원 목록을 동시에 가져온다.
  const [commSnap, usersSnap] = await Promise.all([
    adminDb.collection('communities').where('isPublic', '==', true).get(),
    adminDb.collection('users').select('communityIds').get(),
  ])

  // 마을별 인원수를 메모리에서 집계한다 (마을 수만큼 쿼리하지 않는다).
  const memberCounts = new Map<string, number>()
  for (const u of usersSnap.docs) {
    const ids: string[] = u.data().communityIds || []
    for (const id of ids) memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1)
  }

  const commDocs = [...commSnap.docs].sort(
    (a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0)
  )

  const communities: PublicCommunity[] = commDocs.map((doc) => {
    const c = doc.data()
    return {
      id: doc.id,
      name: c.name ?? '',
      communityType: c.communityType ?? '',
      regionName: c.regionName ?? '',
      sido: c.sido ?? '',
      sigungu: c.sigungu ?? '',
      // Firestore에는 평평한 lat/lng로 저장된다.
      // 중첩 location을 읽으면 항상 null이 되어 지도에 마커가 뜨지 않는다.
      lat: c.lat ?? c.location?.lat ?? null,
      lng: c.lng ?? c.location?.lng ?? null,
      coverImageUrl: c.coverImageUrl ?? null,
      description: c.description ?? null,
      memberCount: memberCounts.get(doc.id) ?? 0,
    }
  })

  const feed = await fetchGlobalFeed(20)

  return { communities, feed }
}

/** 60초 캐시. 마을 소식은 실시간일 필요가 없고, 첫 화면 체감이 훨씬 중요하다. */
export const getHomeData = unstable_cache(loadHomeData, ['home-data-v1'], {
  revalidate: 60,
  tags: ['home-data'],
})
