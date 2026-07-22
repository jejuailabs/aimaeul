import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { adminDb } from '@/lib/firebase-admin'
import { communityTypeMeta } from '@/lib/village'

export const dynamic = 'force-dynamic'

/** 바탕화면 아이콘으로 쓸 수 있는 크기만 허용한다. */
const ALLOWED = [192, 512]

/**
 * 마을 아이콘.
 *
 * 바탕화면 바로가기의 썸네일로 쓰인다.
 * 마스코트가 있으면 그것을, 없으면 마을 이름 첫 글자로 만든 아이콘을 준다.
 * 바로가기는 아이콘이 비면 흰 사각형으로 보이므로 항상 무언가를 돌려준다.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sizeParam = Number(new URL(req.url).searchParams.get('size') ?? 192)
  const size = ALLOWED.includes(sizeParam) ? sizeParam : 192

  const doc = await adminDb.collection('communities').doc(id).get()
  if (!doc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }
  const c = doc.data()!
  const meta = communityTypeMeta(c.communityType ?? '')

  let png: Buffer

  if (c.mascotImageUrl) {
    try {
      const res = await fetch(c.mascotImageUrl)
      if (!res.ok) throw new Error(String(res.status))
      const buf = Buffer.from(await res.arrayBuffer())
      // 바탕화면 아이콘은 정사각이어야 하고, 여백을 공동체 색으로 채운다.
      png = await sharp(buf)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .flatten({ background: meta.color })
        .png()
        .toBuffer()
    } catch {
      png = await fallbackIcon(c.name ?? '마을', meta.color, size)
    }
  } else {
    png = await fallbackIcon(c.name ?? '마을', meta.color, size)
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // 마스코트를 바꾸면 반영돼야 하므로 오래 캐시하지 않는다.
      'Cache-Control': 'public, max-age=300',
    },
  })
}

/** 마스코트가 없을 때 쓰는 기본 아이콘 — 공동체 색 배경 + 이름 첫 글자 */
async function fallbackIcon(name: string, color: string, size: number) {
  const letter = (name.trim()[0] ?? '마').replace(/[<>&"']/g, '')
  const fontSize = Math.round(size * 0.5)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${color}"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="#1a1a17">${letter}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}
