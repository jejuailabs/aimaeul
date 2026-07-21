import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { DiaryClient } from './diary-client'

export const dynamic = 'force-dynamic'

export default async function DiaryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/diary')

  // 화면이 뜬 뒤에 다시 불러오면 "아직 쓴 일기가 없어요"가 잠깐 보이거나
  // 로딩만 1초 돌아간다. 서버에서 미리 담아 첫 화면에 바로 그린다.
  const snap = await adminDb
    .collection('users')
    .doc(user.uid)
    .collection('diaries')
    .orderBy('date', 'desc')
    .limit(200)
    .get()

  const initialEntries = snap.docs.map((d) => {
    const e = d.data()
    return {
      id: d.id,
      date: e.date,
      text: e.text ?? '',
      mood: e.mood ?? null,
      photoPaths: e.photoPaths ?? [],
      audioPath: e.audioPath ?? null,
      createdAt: e.createdAt?.toDate?.()?.toISOString() ?? null,
    }
  })

  return (
    <AppShell title="내 일기장">
      <DiaryClient initialEntries={initialEntries} />
    </AppShell>
  )
}
