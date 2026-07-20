import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { ReportClient } from './report-client'

export const dynamic = 'force-dynamic'

export default async function ReportPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/report')

  const communities = user.communities.map((c) => ({
    id: c.id,
    name: c.name,
    communityType: c.communityType,
    regionName: c.regionName,
  }))

  if (communities.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="text-5xl">🏘</div>
        <h1 className="text-xl font-bold">참여 중인 마을이 없어요</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          제보를 올리려면 먼저 마을에 참여해주세요.
        </p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/onboarding">마을 참여하기</Link>
        </Button>
      </div>
    )
  }

  return <ReportClient communities={communities} userName={user.name} />
}
