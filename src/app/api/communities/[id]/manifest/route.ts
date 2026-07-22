import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { communityTypeMeta } from '@/lib/village'

export const dynamic = 'force-dynamic'

/**
 * 마을별 웹앱 매니페스트.
 *
 * 바탕화면에 바로가기를 만들면 이 정보로 이름과 아이콘이 정해진다.
 * 마을마다 달라야 하므로 정적 파일이 아니라 여기서 만들어 준다.
 * 눌렀을 때 곧바로 그 마을 채팅방이 열리도록 start_url을 잡는다.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const doc = await adminDb.collection('communities').doc(id).get()
  if (!doc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }
  const c = doc.data()!
  const meta = communityTypeMeta(c.communityType ?? '')
  const origin = new URL(req.url).origin

  const manifest = {
    // 바탕화면에 표시될 이름. 길면 잘리므로 short_name을 따로 둔다.
    name: `${c.name} · 우리마을`,
    short_name: c.name,
    description: c.description || `${c.regionName} ${c.communityType}`,
    // 바로가기를 누르면 목록이 아니라 채팅방이 바로 열린다.
    start_url: `${origin}/app/chat/${id}?source=homescreen`,
    scope: `${origin}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FDFCF7',
    theme_color: meta.color,
    icons: [
      {
        src: `${origin}/api/communities/${id}/icon?size=192`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${origin}/api/communities/${id}/icon?size=512`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
