'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Search, MapPin, Users, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
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

// 대한민국 전체가 들어오는 초기 뷰
const KOREA_CENTER: [number, number] = [36.3, 127.8]
const KOREA_ZOOM = 7

// OSM 타일 사용 정책상 출처 표기는 필수다.
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'

export function KoreaVillageMap({ communities }: { communities: PublicCommunity[] }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  // 지도는 비동기로 생성되므로, 마커 effect가 생성 완료를 기다리도록 상태로 알린다.
  const [ready, setReady] = useState(false)
  const { resolvedTheme } = useTheme()

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
          center: KOREA_CENTER,
          zoom: KOREA_ZOOM,
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

    for (const c of filtered) {
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue
      const meta = communityTypeMeta(c.communityType)

      const icon = L.divIcon({
        className: 'village-marker',
        html: `<span class="village-marker__dot" style="background:${meta.color}"></span>
               <span class="village-marker__label">${escapeHtml(c.name)}</span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const marker = L.marker([c.lat, c.lng], { icon, title: c.name })
        .addTo(map)
        .on('click', () => {
          window.location.href = `/village/${c.id}`
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
  }, [filtered, query, ready])

  // 리스트 hover ↔ 마커 강조 연동
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement()
      if (el) el.classList.toggle('village-marker--active', id === active)
    }
  }, [active])

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* Map panel */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div
          ref={containerRef}
          className={cn(
            'h-[420px] w-full lg:h-[70vh]',
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
