import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { createMessageAndBroadcast } from '@/lib/broadcast'
import sharp from 'sharp'
import exifr from 'exifr'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024

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

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const id = randomUUID()

  let exifTakenAt: Date | null = null
  let exifLat: number | null = null
  let exifLng: number | null = null
  let exifDevice: string | null = null
  let exifLens: string | null = null
  let exifRaw = '{}'
  try {
    const exif = await exifr.parse(buf, { tiff: true, exif: true, gps: true })
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
  } catch { /* ignore EXIF errors */ }

  const bucket = adminStorage.bucket()

  let originalBuf: Buffer
  let thumbBuf: Buffer
  try {
    originalBuf = await sharp(buf, { failOnError: false })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer()
    thumbBuf = await sharp(buf, { failOnError: false })
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
  } catch {
    originalBuf = buf
    thumbBuf = buf
  }

  const originalFile = bucket.file(`photos/${communityId}/${id}.jpg`)
  const thumbFile = bucket.file(`photos/${communityId}/${id}_thumb.jpg`)

  await Promise.all([
    originalFile.save(originalBuf, { contentType: 'image/jpeg', public: true }),
    thumbFile.save(thumbBuf, { contentType: 'image/jpeg', public: true }),
  ])

  const storageUrl = `https://storage.googleapis.com/${bucket.name}/photos/${communityId}/${id}.jpg`
  const thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/photos/${communityId}/${id}_thumb.jpg`

  const photoRef = adminDb
    .collection('communities')
    .doc(communityId)
    .collection('photos')
    .doc(id)

  const photoData = {
    communityId,
    uploaderId: user.uid,
    uploaderName: user.displayName,
    storageUrl,
    thumbnailUrl,
    exifTakenAt: exifTakenAt ?? null,
    exifLat,
    exifLng,
    exifDevice,
    exifLens,
    exifRaw,
    aiTags: '[]',
    aiCaption: null,
    createdAt: FieldValue.serverTimestamp(),
  }

  await photoRef.set(photoData)

  if (broadcast) {
    await createMessageAndBroadcast({
      communityId,
      authorUid: user.uid,
      authorName: user.displayName,
      authorPhotoURL: user.photoURL,
      type: 'photo',
      photoId: id,
    })
  }

  return NextResponse.json({ ok: true, photo: { id, ...photoData } })
}
