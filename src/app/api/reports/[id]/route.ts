import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/reports/[id] — 단일 제보 (제보자 본인 또는 마을 admin 만 열람 가능)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params

  const report = await db.report.findUnique({
    where: { id },
    include: {
      community: {
        select: { id: true, name: true, regionName: true, communityType: true },
      },
    },
  })

  if (!report) {
    return NextResponse.json({ error: '제보를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한: 제보자 본인 OR 해당 마을 admin
  if (report.reporterId !== user.id) {
    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: report.communityId,
          userId: user.id,
        },
      },
      select: { role: true },
    })
    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: '열람 권한이 없습니다.' }, { status: 403 })
    }
  }

  return NextResponse.json({ report })
}
