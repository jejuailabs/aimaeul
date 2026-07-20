import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react'
import { adminDb } from '@/lib/firebase-admin'
import { communityTypeMeta, formatKoreanDate } from '@/lib/village'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  '행사': { emoji: '🎉', color: 'text-yellow-600 dark:text-yellow-400' },
  '사건': { emoji: '🌟', color: 'text-blue-600 dark:text-blue-400' },
  '기록': { emoji: '📝', color: 'text-green-600 dark:text-green-400' },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string }>
}): Promise<Metadata> {
  const { communityId } = await params
  const doc = await adminDb.collection('communities').doc(communityId).get()
  if (!doc.exists) return { title: '마을 히스토리' }
  const community = doc.data()!
  return {
    title: `마을 히스토리 — ${community.name}`,
    description: `${community.name}의 마을 역사 기록입니다.`,
  }
}

export default async function VillageHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { communityId } = await params
  const { year: selectedYear } = await searchParams

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

  const meta = communityTypeMeta(community.communityType)

  // Fetch history items
  let query = adminDb
    .collection('villageHistory')
    .where('communityId', '==', communityId)
    .orderBy('date', 'desc')

  if (selectedYear) {
    query = query
      .where('date', '>=', `${selectedYear}-01-01`)
      .where('date', '<=', `${selectedYear}-12-31`)
  }

  const historySnap = await query.get()
  const historyItems = historySnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[]

  // Collect available years for filter
  const allSnap = await adminDb
    .collection('villageHistory')
    .where('communityId', '==', communityId)
    .orderBy('date', 'desc')
    .get()
  const yearsSet = new Set<string>()
  allSnap.docs.forEach((d) => {
    const date = d.data().date
    if (date) yearsSet.add(date.slice(0, 4))
  })
  const availableYears = [...yearsSet].sort((a, b) => b.localeCompare(a))

  // Fetch related photos for all items
  const allPhotoIds = new Set<string>()
  historyItems.forEach((item: any) => {
    const ids = item.relatedPhotoIds || []
    ids.forEach((pid: string) => allPhotoIds.add(pid))
  })

  const photoMap = new Map<string, { thumbnailUrl: string; aiCaption: string | null }>()
  for (const pid of allPhotoIds) {
    const photoDoc = await adminDb
      .collection('communities').doc(communityId).collection('photos').doc(pid).get()
    if (photoDoc.exists) {
      const p = photoDoc.data()!
      photoMap.set(pid, {
        thumbnailUrl: p.thumbnailUrl ?? p.storageUrl ?? '',
        aiCaption: p.aiCaption ?? null,
      })
    }
  }

  const currentYear = new Date().getFullYear().toString()

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
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-black">마을 히스토리</h1>
          <p className="text-xs text-muted-foreground">{meta.emoji} {community.name} · {community.regionName}</p>
        </div>

        {/* Year filter tabs */}
        {availableYears.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5">
            <Link
              href={`/village/${communityId}/history`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !selectedYear
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              전체
            </Link>
            {availableYears.map((y) => (
              <Link
                key={y}
                href={`/village/${communityId}/history?year=${y}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedYear === y
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {y}년
              </Link>
            ))}
          </div>
        )}

        {historyItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-muted-foreground">
              {selectedYear ? `${selectedYear}년의 기록이 없습니다.` : '아직 마을 히스토리가 없어요.'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              AI가 기념할 만한 사건을 자동으로 기록합니다.
            </p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />

            {historyItems.map((item: any) => {
              const catMeta = CATEGORY_META[item.category] || CATEGORY_META['기록']
              const relatedPhotos = (item.relatedPhotoIds || [])
                .map((pid: string) => photoMap.get(pid))
                .filter(Boolean)

              return (
                <div key={item.id} className="relative flex gap-4 pl-1">
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xs">
                    {catMeta.emoji}
                  </div>

                  <div className="flex-1 rounded-2xl border border-border bg-card p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={`rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium ${catMeta.color}`}>
                        {item.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatKoreanDate(new Date(item.date + 'T00:00:00'))}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>

                    {relatedPhotos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {relatedPhotos.slice(0, 3).map((photo: any, i: number) => (
                          <div key={i} className="overflow-hidden rounded-lg border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.thumbnailUrl}
                              alt={photo.aiCaption || '관련 사진'}
                              className="aspect-square w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          AI가 자동으로 기록한 마을 역사입니다.
        </p>
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        {community.name} · 우리마을
      </footer>
    </div>
  )
}
