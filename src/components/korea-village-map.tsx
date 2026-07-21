'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Search, MapPin, Users, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
import { LinkPendingOverlay } from '@/components/link-pending'
import { communityTypeMeta } from '@/lib/village'
import { cn } from '@/lib/utils'
import 'leaflet/dist/leaflet.css'

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

// 기본 뷰는 제주도가 화면 중앙에 오도록 한다.
const DEFAULT_CENTER: [number, number] = [33.38, 126.55]
const DEFAULT_ZOOM = 10

// OSM 타일 사용 정책상 출처 표기는 필수다.
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'

export function KoreaVillageMap({
  communities,
  children,
}: {
  communities: PublicCommunity[]
  /** 지도와 마을 목록 사이에 끼워 넣을 영역(마을 소식 피드). */
  children?: React.ReactNode
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  // 지도는 비동기로 생성되므로, 마커 effect가 생성 완료를 기다리도록 상태로 알린다.
  const [ready, setReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const router = useRouter()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const leafletRef = useRef<typeof import('leaflet') | null>(null)

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

  // 지도 초기화 (한 번만)
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    let cancelled = false
    ;(async () => {
      try {
        // 번들러에 따라 CJS default interop 결과가 달라져 둘 다 대응한다.
        const mod = await import('leaflet')
        const L = ((mod as unknown as { default?: typeof import('leaflet') }).default ??
          mod) as typeof import('leaflet')
        if (cancelled || !containerRef.current || mapRef.current) return

        leafletRef.current = L
        const map = L.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          scrollWheelZoom: true, // 지도 위에서 스크롤하면 줌
          attributionControl: true,
        })
        L.tileLayer(OSM_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map)
        mapRef.current = map
        setReady(true)
      } catch (e) {
        console.error('[korea-village-map] 지도 초기화 실패:', e)
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
      setReady(false)
    }
  }, [])

  // 마커 동기화 (검색 결과가 바뀔 때마다)
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    for (const marker of markersRef.current.values()) marker.remove()
    markersRef.current.clear()

    const missingCoords = filtered.filter(
      (c) => typeof c.lat !== 'number' || typeof c.lng !== 'number'
    )
    if (missingCoords.length > 0) {
      // 좌표가 없으면 지도에서 조용히 사라져 원인을 찾기 어렵다.
      console.warn(
        '[korea-village-map] 좌표가 없어 마커를 표시하지 못한 마을:',
        missingCoords.map((c) => c.name)
      )
    }

    for (const c of filtered) {
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue
      const meta = communityTypeMeta(c.communityType)

      // 고령 사용자도 누르기 쉽도록 실제 점보다 넓은 터치 영역을 준다.
      const icon = L.divIcon({
        className: 'village-marker',
        html: `<span class="village-marker__dot" style="background:${meta.color}"></span>
               <span class="village-marker__label">${escapeHtml(c.name)}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })

      const marker = L.marker([c.lat, c.lng], { icon, title: c.name })
        .addTo(map)
        .on('click', () => {
          // window.location은 전체 새로고침이라 눌러도 멈칫한다.
          // 클라이언트 전환이면 loading.tsx 스켈레톤이 즉시 뜬다.
          router.push(`/village/${c.id}`)
        })
        .on('mouseover', () => setActive(c.id))
        .on('mouseout', () => setActive(null))

      markersRef.current.set(c.id, marker)
    }

    // 검색으로 좁혀지면 결과에 맞춰 뷰를 이동
    const points = filtered
      .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
      .map((c) => [c.lat, c.lng] as [number, number])

    if (points.length > 0 && query.trim()) {
      map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 13 })
    }
  }, [filtered, query, ready, router])

  // 리스트 hover ↔ 마커 강조 연동
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement()
      if (el) el.classList.toggle('village-marker--active', id === active)
    }
  }, [active])

  const mapPanel = (
    // 소식 영역과 높이를 맞추기 위해 컨테이너가 높이를 갖고 지도가 남은 공간을 채운다.
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card">
        <div
          ref={containerRef}
          className={cn(
            'w-full flex-1',
            // 다크모드에서 타일이 눈부시지 않도록 살짝 눌러준다.
            resolvedTheme === 'dark' && 'leaflet-dark'
          )}
        />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border px-2 py-2 text-xs text-muted-foreground">
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
  )

  const listPanel = (
      <div id="village-list" className="flex flex-col gap-3 scroll-mt-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="마을 이름, 지역, 공동체 검색"
            className="rounded-full pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            검색된 마을이 없어요.
          </div>
        ) : (
          // 정사각 배너를 좌우로 밀어서 넘긴다. 스크롤바는 감추고 스냅을 준다.
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filtered.map((c) => {
              const meta = communityTypeMeta(c.communityType)
              return (
                <Link
                  key={c.id}
                  href={`/village/${c.id}`}
                  onMouseEnter={() => setActive(c.id)}
                  onMouseLeave={() => setActive(null)}
                  className={cn(
                    'group relative aspect-square w-40 shrink-0 snap-start overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-48',
                    active === c.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  )}
                >
                  <LinkPendingOverlay />

                  {/* 배경: 커버 사진이 없으면 공동체 색과 이모지로 채운다 */}
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.coverImageUrl}
                      alt={c.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-5xl"
                      style={{ background: `${meta.color}22` }}
                    >
                      {meta.emoji}
                    </div>
                  )}

                  {/* 글자가 읽히도록 아래쪽을 어둡게 깔아준다 */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-2.5 pt-8 text-white">
                    <div className="flex items-center gap-1.5">
                      <CommunityBadge type={c.communityType} size="sm" />
                      {c.memberCount != null && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-white/85">
                          <Users className="h-3 w-3" /> {c.memberCount}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-bold leading-tight">{c.name}</h3>
                    <p className="flex items-center gap-1 truncate text-[11px] text-white/80">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.regionName}</span>
                    </p>
                  </div>

                  <ArrowUpRight className="absolute right-2 top-2 h-4 w-4 text-white/80 drop-shadow transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
  )

  // 지도와 소식을 같은 높이로 나란히 두고, 마을은 그 아래 정사각 배너로 깐다.
  // 모바일에서는 지도 → 소식 순으로 쌓이되 높이는 동일하게 유지한다.
  return (
    <div className="space-y-5">
      {/* 모바일은 세로로 쌓이므로 각 칸에 높이를 주고,
          데스크톱에서는 한 줄에 나란히 놓여 같은 높이를 갖는다. */}
      <div className="grid gap-4 lg:h-[72vh] lg:grid-cols-2">
        <div className="h-[50vh] lg:h-full">{mapPanel}</div>
        {/* 소식은 이 칸 안에서만 스크롤된다 */}
        <div className="h-[50vh] overflow-y-auto rounded-2xl border border-border bg-muted/20 p-2 lg:h-full">
          {children}
        </div>
      </div>

      {listPanel}
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
