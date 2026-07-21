import Link from 'next/link'
import { MapPin, Sparkles, MessageCircle, Camera, Search } from 'lucide-react'
import { AuthHeaderActions } from '@/components/auth-header-actions'
import { PublicBottomNav } from '@/components/public-bottom-nav'
import { GlobalFeed } from '@/components/global-feed'
import { getHomeData } from '@/lib/home-data'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { KoreaVillageMap } from '@/components/korea-village-map'
import { SearchBar } from '@/components/search-bar'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  // 05 문서: 지도는 로그인 여부와 무관하게 항상 접근 가능해야 한다.
  // 로그인 직후 라우팅(/onboarding, /app/chat)은 /login에서 처리하므로
  // 여기서 리다이렉트하면 "마을 지도" 링크가 원래 화면으로 튕겨 나온다.
  // 세션 조회와 공개 데이터 조회를 병렬로 돌린다.
  // 순차로 두면 왕복 시간이 그대로 더해져 첫 화면이 몇 초씩 걸린다.
  const [user, homeData] = await Promise.all([getCurrentUser(), getHomeData()])

  const { communities: publicCommunities, feed } = homeData

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          {/* 좁은 화면에서 로고가 줄바꿈되지 않도록 고정 폭을 주지 않고 shrink를 막는다 */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
              마
            </span>
            <div className="leading-tight">
              <p className="whitespace-nowrap text-sm font-bold">우리마을</p>
              {/* 부제는 공간이 넉넉할 때만 노출 */}
              <p className="hidden whitespace-nowrap text-[10px] text-muted-foreground sm:block">
                마을 공동체 플랫폼
              </p>
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
        {/* Hero — 제목은 한 줄로, 설명은 그 아래 흐리게 */}
        <section className="mb-4 text-center">
          <h1 className="whitespace-nowrap text-xl font-black leading-tight sm:text-3xl">
            대한민국 마을, 지도로 만나보세요
          </h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> 카카오톡처럼 쓰는 마을 공동체 플랫폼
          </p>
        </section>

        {/* 지도(모바일 1/3) → 마을 소식(1/3, 내부 스크롤) → 마을 목록 */}
        <KoreaVillageMap communities={publicCommunities}>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-black">지금 마을에서는</h2>
              <span className="text-[11px] text-muted-foreground">전국 마을 최신 소식</span>
            </div>
            {/* 소식은 이 영역 안에서만 스크롤된다 */}
            <div className="max-h-[33vh] overflow-y-auto rounded-2xl border border-border bg-muted/20 p-2 lg:max-h-[60vh]">
              <GlobalFeed feed={feed} />
            </div>
          </section>
        </KoreaVillageMap>

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

      <PublicBottomNav />

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
