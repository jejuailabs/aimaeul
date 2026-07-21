import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, Home as HomeIcon, MapPin, Users, Sparkles, Camera, Gamepad2, ArrowRight, Building2, Clock } from 'lucide-react'
import { adminDb } from '@/lib/firebase-admin'
import { getCurrentUser } from '@/lib/session'
import { ThemeToggle } from '@/components/theme-toggle'
import { AuthHeaderActions } from '@/components/auth-header-actions'
import { attachCommentsToPhotos } from '@/lib/photo-comments'
import { CommunityBadge } from '@/components/community-badge'
import { PhotoWithExif } from '@/components/exif-overlay'
import { LiveChatPanel } from '@/components/live-chat-panel'
import { Button } from '@/components/ui/button'
import {
  communityTypeMeta,
  formatKoreanDate,
  formatKoreanTime,
  formatRent,
  relativeTime,
  toDate,
} from '@/lib/village'
import type { PhotoData } from '@/components/message-bubble'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string }>
}): Promise<Metadata> {
  const { communityId } = await params
  const doc = await adminDb.collection('communities').doc(communityId).get()
  if (!doc.exists) return { title: '마을을 찾을 수 없어요' }
  const c = doc.data()!
  return {
    title: `${c.name} — 우리마을`,
    description: c.description || `${c.regionName} ${c.name}의 활동을 실시간으로 만나보세요.`,
    openGraph: {
      title: c.name,
      description: c.description || `${c.regionName} ${c.communityType}`,
      images: c.coverImageUrl ? [{ url: c.coverImageUrl }] : [],
    },
  }
}

