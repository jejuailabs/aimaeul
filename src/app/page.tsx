import Link from 'next/link'
import { MapPin, Sparkles, MessageCircle, Camera, Search } from 'lucide-react'
import { AuthHeaderActions } from '@/components/auth-header-actions'
import { GlobalFeed } from '@/components/global-feed'
import { fetchGlobalFeed } from '@/lib/global-feed'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { KoreaVillageMap } from '@/components/korea-village-map'
import { SearchBar } from '@/components/search-bar'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  // 05 문서: 지도는 로그인 여부와 무관하게 항상 접근 가능해야 한다.
  // 로그인 직후 라우팅(/onboarding, /app/chat)은 /login에서 처리하므로
  // 여기서 리다이렉트하면 "마을 지도" 링크가 원래 화면으로 튕겨 나온다.
  const user = await getCurrentUser()

  // isPublic + createdAt 복합 인덱스를 요구하지 않도록 정렬은 메모리에서 처리한다.
  // 공개 마을 수는 많지 않아 부담이 없다.
  const commSnap = await adminDb
    .collection('communities')
    .where('isPublic', '==', true)
    .get()

  const commDocs = [...commSnap.docs].sort(
    (a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0)
  )

  const feedItems = await fetchGlobalFeed(30)

  const publicCommunities = await Promise.all(
    commDocs.map(async (doc) => {
      const c = doc.data()
      const membersSnap = await adminDb
        .collection('users')
        .where('communityIds', 'array-contains', doc.id)
        .count()
        .get()
      return {
        id: doc.id,
        name: c.name,
        communityType: c.communityType,
        regionName: c.regionName,
        // Firestore에는 평평한 lat/lng로 저장된다.
        // 중첩 location을 읽으면 항상 null이 되어 지도에 마커가 하나도 뜨지 않는다.
        lat: c.lat ?? c.location?.lat ?? null,
        lng: c.lng ?? c.location?.lng ?? null,
        coverImageUrl: c.coverImageUrl ?? null,
        description: c.description ?? null,
        memberCount: membersSnap.data().count,
      }
    })
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
              마
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">우리마을</p>
              <p className="text-[10px] text-muted-foreground">마을 공동체 플랫폼</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <SearchBar communities={publicCommunities} />
            <ThemeToggle compact />
            <AuthHeaderActions />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Hero */}
        <section className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary-foreground/80">
            <Sparkles className="h-3.5 w-3.5" /> 카카오톡처럼 쓰는 마을 공동체 플랫폼
          </div>
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">
            대한민국 마을, 지도로 만나보세요
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            부녀회·청년회·노인회·동호회가 올리는 사진과 대화가 실시간으로 모여,
            <br className="hidden sm:block" /> AI가 자동으로 마을 아카이브를 만듭니다.
          </p>
        </section>

        {/* Map + list */}
        <KoreaVillageMap communities={publicCommunities} />

        {/* 전국 마을 통합 피드 */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">지금 마을에서는</h2>
            <span className="text-xs text-muted-foreground">전국 마을 최신 소식</span>
          </div>
          <div className="mx-auto max-w-xl">
            <GlobalFeed items={feedItems} />
          </div>
        </section>

        {/* Feature highlights */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: MessageCircle,
              title: '실시간 채팅',
              desc: '회원이 카카오톡처럼 대화하면 마을 홈페이지에 즉시 반영돼요.',
            },
            {
              icon: Camera,
              title: '사진 EXIF 자동',
              desc: '사진만 올리면 촬영일·위치·기기가 자동으로 표시돼요.',
            },
            {
              icon: Sparkles,
              title: 'AI 마을 신문',
              desc: 'AI가 매일 마을의 활동을 요약해 신문으로 만들어드려요.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                <f.icon className="h-5 w-5 text-primary-foreground/70" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mt-auto border-t border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> 우리마을 -- 마을 공동체 디지털 플랫폼
          </p>
          <p>회원가입은 Google 로그인 한 번으로 끝나요.</p>
        </div>
      </footer>
    </div>
  )
}
