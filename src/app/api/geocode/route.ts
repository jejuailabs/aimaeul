import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * 주소 → 좌표 변환.
 *
 * 마을을 만들 때 지도를 손으로 찾아 찍게 하면 어렵고 부정확하다.
 * "제주특별자치도 제주시 조천읍 조천리"처럼 입력한 주소를 좌표로 바꿔
 * 지도가 알아서 그 자리로 가도록 한다.
 *
 * OpenStreetMap Nominatim을 쓴다(사진 위치 변환에서 이미 쓰고 있다).
 * 사용 정책상 User-Agent 표기가 필요하고, 남용을 막기 위해 로그인 사용자만 허용한다.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}` +
      `&format=json&limit=5&countrycodes=kr&accept-language=ko`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AiMaeul/1.0 (village community platform)' },
      // 같은 주소를 반복 조회하지 않도록 잠시 캐시한다.
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      console.error('[geocode] Nominatim 오류:', res.status)
      return NextResponse.json({ results: [] })
    }

    const data = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>

    return NextResponse.json({
      results: data.map((d) => ({
        lat: Number(d.lat),
        lng: Number(d.lon),
        label: d.display_name,
      })),
    })
  } catch (e) {
    console.error('[geocode] 변환 실패:', e)
    return NextResponse.json({ results: [] })
  }
}
