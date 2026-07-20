import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BarChart3, Camera, Calendar, MessageSquare, Users, Tag, MapPin } from 'lucide-react'
import { adminDb } from '@/lib/firebase-admin'
import { communityTypeMeta } from '@/lib/village'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string; month: string }>
}): Promise<Metadata> {
  const { communityId, month } = await params
  const doc = await adminDb.collection('communities').doc(communityId).get()
  if (!doc.exists) return { title: '월간 소식' }
  const community = doc.data()!
  return {
    title: `${month} 월간 소식 — ${community.name}`,
    description: `${community.name}의 ${month} 월간 소식입니다.`,
  }
}

export default async function MonthlyDigestPage({
  params,
}: {
  params: Promise<{ communityId: string; month: string }>
}) {
  const { communityId, month } = await params

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

  const meta = communityTypeMeta(community.communityType)

  const digestDoc = await adminDb.collection('monthlyDigests').doc(`${communityId}_${month}`).get()
  const digest = digestDoc.exists ? digestDoc.data()! : null

  let topKeywords: string[] = []
  let topMembers: string[] = []
  let topPlaces: string[] = []
  if (digest) {
    try { topKeywords = JSON.parse(digest.topKeywords || '[]') } catch { /* ignore */ }
    try { topMembers = JSON.parse(digest.topMembers || '[]') } catch { /* ignore */ }
    try { topPlaces = JSON.parse(digest.topPlaces || '[]') } catch { /* ignore */ }
  }

  const [yearStr, monthStr] = month.split('-')
  const displayMonth = `${yearStr}년 ${parseInt(monthStr, 10)}월`

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link href={`/village/${communityId}`} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {community.name}
        </Link>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-black">월간 소식</h1>
          <p className="mt-1 text-sm text-muted-foreground">{displayMonth}</p>
          <p className="text-xs text-muted-foreground">{meta.emoji} {community.name} · {community.regionName}</p>
        </div>

        {!digest ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">이 달의 월간 소식이 아직 생성되지 않았어요.</p>
            <p className="mt-1 text-sm text-muted-foreground">마을 관리자가 월간 소식을 생성하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<MessageSquare className="h-5 w-5" />} label="대화" value={(digest.messageCount ?? 0).toLocaleString()} color="text-blue-500" />
              <StatCard icon={<Camera className="h-5 w-5" />} label="사진" value={(digest.photoCount ?? 0).toLocaleString()} color="text-green-500" />
              <StatCard icon={<Calendar className="h-5 w-5" />} label="행사" value={(digest.eventCount ?? 0).toLocaleString()} color="text-orange-500" />
              <StatCard icon={<Users className="h-5 w-5" />} label="신규 가입" value={(digest.newMemberCount ?? 0).toLocaleString()} color="text-purple-500" />
            </section>

            {digest.summaryText && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h2 className="mb-2 text-sm font-bold text-primary">이달의 요약</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{digest.summaryText}</p>
              </section>
            )}

            {topKeywords.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Tag className="h-4 w-4 text-primary" /> 주요 키워드</h2>
                <div className="flex flex-wrap gap-1.5">
                  {topKeywords.map((kw, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">#{kw}</span>
                  ))}
                </div>
              </section>
            )}

            {topMembers.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> 활발한 주민</h2>
                <div className="flex flex-wrap gap-2">
                  {topMembers.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</div>
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topPlaces.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" /> 주요 장소</h2>
                <div className="flex flex-wrap gap-1.5">
                  {topPlaces.map((place, i) => (
                    <span key={i} className="rounded-full border border-border bg-card px-3 py-1 text-xs">{place}</span>
                  ))}
                </div>
              </section>
            )}

            <p className="text-center text-[11px] text-muted-foreground">AI가 생성한 소식입니다.</p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        {community.name} · 우리마을
      </footer>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4">
      <div className={color}>{icon}</div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
