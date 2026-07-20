import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { fetchVillageFeed } from '@/lib/village-feed'

export const revalidate = 300 // ISR: 5 min

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return NextResponse.json({ error: '비공개 마을입니다.' }, { status: 403 })
  }

  const feed = await fetchVillageFeed(communityId, community, dateParam)

  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
