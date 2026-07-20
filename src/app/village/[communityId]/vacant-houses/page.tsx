import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, MapPin, MessageCircle, ImageIcon } from 'lucide-react'
import { adminDb } from '@/lib/firebase-admin'
import { formatRent, relativeTime, communityTypeMeta, toDate } from '@/lib/village'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { CommunityBadge } from '@/components/community-badge'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ communityId: string }> }

async function getData(communityId: string) {
  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) return { community: null, listings: [] }

  const community = { id: commDoc.id, ...commDoc.data()! } as any

  if (!community.isPublic) {
    return { community, listings: [] }
  }

  const snap = await adminDb
    .collection('vacantHouses')
    .where('communityId', '==', communityId)
    .where('status', '==', '게시중')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  const listings = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

  return { community, listings }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { communityId } = await params
  const { community } = await getData(communityId)
  if (!community) return { title: '빈집 목록 — 우리마을' }
  const meta = communityTypeMeta(community.communityType)
  return {
    title: `${community.name} 빈집 — 우리마을`,
    description: `${community.regionName} ${community.name}(${meta.label}) 빈집 임대 정보.`,
    keywords: ['빈집', '임대', '전세', '월세', community.regionName, community.name, '시골 빈집', '귀농'],
    openGraph: {
      title: `${community.name} 빈집 — 우리마을`,
      description: `${community.regionName} ${community.name} 빈집 임대 정보`,
      type: 'website',
    },
  }
}

function parsePhotos(photosJson: string): string[] {
  try {
    const arr = JSON.parse(photosJson)
    if (Array.isArray(arr)) return arr.filter((p): p is string => typeof p === 'string')
  } catch { /* ignore */ }
  return []
}

export default async function PublicVacantHousesPage({ params }: Params) {
  const { communityId } = await params
  const { community, listings } = await getData(communityId)

  if (!community) notFound()

  if (!community.isPublic) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/95 px-2 py-2 backdrop-blur">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href={`/village/${communityId}`} aria-label="마을 홈으로"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="flex-1 truncate text-base font-semibold">빈집 안내</h1>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
          <div className="mb-3 text-5xl">🔒</div>
          <h2 className="text-lg font-bold">비공개 마을입니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">이 마을의 빈집 정보는 멤버에게만 공개됩니다.</p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/login?callbackUrl=/app/vacant-houses">로그인하고 보기</Link>
          </Button>
        </main>
        <PublicFooter />
      </div>
    )
  }

  const meta = communityTypeMeta(community.communityType)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/95 px-2 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href={`/village/${communityId}`} aria-label="마을 홈으로"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="flex-1 truncate text-base font-semibold">{community.name} 빈집</h1>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <section className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <CommunityBadge type={community.communityType} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {community.regionName}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black">{community.name} 빈집 안내</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.emoji} {community.regionName} {community.name}의 빈집 임대 정보를 한자리에서 확인하세요.
          </p>
        </section>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
            <div className="mb-2 text-4xl">🏠</div>
            <p className="font-semibold">현재 게시 중인 빈집이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">마을 회원이 새로운 빈집을 등록하면 여기에 표시됩니다.</p>
            <Button asChild className="mt-5 rounded-full">
              <Link href="/login?callbackUrl=/app/vacant-houses">로그인하고 빈집 등록하기</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {listings.map((l: any) => {
              const photos = parsePhotos(l.photos)
              const cover = photos[0]
              return (
                <li key={l.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={`${community.name} 빈집 사진`} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    {photos.length > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white backdrop-blur">
                        <ImageIcon className="mr-0.5 inline h-3 w-3" /> {photos.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <p className="text-base font-bold">{formatRent(l.monthlyRent, l.deposit)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <MapPin className="mr-0.5 inline h-3 w-3" />{community.regionName} · {community.name}
                    </p>
                    {l.description && (
                      <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{l.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">등록 {relativeTime(toDate(l.createdAt))}</p>
                    <Button asChild size="sm" className="mt-2 w-full rounded-xl">
                      <Link href={`/login?callbackUrl=/app/chat/${communityId}`}>
                        <MessageCircle className="h-3.5 w-3.5" /> 채팅으로 문의하기
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}

function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
        <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> 우리마을 — 마을 공동체 디지털 플랫폼</p>
        <p>회원가입은 Google 로그인 한 번으로 끝나요.</p>
      </div>
    </footer>
  )
}
