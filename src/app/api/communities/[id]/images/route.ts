import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { generateCommunityImage, type ImageKind } from '@/lib/image-gen'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 20 * 1024 * 1024

function canManage(
  user: { realRole: string; realAdminCommunities: string[] },
  communityId: string
) {
  return user.realRole === 'superadmin' || user.realAdminCommunities.includes(communityId)
}

/** 배너는 가로로 넓게, 마스코트는 정사각으로 다듬는다. */
async function normalize(kind: ImageKind, input: Buffer) {
  const img = sharp(input).rotate()
  if (kind === 'banner') {
    return img.resize(1600, 900, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
  }
  // 마스코트는 배경 투명을 살릴 수 있게 png로 둔다.
  return img.resize(600, 600, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
}

/**
 * 마을 배너·마스코트 설정.
 *
 * 두 가지 방법을 지원한다.
 *  - 직접 올리기: multipart로 파일 전송
 *  - AI로 만들기: mode=generate 와 (선택) prompt 전송
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params
  if (!canManage(user, id)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const commRef = adminDb.collection('communities').doc(id)
  const commDoc = await commRef.get()
  if (!commDoc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }
  const community = commDoc.data()!

  const form = await req.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const kindRaw = String(form.get('kind') ?? '')
  if (kindRaw !== 'banner' && kindRaw !== 'mascot') {
    return NextResponse.json({ error: '배너 또는 마스코트만 설정할 수 있어요.' }, { status: 400 })
  }
  const kind = kindRaw as ImageKind
  const mode = String(form.get('mode') ?? 'upload')

  let source: Buffer

  if (mode === 'generate') {
    const result = await generateCommunityImage(
      kind,
      {
        name: community.name ?? '',
        communityType: community.communityType ?? '',
        regionName: community.regionName ?? '',
      },
      String(form.get('prompt') ?? '')
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, needsSetup: result.needsSetup ?? false },
        { status: result.needsSetup ? 503 : 502 }
      )
    }
    source = result.buffer
  } else {
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지를 선택해주세요.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '이미지가 너무 커요 (20MB 이하).' }, { status: 400 })
    }
    source = Buffer.from(await file.arrayBuffer())
  }

  let processed: Buffer
  try {
    processed = await normalize(kind, source)
  } catch {
    return NextResponse.json({ error: '이미지를 처리하지 못했어요.' }, { status: 400 })
  }

  // 파일명에 임의값을 넣어 교체 후에도 예전 이미지가 캐시로 남지 않게 한다.
  const ext = kind === 'banner' ? 'jpg' : 'png'
  const objectPath = `communities/${id}/${kind}_${randomUUID()}.${ext}`
  const bucket = adminStorage.bucket()
  await bucket.file(objectPath).save(processed, {
    contentType: kind === 'banner' ? 'image/jpeg' : 'image/png',
    public: true,
  })

  const url = `https://storage.googleapis.com/${bucket.name}/${objectPath}`
  const field = kind === 'banner' ? 'coverImageUrl' : 'mascotImageUrl'

  // 예전 파일 정리 (실패해도 진행)
  const prevUrl: string | undefined = community[field]
  if (prevUrl?.includes(`/communities/${id}/`)) {
    const prevPath = prevUrl.split(`${bucket.name}/`)[1]
    if (prevPath) await bucket.file(prevPath).delete().catch(() => {})
  }

  await commRef.update({ [field]: url })

  return NextResponse.json({ ok: true, kind, url })
}

/** 배너·마스코트 제거 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params
  if (!canManage(user, id)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const kind = new URL(req.url).searchParams.get('kind')
  if (kind !== 'banner' && kind !== 'mascot') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const commRef = adminDb.collection('communities').doc(id)
  const doc = await commRef.get()
  if (!doc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없어요.' }, { status: 404 })
  }

  const field = kind === 'banner' ? 'coverImageUrl' : 'mascotImageUrl'
  const url: string | undefined = doc.data()![field]
  const bucket = adminStorage.bucket()
  if (url?.includes(`/communities/${id}/`)) {
    const objectPath = url.split(`${bucket.name}/`)[1]
    if (objectPath) await bucket.file(objectPath).delete().catch(() => {})
  }

  await commRef.update({ [field]: null })
  return NextResponse.json({ ok: true })
}
