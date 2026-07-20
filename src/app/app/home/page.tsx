import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Camera, ChevronRight, Gamepad2, MapPin, MessageCircle, Users, Building2, Plus } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { AppShell } from '@/components/app-shell'
import { CommunityBadge } from '@/components/community-badge'
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

  const communityDoc = await adminDb.collection('communities').doc(activeId).get()
  if (!communityDoc.exists) redirect('/app/home')
  const community = communityDoc.data()!

  // Get counts
  const [membersSnap, photosSnap, eventsSnap] = await Promise.all([
    adminDb.collection('users').where('communityIds', 'array-contains', activeId).count().get(),
    adminDb.collection('communities').doc(activeId).collection('photos').count().get(),
    adminDb.collection('communities').doc(activeId).collection('events').count().get(),
  ])
  const communityCount = {
    members: membersSnap.data().count,
    photos: photosSnap.data().count,
    events: eventsSnap.data().count,
  }

  const [photosResult, upcomingEventsResult, recentMessagesResult] = await Promise.all([
    adminDb
      .collection('communities').doc(activeId).collection('photos')
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get(),
    adminDb
      .collection('communities').doc(activeId).collection('events')
      .where('startAt', '>=', new Date())
      .orderBy('startAt', 'asc')
      .limit(3)
      .get(),
    adminDb
      .collection('communities').doc(activeId).collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get(),
  ])

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
    <AppShell title="마을홈">
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

        {/* Community card */}
        <div className="relative overflow-hidden rounded-3xl">
          {community.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.coverImageUrl} alt={community.name} className="h-36 w-full object-cover" />
          ) : (
            <div className="flex h-36 items-center justify-center bg-muted text-5xl">{meta.emoji}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <div className="mb-1 flex items-center gap-2">
              <CommunityBadge type={community.communityType} size="sm" />
              <span className="inline-flex items-center gap-0.5 text-xs">
                <Users className="h-3 w-3" /> {communityCount.members}
              </span>
            </div>
            <h2 className="text-lg font-black">{community.name}</h2>
            <p className="flex items-center gap-1 text-[11px]">
              <MapPin className="h-3 w-3" /> {community.regionName}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { href: `/app/chat/${activeId}`, icon: MessageCircle, label: '채팅' },
            { href: `/app/photos?c=${activeId}`, icon: Camera, label: '사진' },
            { href: `/app/games?communityId=${activeId}`, icon: Gamepad2, label: '게임' },
            { href: `/village/${activeId}`, icon: Building2, label: '홈페이지' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-3 text-xs transition-colors hover:bg-muted/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <a.icon className="h-4 w-4 text-primary-foreground/70" />
              </div>
              {a.label}
            </Link>
          ))}
        </div>

        {/* Upcoming events */}
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

        {/* Recent photos */}
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <Camera className="h-4 w-4 text-primary" /> 최근 사진
            </h3>
            <Link href={`/app/photos?c=${activeId}`} className="text-xs text-muted-foreground hover:underline">
              전체보기 <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              아직 사진이 없어요. 채팅방에서 올려보세요!
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.slice(0, 6).map((p: any) => (
                <PhotoWithExif
                  key={p.id}
                  src={p.thumbnailUrl || p.storageUrl}
                  alt={p.aiCaption || p.uploaderName}
                  exif={{ takenAt: p.exif?.takenAt ?? p.exifTakenAt, device: p.exif?.deviceModel ?? p.exifDevice }}
                  rounded
                  className="aspect-square"
                />
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

        <Link
          href="/onboarding"
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <Plus className="h-4 w-4" /> 새 마을 참여하기
        </Link>
      </div>
    </AppShell>
  )
}
