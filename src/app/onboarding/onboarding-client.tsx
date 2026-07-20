'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Clock,
  Loader2,
  MapPin,
  Ticket,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { SIDO_LIST, SIGUNGU_BY_SIDO, COMMUNITY_TYPES } from '@/lib/regions'
import { toast } from 'sonner'

type PublicCommunity = {
  id: string
  name: string
  communityType: string
  regionName: string
  sido: string
  sigungu: string
  coverImageUrl: string | null
  description: string | null
  memberCount?: number
}

type PendingRequest = {
  id: string
  communityId: string
  communityName: string
  communityType: string
  regionName: string
}

export function OnboardingClient({
  communities,
  pendingRequests,
}: {
  communities: PublicCommunity[]
  pendingRequests: PendingRequest[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'search' | 'code'>('search')
  const [sido, setSido] = useState<string>('')
  const [sigungu, setSigungu] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [requesting, setRequesting] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingRequest[]>(pendingRequests)
  const [code, setCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // 실제로 마을이 존재하는 시도만 노출해 빈 선택지를 줄인다.
  const availableSido = useMemo(() => {
    const set = new Set(communities.map((c) => c.sido).filter(Boolean))
    return SIDO_LIST.filter((s) => set.has(s))
  }, [communities])

  const availableSigungu = useMemo(() => {
    if (!sido) return []
    const set = new Set(
      communities.filter((c) => c.sido === sido).map((c) => c.sigungu).filter(Boolean)
    )
    const known = SIGUNGU_BY_SIDO[sido] ?? []
    const ordered = known.filter((g) => set.has(g))
    // 데이터에만 있고 목록에 없는 값도 놓치지 않는다.
    const extra = [...set].filter((g) => !known.includes(g))
    return [...ordered, ...extra]
  }, [communities, sido])

  const filtered = useMemo(() => {
    return communities.filter((c) => {
      if (sido && c.sido !== sido) return false
      if (sigungu && c.sigungu !== sigungu) return false
      if (type && c.communityType !== type) return false
      return true
    })
  }, [communities, sido, sigungu, type])

  const pendingIds = new Set(pending.map((p) => p.communityId))

  async function requestJoin(communityId: string) {
    setRequesting(communityId)
    try {
      const res = await fetch('/api/membership-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 409 && data.already) {
        router.push(`/app/chat/${communityId}`)
        return
      }
      if (!res.ok) {
        toast.error(data.error || '가입 신청에 실패했어요.')
        return
      }

      const c = communities.find((x) => x.id === communityId)
      setPending((prev) => [
        ...prev,
        {
          id: data.id,
          communityId,
          communityName: c?.name ?? '',
          communityType: c?.communityType ?? '',
          regionName: c?.regionName ?? '',
        },
      ])
      toast.success('가입 신청을 보냈어요. 회장님이 승인하면 알려드릴게요.')
    } catch {
      toast.error('가입 신청 중 오류가 발생했어요.')
    } finally {
      setRequesting(null)
    }
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setCodeLoading(true)
    try {
      const res = await fetch('/api/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '초대코드를 확인해주세요.')
        return
      }
      // 초대코드는 회장이 직접 전달한 것이므로 승인 없이 바로 참여된다.
      toast.success('마을에 참여했어요!')
      router.push(`/app/chat/${data.communityId}`)
    } catch {
      toast.error('참여 중 오류가 발생했어요.')
    } finally {
      setCodeLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-muted-foreground">
          ← 마을 지도
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/app/me"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40"
          >
            내 정보
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {/* 승인 대기 안내 */}
        {pending.length > 0 && (
          <section className="mb-6 rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">승인 대기 중</h2>
            </div>
            <div className="space-y-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.communityName}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.regionName}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    대기 중
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              회장님이 승인하면 채팅방에 들어갈 수 있어요. 승인 후 이 화면을 새로고침해주세요.
            </p>
          </section>
        )}

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black">참여할 마을 찾기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            지역과 모임을 골라 가입 신청하거나, 받은 초대코드를 입력하세요.
          </p>
        </div>

        {/* Tabs */}
        <div className="mx-auto mb-6 flex max-w-xs gap-2 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setTab('search')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === 'search' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <MapPin className="h-4 w-4" /> 지역으로 찾기
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <Ticket className="h-4 w-4" /> 초대코드
          </button>
        </div>

        {tab === 'search' ? (
          <div className="space-y-4">
            {/* 1단계: 시도 */}
            <div>
              <label className="mb-2 block text-sm font-semibold">1. 시 / 도</label>
              <div className="flex flex-wrap gap-2">
                {availableSido.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSido(s === sido ? '' : s)
                      setSigungu('')
                    }}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      s === sido
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2단계: 시군구 — 시도를 골라야 나타난다 */}
            {sido && (
              <div>
                <label className="mb-2 block text-sm font-semibold">2. 시 / 군 / 구</label>
                <div className="flex flex-wrap gap-2">
                  {availableSigungu.map((g) => (
                    <button
                      key={g}
                      onClick={() => setSigungu(g === sigungu ? '' : g)}
                      className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                        g === sigungu
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3단계: 모임 종류 */}
            <div>
              {/* 2단계가 숨겨진 상태에서는 번호가 건너뛰지 않도록 맞춘다 */}
              <label className="mb-2 block text-sm font-semibold">
                {sido ? '3' : '2'}. 모임 종류
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t === type ? '' : t)}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      t === type
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 결과 */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">{filtered.length}개 마을</p>
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  조건에 맞는 마을이 없어요. 조건을 바꿔보세요.
                </div>
              ) : (
                filtered.map((c) => {
                  const isPending = pendingIds.has(c.id)
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold">{c.name}</h3>
                          <CommunityBadge type={c.communityType} size="sm" />
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {c.regionName}
                          {c.memberCount != null && (
                            <>
                              <span className="mx-1">·</span>
                              <Users className="h-3 w-3" /> {c.memberCount}명
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        onClick={() => requestJoin(c.id)}
                        disabled={isPending || requesting === c.id}
                        variant={isPending ? 'outline' : 'default'}
                        className="shrink-0 rounded-xl"
                      >
                        {requesting === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isPending ? (
                          <>
                            <Check className="mr-1 h-4 w-4" /> 신청됨
                          </>
                        ) : (
                          '가입 신청'
                        )}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={joinByCode} className="mx-auto max-w-sm space-y-3">
            <div>
              <label className="text-sm font-medium">초대코드</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: SANEURI2024"
                className="mt-1 rounded-xl text-center text-lg tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-xl" disabled={codeLoading}>
              {codeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  참여하기 <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              초대코드로 참여하면 승인 없이 바로 입장해요.
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
