import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, Home as HomeIcon, MapPin, Users, Sparkles, Camera, Gamepad2, ArrowRight, Building2 } from 'lucide-react'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ThemeToggle } from '@/components/theme-toggle'
import { CommunityBadge } from '@/components/community-badge'
import { PhotoWithExif } from '@/components/exif-overlay'
import { LiveChatPanel } from '@/components/live-chat-panel'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  communityTypeMeta,
  formatKoreanDate,
  formatKoreanTime,
  formatRent,
  relativeTime,
} from '@/lib/village'
import type { Photo } from '@prisma/client'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string }>
}): Promise<Metadata> {
  const { communityId } = await params
  const c = await db.community.findUnique({ where: { id: communityId } })
  if (!c) return { title: '마을을 찾을 수 없어요' }
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
  const community = await db.community.findUnique({
    where: { id: communityId },
    include: { _count: { select: { members: true, photos: true, events: true } } },
  })
  if (!community) notFound()

  const user = await getCurrentUser()
  const isMember = user
    ? !!(await db.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId: user.id } },
      }))
    : false

  // 비공개 커뮤니티 처리
  if (!community.isPublic && !isMember) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <Link href="/" className="text-sm font-semibold text-muted-foreground">← 마을 지도</Link>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-4xl">🔒</div>
          <h1 className="text-xl font-bold">비공개 마을입니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {community.name}은 비공개 커뮤니티예요.<br />
            초대코드가 있으면 로그인 후 참여할 수 있어요.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href={`/login?callbackUrl=/onboarding`}>로그인하고 참여하기</Link>
          </Button>
        </main>
        <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
          우리마을 — 마을 공동체 플랫폼
        </footer>
      </div>
    )
  }

  const meta = communityTypeMeta(community.communityType)

  // 최근 사진 (Live Feed 원천)
  const photos = await db.photo.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })

  // 최근 메시지 + 관련 사진
  const messages = await db.message.findMany({
    where: { communityId },
    orderBy: { createdAt: 'asc' },
    take: 30,
  })
  const photoIds = messages.map((m) => m.photoId).filter((x): x is string => !!x)
  const photoDocs = photoIds.length
    ? await db.photo.findMany({ where: { id: { in: photoIds } } })
    : []
  const photoMap = new Map<string, Photo>(photoDocs.map((p) => [p.id, p]))
  const initialMessages = messages.map((m) => ({
    ...m,
    gameResultPayload:
      m.gameResultPayload && m.gameResultPayload !== 'null'
        ? JSON.parse(m.gameResultPayload)
        : null,
  }))

  // 다가오는 행사
  const upcomingEvents = await db.event.findMany({
    where: { communityId, startAt: { gte: new Date() } },
    orderBy: { startAt: 'asc' },
    take: 4,
  })

  // 최근 게임 결과
  const gameResults = messages
    .filter((m) => m.type === 'game_result')
    .slice(-3)
    .reverse()
    .map((m) => ({
      ...m,
      payload:
        m.gameResultPayload && m.gameResultPayload !== 'null'
          ? JSON.parse(m.gameResultPayload)
          : null,
    }))

  // 오늘의 소식 (일일신문)
  const today = new Date().toISOString().slice(0, 10)
  const todayDigest = await db.dailyDigest.findUnique({
    where: { communityId_date: { communityId, date: today } },
  })

  // 빈집 요약
  const vacantCount = await db.vacantHouse.count({
    where: { communityId, status: '게시중' },
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-muted-foreground">
          ← 마을 지도
        </Link>
        <div className="flex items-center gap-2">
          {isMember && (
            <Button asChild size="sm" className="rounded-full">
              <Link href={`/app/chat/${communityId}`}>채팅 앱으로</Link>
            </Button>
          )}
          <ThemeToggle compact />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {/* Cover */}
        <section className="relative overflow-hidden rounded-3xl">
          {community.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.coverImageUrl}
              alt={community.name}
              className="h-48 w-full object-cover sm:h-64"
            />
          ) : (
            <div className="flex h-48 items-center justify-center bg-muted text-6xl sm:h-64">
              {meta.emoji}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="mb-1 flex items-center gap-2">
              <CommunityBadge type={community.communityType} size="sm" />
              <span className="inline-flex items-center gap-0.5 text-xs">
                <Users className="h-3 w-3" /> {community._count.members}
              </span>
            </div>
            <h1 className="text-2xl font-black leading-tight drop-shadow sm:text-3xl">
              {community.name}
            </h1>
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

        {/* 오늘의 소식 (AI 일일신문) */}
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

        {/* 사진 Live Feed (세로형 슬라이드) */}
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
                {photos.map((p) => (
                  <div key={p.id} className="snap-start">
                    <PhotoWithExif
                      src={p.thumbnailUrl || p.storageUrl}
                      alt={p.aiCaption || `${p.uploaderName}님의 사진`}
                      exif={{
                        takenAt: p.exifTakenAt,
                        lat: p.exifLat,
                        lng: p.exifLng,
                        device: p.exifDevice,
                        lens: p.exifLens,
                      }}
                      uploaderName={p.uploaderName}
                    />
                    {p.aiCaption && (
                      <p className="mt-1 px-1 text-xs text-muted-foreground">{p.aiCaption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Live Chat */}
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

        {/* 다가오는 행사 */}
        {upcomingEvents.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
              <Calendar className="h-4 w-4 text-primary" /> 다가오는 행사
            </h2>
            <div className="space-y-2">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 text-primary-foreground/80">
                    <span className="text-[10px] font-medium">{formatKoreanDate(ev.startAt).split(' ')[1]}</span>
                    <span className="text-lg font-black leading-none">{ev.startAt.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{ev.title}</p>
                    {ev.location && (
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="mr-0.5 inline h-3 w-3" />
                        {ev.location}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatKoreanTime(ev.startAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 게임 결과 하이라이트 */}
        {gameResults.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
              <Gamepad2 className="h-4 w-4 text-primary" /> 최근 게임 결과
            </h2>
            <div className="space-y-2">
              {gameResults.map((g) => (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{g.payload?.gameType}</p>
                  <p className="font-semibold">{g.payload?.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {g.payload?.resultSummary}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(g.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 빈집 요약 */}
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
