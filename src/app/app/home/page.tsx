import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Camera, ChevronRight, Gamepad2, MapPin, MessageCircle, Sparkles, Users } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { AppShell } from '@/components/app-shell'
import { CommunityBadge } from '@/components/community-badge'
import { InviteLinkButton } from '@/components/invite-link-button'
import { PhotoWithExif } from '@/components/exif-overlay'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { communityTypeMeta, formatKoreanDate, formatKoreanTime, relativeTime, toDate } from '@/lib/village'

export const dynamic = 'force-dynamic'

export default async function MemberHomePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/home')
  if (user.communities.length === 0) redirect('/onboarding')

  const sp = await searchParams
  const activeId = sp.c && user.communities.some((c) => c.id === sp.c) ? sp.c : user.communities[0].id

  // 마을 문서 → 카운트 3개 → 목록 3개를 세 단계로 순차 대기하고 있었다.
  // 서로 의존하지 않으므로 전부 한 번에 가져온다.
  const commRef = adminDb.collection('communities').doc(activeId)
  const [
    communityDoc,
    membersSnap,
    photosSnap,
    eventsSnap,
    photosResult,
    upcomingEventsResult,
    recentMessagesResult,
    digestDoc,
    historySnap,
    vacantCountSnap,
  ] = await Promise.all([
    commRef.get(),
    adminDb.collection('users').where('communityIds', 'array-contains', activeId).count().get(),
    commRef.collection('photos').count().get(),
    commRef.collection('events').count().get(),
    commRef.collection('photos').orderBy('createdAt', 'desc').limit(6).get(),
    commRef
      .collection('events')
      .where('startAt', '>=', new Date())
      .orderBy('startAt', 'asc')
      .limit(3)
      .get(),
    commRef.collection('messages').orderBy('createdAt', 'desc').limit(5).get(),
    // 마을 홈페이지에만 있던 내용을 이 화면으로 합친다.
    adminDb
      .collection('dailyDigests')
      .doc(`${activeId}_${new Date().toISOString().slice(0, 10)}`)
      .get(),
    adminDb
      .collection('villageHistory')
      .where('communityId', '==', activeId)
      .orderBy('date', 'desc')
      .limit(1)
      .get(),
    adminDb
      .collection('vacantHouses')
      .where('communityId', '==', activeId)
      .where('status', '==', '게시중')
      .count()
      .get(),
  ])
  if (!communityDoc.exists) redirect('/app/home')
  const community = communityDoc.data()!

  const communityCount = {
    members: membersSnap.data().count,
    photos: photosSnap.data().count,
    events: eventsSnap.data().count,
  }

  const todayDigest = digestDoc.exists ? digestDoc.data() : null
  const latestHistory = historySnap.empty ? null : historySnap.docs[0].data()
  const vacantCount = vacantCountSnap.data().count

  const photos = photosResult.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const upcomingEvents = upcomingEventsResult.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const recentMessages = recentMessagesResult.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  const recentGameResults = recentMessages
    .filter((m: any) => m.type === 'game_result')
    .slice(0, 2)
    .map((m: any) => ({
      ...m,
      payload:
        m.gameResultPayload && m.gameResultPayload !== 'null'
          ? (typeof m.gameResultPayload === 'string' ? JSON.parse(m.gameResultPayload) : m.gameResultPayload)
          : null,
    }))

  const meta = communityTypeMeta(community.communityType)

  return (
    <AppShell
      title="마을홈"
      right={
        community.inviteCode ? (
          <InviteLinkButton
            inviteCode={community.inviteCode}
            communityName={community.name}
          />
        ) : undefined
      }
    >
      <div className="px-3 py-3">
        {/* Community switcher */}
        {user.communities.length > 1 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {user.communities.map((c) => {
              const m = communityTypeMeta(c.communityType)
              const active = c.id === activeId
              return (
                <Link
                  key={c.id}
                  href={`/app/home?c=${c.id}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                  }`}
                >
                  <span>{m.emoji}</span> {c.name}
                </Link>
              )
            })}
          </div>
        )}

        {/* 히어로 — 배너를 배경으로, 마스코트는 프로필처럼 원형으로 겹친다.
            배너가 없으면 공동체 색 그라데이션으로 대체해 흰 사각형이 생기지 않게 한다. */}
        <div className="relative overflow-hidden rounded-3xl">
          <div className="h-40 w-full">
            {community.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={community.coverImageUrl} alt={community.name} className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}66)` }}
              />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-white">
            {/* 마스코트(없으면 이모지)를 원형 프로필로 */}
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white/90 text-3xl shadow-lg"
            >
              {community.mascotImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={community.mascotImageUrl}
                  alt={`${community.name} 마스코트`}
                  className="h-full w-full object-cover"
                />
              ) : (
                meta.emoji
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="mb-0.5 flex items-center gap-2">
                <CommunityBadge type={community.communityType} size="sm" />
                <span className="inline-flex items-center gap-0.5 text-xs text-white/90">
                  <Users className="h-3 w-3" /> {communityCount.members}
                </span>
              </div>
              <h2 className="truncate text-xl font-black leading-tight">{community.name}</h2>
              <p className="flex items-center gap-1 text-[11px] text-white/85">
                <MapPin className="h-3 w-3 shrink-0" /> {community.regionName}
              </p>
            </div>
          </div>
        </div>

        {/* 주 행동 — 채팅이 가장 크게. 나머지는 아래 통합 흐름과 겹치지 않는 것만. */}
        <Link
          href={`/app/chat/${activeId}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        >
          <MessageCircle className="h-5 w-5" /> 채팅방 들어가기
        </Link>

        {/* 오늘의 마을 소식 (AI 신문) — 마을 홈페이지에 있던 내용을 합쳤다 */}
        {/* ① 오늘의 마을 소식 (AI 신문) */}
        {todayDigest && (
          <Link
            href={`/village/${activeId}/news/${todayDigest.date}`}
            className="mt-4 block rounded-2xl border border-primary/40 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> 오늘의 마을 소식
            </p>
            <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
              {todayDigest.summaryText}
            </p>
          </Link>
        )}

        {/* ② 다가오는 행사 */}
        {upcomingEvents.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <Calendar className="h-4 w-4 text-primary" /> 다가오는 행사
              </h3>
            </div>
            <div className="space-y-2">
              {upcomingEvents.map((ev: any) => {
                const startDate = toDate(ev.startAt)
                return (
                  <div key={ev.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15">
                      <span className="text-[9px] font-medium text-muted-foreground">{formatKoreanDate(startDate).split(' ')[1]}</span>
                      <span className="text-base font-black leading-none">{startDate.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{ev.title}</p>
                      {ev.location && <p className="text-xs text-muted-foreground">{ev.location}</p>}
                      <p className="text-[11px] text-muted-foreground">{formatKoreanTime(startDate)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 마을 사진 — 격자 대신 SNS 피드 형식으로 크게 보여준다 */}
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <Camera className="h-4 w-4 text-primary" /> 마을 사진
            </h3>
            <Link
              href={`/village/${activeId}/timeline`}
              className="text-xs text-muted-foreground hover:underline"
            >
              전체보기 <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              아직 사진이 없어요. 채팅방에서 올려보세요!
            </div>
          ) : (
            <div className="space-y-4">
              {photos.map((p: any) => (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold">
                      {(p.uploaderName ?? '?').slice(0, 1)}
                    </div>
                    <span className="truncate text-sm font-semibold">
                      {p.uploaderName ?? '익명'}
                    </span>
                    {p.createdAt && (
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(toDate(p.createdAt))}
                      </span>
                    )}
                  </div>
                  <PhotoWithExif
                    src={p.thumbnailUrl || p.storageUrl}
                    alt={p.aiCaption || p.uploaderName}
                    exif={{
                      takenAt: p.exif?.takenAt ?? p.exifTakenAt,
                      device: p.exif?.deviceModel ?? p.exifDevice,
                      location: p.exifAddress ?? null,
                    }}
                  />
                  {p.aiCaption && (
                    <p className="px-3 py-2.5 text-sm">{p.aiCaption}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Recent game results */}
        {recentGameResults.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Gamepad2 className="h-4 w-4 text-primary" /> 최근 게임 결과
            </h3>
            <div className="space-y-2">
              {recentGameResults.map((g: any) => (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">{g.payload?.gameType}</p>
                  <p className="text-sm font-semibold">{g.payload?.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.payload?.resultSummary}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ③ 마을 더보기 — 자주 안 쓰는 기록성 메뉴를 한 카드로 묶는다. */}
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-bold">마을 더보기</h3>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <MoreLink
              href={`/village/${activeId}/timeline`}
              emoji="🗓"
              title="타임라인"
              desc="날짜별 마을 활동 모아보기"
            />
            <MoreLink
              href={`/village/${activeId}/history`}
              emoji="📜"
              title="마을 역사"
              desc={
                latestHistory
                  ? (latestHistory.title ?? latestHistory.summary ?? 'AI가 기록한 마을 이야기')
                  : 'AI가 기록한 마을 이야기'
              }
            />
            {vacantCount > 0 && (
              <MoreLink
                href={`/village/${activeId}/vacant-houses`}
                emoji="🏠"
                title="우리동네 빈집소개"
                desc={`${vacantCount}곳`}
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

/** 마을 더보기 안의 링크 한 줄 */
function MoreLink({
  href,
  emoji,
  title,
  desc,
}: {
  href: string
  emoji: string
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
