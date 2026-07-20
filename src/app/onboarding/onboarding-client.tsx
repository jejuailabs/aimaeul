'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Ticket, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { KoreaVillageMap } from '@/components/korea-village-map'
import { toast } from 'sonner'

type PublicCommunity = {
  id: string
  name: string
  communityType: string
  regionName: string
  lat: number
  lng: number
  coverImageUrl: string | null
  description: string | null
  memberCount?: number
}

export function OnboardingClient({ communities }: { communities: PublicCommunity[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'map' | 'code'>('map')
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState<string | null>(null)

  async function join(communityId: string) {
    setJoining(communityId)
    const res = await fetch('/api/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId }),
    })
    setJoining(null)
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || '참여에 실패했어요.')
      return
    }
    toast.success(data.already ? '이미 참여 중인 마을이에요.' : '마을에 참여했어요! 🎉')
    router.push(`/app/chat/${communityId}`)
    router.refresh()
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoining('code')
    const res = await fetch('/api/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code.trim() }),
    })
    setJoining(null)
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || '초대코드를 확인해주세요.')
      return
    }
    toast.success('마을에 참여했어요! 🎉')
    router.push(`/app/chat/${data.communityId}`)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-muted-foreground">
          ← 마을 지도로
        </Link>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black">참여할 마을 선택</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            지도에서 마을을 골라거나, 초대코드를 입력하세요.
          </p>
        </div>

        {/* Tabs */}
        <div className="mx-auto mb-6 flex max-w-xs gap-2 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setTab('map')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <MapPin className="h-4 w-4" /> 지도에서 선택
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

        {tab === 'map' ? (
          <>
            <KoreaVillageMap communities={communities} />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              마을 카드를 누르면 참여할 수 있어요.
            </p>
            <div className="mx-auto mt-4 grid max-w-2xl gap-2">
              {communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.regionName}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => join(c.id)}
                    disabled={joining !== null}
                    className="rounded-full"
                  >
                    {joining === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        참여 <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <form
            onSubmit={joinByCode}
            className="mx-auto max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">초대코드</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: BONG2026"
                className="rounded-xl text-center text-lg font-bold tracking-widest"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-xl"
              size="lg"
              disabled={joining !== null || !code.trim()}
            >
              {joining === 'code' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  참여하기 <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              데모 초대코드: BONG2026 · HOPE2026 · TEA2026 · HIKE2026
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
