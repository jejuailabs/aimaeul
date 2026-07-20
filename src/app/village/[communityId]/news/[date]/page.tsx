import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Camera, Sparkles, Tag } from 'lucide-react'
import { adminDb } from '@/lib/firebase-admin'
import { communityTypeMeta, formatKoreanDate } from '@/lib/village'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string; date: string }>
}): Promise<Metadata> {
  const { communityId, date } = await params
  const doc = await adminDb.collection('communities').doc(communityId).get()
  if (!doc.exists) return { title: '마을 소식' }
  const community = doc.data()!
  return {
    title: `${date} 마을 소식 — ${community.name}`,
    description: `${community.name}의 ${date} 일일 소식입니다.`,
  }
}

export default async function DailyNewsPage({
  params,
}: {
  params: Promise<{ communityId: string; date: string }>
}) {
  const { communityId, date } = await params

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

  const meta = communityTypeMeta(community.communityType)

  const digestDoc = await adminDb.collection('dailyDigests').doc(`${communityId}_${date}`).get()
  const digest = digestDoc.exists ? digestDoc.data()! : null

  let topPhotos: { id: string; thumbnailUrl: string; aiCaption: string | null; uploaderName: string }[] = []
  if (digest) {
    let photoIds: string[] = []
    try { photoIds = JSON.parse(digest.topPhotos || '[]') } catch { /* ignore */ }
    if (photoIds.length > 0) {
      for (const pid of photoIds) {
        const photoDoc = await adminDb
          .collection('communities').doc(communityId).collection('photos').doc(pid).get()
        if (photoDoc.exists) {
          const p = photoDoc.data()!
          topPhotos.push({
            id: photoDoc.id,
            thumbnailUrl: p.thumbnailUrl ?? '',
            aiCaption: p.aiCaption ?? null,
            uploaderName: p.uploaderName ?? '',
          })
        }
      }
    }
  }

  let eventHighlights: string[] = []
  let topKeywords: string[] = []
  if (digest) {
    try { eventHighlights = JSON.parse(digest.eventHighlights || '[]') } catch { /* ignore */ }
    try { topKeywords = JSON.parse(digest.topKeywords || '[]') } catch { /* ignore */ }
  }

  const displayDate = formatKoreanDate(new Date(date + 'T00:00:00'))

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
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-black">마을 소식</h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />{displayDate}
          </p>
          <p className="text-xs text-muted-foreground">{meta.emoji} {community.name} · {community.regionName}</p>
        </div>

        {!digest ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">이 날의 소식이 아직 생성되지 않았어요.</p>
            <p className="mt-1 text-sm text-muted-foreground">마을 관리자가 AI 소식을 생성하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-bold text-primary">오늘의 요약</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{digest.summaryText}</p>
            </section>

            {topPhotos.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Camera className="h-4 w-4 text-primary" /> 오늘의 사진
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {topPhotos.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnailUrl} alt={p.aiCaption || `${p.uploaderName}님의 사진`} className="aspect-square w-full object-cover" />
                      {p.aiCaption && <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">{p.aiCaption}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {eventHighlights.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Calendar className="h-4 w-4 text-primary" /> 행사 하이라이트
                </h2>
                <ul className="space-y-1.5">
                  {eventHighlights.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                      <span className="mt-0.5 text-primary">•</span>{e}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {topKeywords.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  <Tag className="h-4 w-4 text-primary" /> 주요 키워드
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {topKeywords.map((kw, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">#{kw}</span>
                  ))}
                </div>
              </section>
            )}

            {digest.tomorrowSchedulePreview && (
              <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <h2 className="mb-1 text-sm font-bold text-primary">내일 예정</h2>
                <p className="text-sm text-muted-foreground">{digest.tomorrowSchedulePreview}</p>
              </section>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              AI가 생성한 소식입니다.
            </p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        {community.name} · 우리마을
      </footer>
    </div>
  )
}
