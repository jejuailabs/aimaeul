import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { communityId, description, photoUrl } = body as {
    communityId?: string
    description?: string
    photoUrl?: string | null
  }

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }
  const desc = (description ?? '').trim()
  if (!desc) {
    return NextResponse.json({ error: '상황 설명을 입력해주세요.' }, { status: 400 })
  }
  if (desc.length > 1000) {
    return NextResponse.json({ error: '설명은 1000자 이내로 입력해주세요.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  let exifRaw = '{}'
  if (photoUrl) {
    const photosSnap = await adminDb
      .collection('communities')
      .doc(communityId)
      .collection('photos')
      .where('storageUrl', '==', photoUrl)
      .limit(1)
      .get()
    if (!photosSnap.empty) {
      exifRaw = photosSnap.docs[0].data().exifRaw || '{}'
    }
  }

  const reportRef = adminDb.collection('reports').doc()
  const reportData = {
    communityId,
    reporterId: user.uid,
    description: desc,
    photoUrl: photoUrl ?? null,
    exifRaw,
    status: '접수',
    createdAt: FieldValue.serverTimestamp(),
  }
  await reportRef.set(reportData)

  return NextResponse.json({ ok: true, report: { id: reportRef.id, ...reportData } })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const reportsSnap = await adminDb
    .collection('reports')
    .where('reporterId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  const reports = await Promise.all(
    reportsSnap.docs.map(async (doc) => {
      const d = doc.data()
      const commDoc = await adminDb.collection('communities').doc(d.communityId).get()
      const comm = commDoc.data()
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        community: comm
          ? { id: commDoc.id, name: comm.name, regionName: comm.regionName, communityType: comm.communityType }
          : null,
      }
    })
  )

  return NextResponse.json({ reports })
}
