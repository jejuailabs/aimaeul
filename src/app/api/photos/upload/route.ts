import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { createMessageAndBroadcast } from '@/lib/broadcast'
import sharp from 'sharp'
import { exifr } from 'exifr'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'photos')
const MAX_BYTES = 20 * 1024 * 1024 // 20MB

// POST /api/photos/upload  (multipart/form-data)
// fields: file (File), communityId (string), broadcast (string "true"|"false" 기본 true)
// 사진 저장 + 썸네일 생성 + EXIF 파싱 + Photo 문서 생성 + (기본) 채팅에 photo 메시지 브로드캐스트
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const form = await req.formData()
  const file = form.get('file') as File | null
  const communityId = form.get('communityId') as string | null
  const broadcast = (form.get('broadcast') as string) !== 'false'

  if (!file || !communityId) {
    return NextResponse.json({ error: 'file과 communityId가 필요합니다.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '파일이 20MB를 초과합니다.' }, { status: 413 })
  }

  // 멤버십 검증
  const member = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: user.id } },
  })
  if (!member) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const id = randomUUID()

  // EXIF 파싱 (실패해도 사진 저장은 진행)
  let exifTakenAt: Date | null = null
  let exifLat: number | null = null
  let exifLng: number | null = null
  let exifDevice: string | null = null
  let exifLens: string | null = null
  let exifRaw = '{}'
  try {
    const exif = await exifr.parse(buf, {
      tiff: true,
      exif: true,
      gps: true,
    })
    if (exif) {
      exifRaw = JSON.stringify(exif)
      if (exif.DateTimeOriginal) exifTakenAt = new Date(exif.DateTimeOriginal)
      if (exif.latitude != null) exifLat = exif.latitude
      if (exif.longitude != null) exifLng = exif.longitude
      if (exif.Make || exif.Model) {
        exifDevice = [exif.Make, exif.Model].filter(Boolean).join(' ').trim()
      }
      if (exif.LensModel) exifLens = exif.LensModel
    }
  } catch {
    // ignore EXIF errors
  }

  mkdirSync(UPLOAD_DIR, { recursive: true })

  // 원본 저장 (HEIC 등은 sharp 가 jpeg 로 변환)
  const originalPath = join(UPLOAD_DIR, `${id}.jpg`)
  const thumbnailPath = join(UPLOAD_DIR, `${id}_thumb.jpg`)
  try {
    await sharp(buf, { failOnError: false })
      .rotate() // EXIF orientation 반영
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(originalPath)
    await sharp(buf, { failOnError: false })
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(thumbnailPath)
  } catch (e) {
    console.error('[photos] sharp error', e)
    // 폴백: 원본 그대로 저장
    writeFileSync(originalPath, buf)
    writeFileSync(thumbnailPath, buf)
  }

  const storageUrl = `/uploads/photos/${id}.jpg`
  const thumbnailUrl = `/uploads/photos/${id}_thumb.jpg`

  const photo = await db.photo.create({
    data: {
      id,
      communityId,
      uploaderId: user.id,
      uploaderName: user.name,
      storageUrl,
      thumbnailUrl,
      exifTakenAt,
      exifLat,
      exifLng,
      exifDevice,
      exifLens,
      exifRaw,
      aiTags: JSON.stringify([]),
    },
  })

  // 기본: 채팅방에 photo 메시지 브로드캐스트 (04 문서: 사진 업로드 시 자동 메시지)
  if (broadcast) {
    await createMessageAndBroadcast({
      communityId,
      authorId: user.id,
      authorName: user.name,
      authorPhotoURL: user.photoURL,
      type: 'photo',
      photoId: photo.id,
    })
  }

  return NextResponse.json({ ok: true, photo })
}
