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
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const AI_MODEL = 'claude-sonnet-4-20250514'

/**
 * Fire-and-forget: reverse geocode GPS coordinates via Nominatim (OpenStreetMap).
 * Stores the result as exifAddress on the photo document.
 */
async function reverseGeocodeInBackground(
  photoRef: FirebaseFirestore.DocumentReference,
  lat: number,
  lng: number,
) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AiMaeul/1.0' },
    })
    if (!res.ok) {
      console.error('[photo-geocode] Nominatim error:', res.status)
      return
    }
    const data = await res.json()
    const address = data.display_name as string | undefined
    if (address) {
      await photoRef.update({ exifAddress: address })
    }
  } catch (e) {
    console.error('[photo-geocode] Reverse geocoding failed (non-blocking):', e)
  }
}

/**
 * Fire-and-forget: send the thumbnail to Claude Vision API to generate
 * aiTags and aiCaption, then update the Firestore photo document.
 */
async function generateAiTagsInBackground(
  photoRef: FirebaseFirestore.DocumentReference,
  thumbBuf: Buffer,
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  try {
    const base64Image = thumbBuf.toString('base64')

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `이 사진을 분석하여 아래 JSON 형식으로만 응답해주세요. 한국어로 작성해주세요.
{
  "aiCaption": "사진을 설명하는 한 문장",
  "aiTags": ["키워드1", "키워드2", "..."]
}
aiCaption은 사진의 내용을 자연스럽게 설명하는 한국어 한 문장이어야 합니다.
aiTags는 사진과 관련된 한국어 키워드 5~10개의 배열이어야 합니다.
JSON 외에 다른 텍스트를 포함하지 마세요.`,
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      console.error('[photo-ai] Claude API error:', res.status, await res.text())
      return
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    const rawText = textBlock?.text
    if (!rawText) return

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || rawText)

    const aiCaption: string | null = typeof parsed.aiCaption === 'string' ? parsed.aiCaption : null
    const aiTags: string = Array.isArray(parsed.aiTags)
      ? JSON.stringify(parsed.aiTags)
      : '[]'

    await photoRef.update({ aiCaption, aiTags })
  } catch (e) {
    console.error('[photo-ai] AI tagging failed (non-blocking):', e)
  }
}

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

  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif')

  let originalBuf: Buffer
  let thumbBuf: Buffer
  try {
    const pipeline = sharp(buf, { failOnError: false }).rotate()
    if (isHeic) pipeline.toFormat('jpeg')
    originalBuf = await pipeline.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    thumbBuf = await pipeline.clone().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
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
    exifAddress: null as string | null,
    aiTags: '[]',
    aiCaption: null,
    createdAt: FieldValue.serverTimestamp(),
  }

  await photoRef.set(photoData)

  // Fire-and-forget: generate AI tags/caption without blocking the upload response
  generateAiTagsInBackground(photoRef, thumbBuf).catch(() => {})

  // Fire-and-forget: reverse geocode GPS coordinates without blocking the upload response
  if (exifLat != null && exifLng != null) {
    reverseGeocodeInBackground(photoRef, exifLat, exifLng).catch(() => {})
  }

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
