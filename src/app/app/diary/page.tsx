import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { getCurrentUser } from '@/lib/session'
import { DiaryClient } from './diary-client'

export const dynamic = 'force-dynamic'

export default async function DiaryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/diary')

  // 일기 데이터는 클라이언트에서 본인 세션으로만 불러온다.
  return (
    <AppShell title="내 일기장">
      <DiaryClient />
    </AppShell>
  )
}
