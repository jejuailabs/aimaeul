'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

const KOREA_CENTER: [number, number] = [36.3, 127.8]
const KOREA_ZOOM = 7

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'

/**
 * 마을 위치를 지도에서 찍어 좌표를 얻는 피커.
 * 좌표가 없으면 지도에 마커가 표시되지 않아 가입자에게도 보이지 않으므로,
 * 마을 생성 시 반드시 위치를 지정하게 한다.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null
  onChange: (v: { lat: number; lng: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)

  // 클릭 핸들러가 항상 최신 onChange를 보도록 ref로 유지한다.
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    let cancelled = false

    ;(async () => {
      try {
        const mod = await import('leaflet')
        const L = ((mod as unknown as { default?: typeof import('leaflet') }).default ??
          mod) as typeof import('leaflet')
        if (cancelled || !containerRef.current || mapRef.current) return

        leafletRef.current = L
        const map = L.map(containerRef.current, {
          center: value ? [value.lat, value.lng] : KOREA_CENTER,
          zoom: value ? 13 : KOREA_ZOOM,
          scrollWheelZoom: true, // 위치를 정확히 찍으려면 줌이 필요하다
        })
        L.tileLayer(OSM_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map)

        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })
        })

        mapRef.current = map
        setReady(true)
      } catch (e) {
        console.error('[location-picker] 지도 초기화 실패:', e)
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      setReady(false)
    }
    // 초기 1회만 생성한다. value 변경은 아래 effect가 마커로 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 선택된 좌표를 마커로 반영
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || !ready) return

    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    const icon = L.divIcon({
      className: 'village-marker',
      html: `<span class="village-marker__dot" style="background:#FEE500"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng])
    } else {
      markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map)
    }
  }, [value, ready])

  return (
    <div>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-2xl border border-border"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {value
          ? `선택한 위치: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : '지도를 눌러 마을 위치를 지정하세요.'}
      </p>
    </div>
  )
}
