import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params

  const reportDoc = await adminDb.collection('reports').doc(id).get()
  if (!reportDoc.exists) {
    return NextResponse.json({ error: '제보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const report = reportDoc.data()!

  const commDoc = await adminDb.collection('communities').doc(report.communityId).get()
  const comm = commDoc.data()

  if (report.reporterId !== user.uid) {
    const userDoc = await adminDb.collection('users').doc(user.uid).get()
    const userData = userDoc.data() || {}
    const isAdmin = userData.adminCommunities?.includes(report.communityId)
    if (!isAdmin) {
      return NextResponse.json({ error: '열람 권한이 없습니다.' }, { status: 403 })
    }
  }

  return NextResponse.json({
    report: {
      id: reportDoc.id,
      ...report,
      createdAt: report.createdAt?.toDate?.()?.toISOString?.() ?? null,
      community: comm
        ? { id: commDoc.id, name: comm.name, regionName: comm.regionName, communityType: comm.communityType }
        : null,
    },
  })
}