export default async function VillageHomePage({
  params,
}: {
  params: Promise<{ communityId: string }>
}) {
  const { communityId } = await params
  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) notFound()
  const community = commDoc.data()!

  const user = await getCurrentUser()
  const isMember = user ? user.communities.some((c) => c.id === communityId) : false

  if (!community.isPublic && !isMember) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <Link href="/" className="text-sm font-semibold text-muted-foreground">← 마을 지도</Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <AuthHeaderActions />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-4xl">🔒</div>
          <h1 className="text-xl font-bold">비공개 마을입니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {community.name}은 비공개 커뮤니티예요.<br />
            초대코드가 있으면 로그인 후 참여할 수 있어요.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/login?callbackUrl=/onboarding">로그인하고 참여하기</Link>
          </Button>
        </main>
        <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
          우리마을 — 마을 공동체 플랫폼
        </footer>
      </div>
    )
  }

  const meta = communityTypeMeta(community.communityType)

  const membersSnap = await adminDb
    .collection('users')
    .where('communityIds', 'array-contains', communityId)
    .get()

  const photosSnap = await adminDb
    .collection('communities')
    .doc(communityId)
    .collection('photos')
    .orderBy('createdAt', 'desc')
    .limit(12)
    .get()

  const messagesSnap = await adminDb
    .collection('communities')
    .doc(communityId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(30)
    .get()

  const photos = photosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

  // 사진 직후에 이어진 대화를 그 사진의 코멘트로 묶는다.
  // 사진과 대화가 따로 놓이면 어떤 사진에 대한 말인지 알 수 없다.
  const { commentsByPhoto } = attachCommentsToPhotos(
    photos.map((p: any) => ({ id: p.id, createdAtMs: p.createdAt?.toMillis?.() ?? 0 })),
    messagesSnap.docs.map((d) => {
      const m = d.data()
      return {
        id: d.id,
        createdAtMs: m.createdAt?.toMillis?.() ?? 0,
        authorName: m.authorName ?? '익명',
        authorPhotoURL: m.authorPhotoURL ?? null,
        text: m.text ?? '',
        createdAt: m.createdAt?.toDate?.()?.toISOString() ?? null,
        type: m.type,
      }
    })
  )

  const photoMap = new Map<string, PhotoData>()
  const initialMessages = messagesSnap.docs.map((d) => {
    const data = d.data()
    if (data.photoId) {
      const photoDoc = photos.find((p: any) => p.id === data.photoId)
      if (photoDoc) {
        photoMap.set(data.photoId, {
          id: photoDoc.id,
          storageUrl: photoDoc.storageUrl ?? '',
          thumbnailUrl: photoDoc.thumbnailUrl ?? '',
          uploaderName: photoDoc.uploaderName ?? undefined,
          exifTakenAt: photoDoc.exifTakenAt?.toDate?.()?.toISOString?.() ?? null,
          exifLat: photoDoc.exifLat ?? null,
          exifLng: photoDoc.exifLng ?? null,
          exifDevice: photoDoc.exifDevice ?? null,
          exifLens: photoDoc.exifLens ?? null,
          exifAddress: photoDoc.exifAddress ?? null,
          aiCaption: photoDoc.aiCaption ?? null,
        })
      }
    }
    return {
      id: d.id,
      communityId,
      authorUid: data.authorUid ?? '',
      authorName: data.authorName ?? '',
      authorPhotoURL: data.authorPhotoURL ?? null,
      type: data.type ?? 'text',
      text: data.text ?? null,
      photoId: data.photoId ?? null,
      emojiUrl: data.emojiUrl ?? null,
      gameResultPayload: data.gameResultPayload ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    }
  })

  const eventsSnap = await adminDb
    .collection('events')
    .where('communityId', '==', communityId)
    .where('startAt', '>=', new Date())
    .orderBy('startAt', 'asc')
    .limit(4)
    .get()

  const upcomingEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]

  const gameResults = initialMessages
    .filter((m) => m.type === 'game_result')
    .slice(-3)
    .reverse()

  const today = new Date().toISOString().slice(0, 10)
  const digestDoc = await adminDb.collection('dailyDigests').doc(`${communityId}_${today}`).get()
  const todayDigest = digestDoc.exists ? digestDoc.data() : null

  const vacantSnap = await adminDb
    .collection('vacantHouses')
    .where('communityId', '==', communityId)
    .where('status', '==', '게시중')
    .get()
  const vacantCount = vacantSnap.size

  const historySnap = await adminDb
    .collection('villageHistory')
    .where('communityId', '==', communityId)
    .orderBy('date', 'desc')
    .limit(1)
    .get()
  const historyCount = historySnap.size
  const latestHistory = historySnap.empty ? null : historySnap.docs[0].data()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-muted-foreground">← 마을 지도</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <AuthHeaderActions
            chatHref={isMember ? `/app/chat/${communityId}` : '/app/chat'}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <section className="relative overflow-hidden rounded-3xl">
          {community.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.coverImageUrl} alt={community.name} className="h-48 w-full object-cover sm:h-64" />
          ) : (
            <div className="flex h-48 items-center justify-center bg-muted text-6xl sm:h-64">{meta.emoji}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="mb-1 flex items-center gap-2">
              <CommunityBadge type={community.communityType} size="sm" />
              <span className="inline-flex items-center gap-0.5 text-xs">
                <Users className="h-3 w-3" /> {membersSnap.size}
              </span>
            </div>
            <h1 className="text-2xl font-black leading-tight drop-shadow sm:text-3xl">{community.name}</h1>
            <p className="mt-0.5 flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" /> {community.regionName}
            </p>
          </div>
        </section>

        {community.description && (
          <p className="mt-3 rounded-2xl bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
            {community.description}
          </p>
        )}

        {todayDigest && (
          <Link
            href={`/village/${communityId}/news/${today}`}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3 transition-colors hover:bg-primary/15"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">오늘의 마을 소식 (AI 신문)</p>
              <p className="truncate text-xs text-muted-foreground">{todayDigest.summaryText}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <Link
          href={`/village/${communityId}/history`}
          className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Clock className="h-5 w-5 text-primary-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">마을 히스토리</p>
            <p className="truncate text-xs text-muted-foreground">
              {latestHistory ? latestHistory.title : 'AI가 기록한 마을 역사'}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-base font-bold">
              <Camera className="h-4 w-4 text-primary" /> 마을 사진
            </h2>
            {photos.length > 0 && (
              <Link href={`/village/${communityId}/timeline`} className="text-xs text-muted-foreground hover:underline">
                타임라인 보기 →
              </Link>
            )}
          </div>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              아직 올라온 사진이 없어요.
            </div>
          ) : (
            <div className="snap-y snap-mandatory overflow-y-auto rounded-3xl border border-border bg-card p-3" style={{ maxHeight: '70vh' }}>
              <div className="space-y-3">
                {photos.map((p: any) => (
                  <div key={p.id} className="snap-start">
                    <PhotoWithExif
                      src={p.thumbnailUrl || p.storageUrl}
                      alt={p.aiCaption || `${p.uploaderName}님의 사진`}
                      exif={{
                        takenAt: p.exifTakenAt?.toDate?.() ?? null,
                        lat: p.exifLat,
                        lng: p.exifLng,
                        device: p.exifDevice,
                        lens: p.exifLens,
                        location: p.exifAddress ?? null,
                      }}
                      uploaderName={p.uploaderName}
                    />
                    {p.aiCaption && (
                      <p className="mt-1 px-1 text-xs text-muted-foreground">{p.aiCaption}</p>
                    )}
                    {/* 이 사진에 바로 이어진 대화 */}
                    {(commentsByPhoto.get(p.id) ?? []).length > 0 && (
                      <div className="mt-1.5 space-y-1 px-1">
                        {(commentsByPhoto.get(p.id) ?? []).map((c) => (
                          <div key={c.id} className="flex items-start gap-1.5">
                            <span className="mt-1 shrink-0 text-[11px] font-semibold text-muted-foreground">
                              {c.authorName}
                            </span>
                            <span className="inline-block rounded-2xl rounded-tl-md bg-muted/70 px-2.5 py-1 text-sm">
                              {c.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-5">
          <LiveChatPanel
            communityId={communityId}
            initialMessages={initialMessages}
            photoMap={photoMap}
            communityName={community.name}
            readOnly={!isMember}
            loggedIn={!!user}
          />
        </section>

        {upcomingEvents.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
              <Calendar className="h-4 w-4 text-primary" /> 다가오는 행사
            </h2>
            <div className="space-y-2">
              {upcomingEvents.map((ev: any) => {
                const startDate = toDate(ev.startAt)
                return (
                  <div key={ev.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 text-primary-foreground/80">
                      <span className="text-[10px] font-medium">{formatKoreanDate(startDate).split(' ')[1]}</span>
                      <span className="text-lg font-black leading-none">{startDate.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{ev.title}</p>
                      {ev.location && (
                        <p className="text-xs text-muted-foreground">
                          <MapPin className="mr-0.5 inline h-3 w-3" />{ev.location}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatKoreanTime(startDate)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {gameResults.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
              <Gamepad2 className="h-4 w-4 text-primary" /> 최근 게임 결과
            </h2>
            <div className="space-y-2">
              {gameResults.map((g) => (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{g.gameResultPayload?.gameType}</p>
                  <p className="font-semibold">{g.gameResultPayload?.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {g.gameResultPayload?.resultSummary}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(g.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {community.isPublic && vacantCount > 0 && (
          <section className="mt-5">
            <Link
              href={`/village/${communityId}/vacant-houses`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Building2 className="h-5 w-5 text-primary-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">우리동네 빈집소개</p>
                <p className="text-xs text-muted-foreground">{vacantCount}개 매물 게시 중</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>
        )}
      </main>

      <footer className="mt-auto border-t border-border/60 bg-muted/30 py-4 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1">
          <HomeIcon className="h-3.5 w-3.5" /> {community.name} · 우리마을
        </p>
      </footer>
    </div>
  )
}
