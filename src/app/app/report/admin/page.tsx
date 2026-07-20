import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, AlertTriangle, Clock, CheckCircle2, Send } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { ThemeToggle } from '@/components/theme-toggle'
import { ReportAdminClient } from './report-admin-client'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  '접수': { icon: AlertTriangle, color: 'text-yellow-500', label: '접수' },
  '안전신문고 전달완료': { icon: Send, color: 'text-blue-500', label: '전달완료' },
  '처리중': { icon: Clock, color: 'text-orange-500', label: '처리중' },
  '종료': { icon: CheckCircle2, color: 'text-green-500', label: '종료' },
}

export default async function ReportAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/report/admin')

  const userDoc = await adminDb.collection('users').doc(user.uid).get()
  const userData = userDoc.data() || {}
  const adminCommunities: string[] = userData.adminCommunities || []

  if (adminCommunities.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Shield className="mb-3 h-12 w-12 text-muted-foreground/50" />
        <h1 className="text-lg font-bold">관리자 권한이 없습니다</h1>
        <p className="mt-1 text-sm text-muted-foreground">제보 관리는 마을 관리자만 접근할 수 있어요.</p>
        <Link href="/app/report" className="mt-4 text-sm text-primary underline">← 제보하기로 돌아가기</Link>
      </div>
    )
  }

  const reportsSnap = await adminDb
    .collection('reports')
    .where('communityId', 'in', adminCommunities.slice(0, 10))
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  const reports = reportsSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      communityId: data.communityId,
      category: data.category || '기타',
      title: data.title || '(제목 없음)',
      content: data.content || '',
      reporterName: data.reporterName || '익명',
      status: data.status || '접수',
      adminNote: data.adminNote || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    }
  })

  const communityNames: Record<string, string> = {}
  for (const cid of adminCommunities) {
    const c = user.communities.find((x) => x.id === cid)
    if (c) communityNames[cid] = c.name
    else {
      const cDoc = await adminDb.collection('communities').doc(cid).get()
      if (cDoc.exists) communityNames[cid] = cDoc.data()!.name
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link href="/app/report" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> 제보하기
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">제보 관리</span>
        </div>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <ReportAdminClient reports={reports} communityNames={communityNames} />
      </main>
    </div>
  )
}
