'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, MapPin, Users, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
import { communityTypeMeta } from '@/lib/village'
import { cn } from '@/lib/utils'

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

// 대한민국 위경도 → SVG 좌표 투영
const LNG_MIN = 124.5
const LNG_MAX = 132.0
const LAT_MIN = 33.0
const LAT_MAX = 38.9
const W = 360
const H = 720

function project(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H
  return { x, y }
}

// 단순화된 한반도 육지 실루엣 (인식 가능한 수준, 정확한 지형 아님)
const KOREA_PATH = `
M 150 40
C 170 30, 200 28, 220 38
L 235 55
L 245 70
L 255 90
L 268 110
L 280 140
L 288 175
L 300 210
L 312 250
L 318 290
L 320 330
L 315 365
L 305 395
L 295 425
L 285 460
L 275 495
L 262 525
L 248 550
L 235 565
L 222 575
L 210 580
L 198 575
L 188 560
L 178 540
L 168 515
L 158 485
L 150 450
L 144 415
L 140 380
L 138 345
L 136 310
L 134 275
L 130 240
L 124 205
L 118 170
L 112 138
L 108 110
L 112 85
L 120 62
L 135 48
Z
`

const JEJU_PATH = `
M 150 605
C 158 600, 172 601, 178 612
C 182 622, 180 635, 170 640
C 158 643, 148 638, 145 628
C 143 618, 146 608, 150 605
Z
`

export function KoreaVillageMap({
  communities,
}: {
  communities: PublicCommunity[]
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return communities
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.regionName.toLowerCase().includes(q) ||
        c.communityType.toLowerCase().includes(q)
    )
  }, [communities, query])

  const markers = filtered.map((c) => ({ ...c, ...project(c.lat, c.lng) }))

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* Map panel */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-primary/5 to-background p-2">
        <div className="relative mx-auto aspect-[1/2] w-full max-w-md">
          <svg
            viewBox={`0 0 ${W} ${H + 80}`}
            className="h-full w-full"
            role="img"
            aria-label="대한민국 마을 지도"
          >
            {/* sea */}
            <rect x="0" y="0" width={W} height={H + 80} fill="url(#sea)" />
            <defs>
              <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.97 0.02 220)" />
                <stop offset="100%" stopColor="oklch(0.93 0.03 220)" />
              </linearGradient>
              <radialGradient id="glow">
                <stop offset="0%" stopColor="#FEE500" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FEE500" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* land */}
            <path
              d={KOREA_PATH}
              className="fill-card stroke-border"
              strokeWidth={1.2}
            />
            <path
              d={JEJU_PATH}
              className="fill-card stroke-border"
              strokeWidth={1.2}
            />

            {/* markers */}
            {markers.map((m) => {
              const meta = communityTypeMeta(m.communityType)
              const isActive = active === m.id
              return (
                <g
                  key={m.id}
                  transform={`translate(${m.x}, ${m.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setActive(m.id)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => (window.location.href = `/village/${m.id}`)}
                >
                  {isActive && (
                    <circle r={20} fill="url(#glow)" />
                  )}
                  <circle
                    r={isActive ? 11 : 8}
                    fill={meta.color}
                    stroke="white"
                    strokeWidth={2}
                    className="transition-all"
                  />
                  <text
                    y={isActive ? -16 : -12}
                    textAnchor="middle"
                    className="pointer-events-none select-none fill-foreground text-[9px] font-semibold"
                  >
                    {m.name.length > 8 ? m.regionName.split(' ').slice(-2).join(' ') : m.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pb-1 text-xs text-muted-foreground">
          {Object.entries({
            부녀회: '#FEE500',
            청년회: '#34d399',
            노인회: '#f59e0b',
            동호회: '#60a5fa',
          }).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* List panel */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="마을 이름, 지역, 공동체 검색"
            className="rounded-full pl-9"
          />
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[70vh]">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              검색된 마을이 없어요.
            </div>
          )}
          {filtered.map((c) => {
            const meta = communityTypeMeta(c.communityType)
            return (
              <Link
                key={c.id}
                href={`/village/${c.id}`}
                onMouseEnter={() => setActive(c.id)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  'group flex gap-3 rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md',
                  active === c.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                )}
              >
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted"
                  style={{ boxShadow: `inset 0 0 0 2px ${meta.color}55` }}
                >
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.coverImageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
                      {meta.emoji}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold leading-tight">{c.name}</h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{c.regionName}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <CommunityBadge type={c.communityType} size="sm" />
                    {c.memberCount != null && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {c.memberCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
