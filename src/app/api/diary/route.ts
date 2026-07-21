import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_PHOTOS = 4

/**
 * 개인 일기장.
 *
 * 다른 사람이 절대 볼 수 없어야 하므로:
 *  - 문서를 users/{uid}/diaries 하위에만 둔다 (공용 컬렉션에 섞지 않는다)
 *  - 사진은 공개 URL을 만들지 않고 비공개 경로에 저장한 뒤,
 *    본인 확인을 거친 서명 URL로만 내려준다
 */

/** 일기 목록 조회. 본인 것만 나온다. */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM (달력 보기용)

  let query = adminDb
    .collection('users')
    .doc(user.uid)
    .collection('diaries')
    .orderBy('date', 'desc') as FirebaseFirestore.Query

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query = query.where('date', '>=', `${month}-01`).where('date', '<=', `${month}-31`)
  }

  const snap = await query.limit(200).get()

  return NextResponse.json({
    entries: snap.docs.map((d) => {
      const e = d.data()
      return {
        id: d.id,
        date: e.date,
        text: e.text ?? '',
        mood: e.mood ?? null,
        photoPaths: e.photoPaths ?? [],
        audioPath: e.audioPath ?? null,
        createdAt: e.createdAt?.toDate?.()?.toISOString() ?? null,
      }
    }),
  })
}

/** 일기 작성. 텍스트 + 사진(선택). */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const text = String(form.get('text') ?? '').trim()
  const mood = String(form.get('mood') ?? '').trim() || null
  const dateRaw = String(form.get('date') ?? '').trim()
  const files = form.getAll('photos').filter((f): f is File => f instanceof File)
  const audio = form.get('audio')
  const audioFile = audio instanceof File ? audio : null

  if (!text && files.length === 0 && !audioFile) {
    return NextResponse.json({ error: '내용이나 사진을 넣어주세요.' }, { status: 400 })
  }
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `사진은 최대 ${MAX_PHOTOS}장까지 넣을 수 있어요.` },
      { status: 400 }
    )
  }

  // 날짜는 YYYY-MM-DD 형식만 허용하고, 없으면 오늘로 둔다.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10)

  const id = randomUUID()
  const bucket = adminStorage.bucket()
  const photoPaths: string[] = []

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '사진이 너무 커요 (20MB 이하).' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    // 원본을 그대로 두지 않고 크기를 줄여 저장 비용과 로딩을 줄인다.
    const jpeg = await sharp(buf)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()

    const path = `diaries/${user.uid}/${id}/${randomUUID()}.jpg`
    // public: true 를 절대 쓰지 않는다 — 링크만 알면 누구나 보게 된다.
    await bucket.file(path).save(jpeg, { contentType: 'image/jpeg' })
    photoPaths.push(path)
  }

  // 음성 인식이 안 되는 기기(특히 iOS)에서는 목소리를 그대로 남길 수 있게 한다.
  let audioPath: string | null = null
  if (audioFile) {
    if (audioFile.size > MAX_BYTES) {
      return NextResponse.json({ error: '녹음이 너무 길어요.' }, { status: 400 })
    }
    const buf = Buffer.from(await audioFile.arrayBuffer())
    // 확장자는 브라우저가 준 MIME을 그대로 따른다(webm/mp4 등).
    const ext = (audioFile.type.split('/')[1] || 'webm').split(';')[0]
    audioPath = `diaries/${user.uid}/${id}/voice.${ext}`
    await bucket.file(audioPath).save(buf, { contentType: audioFile.type || 'audio/webm' })
  }

  await adminDb
    .collection('users')
    .doc(user.uid)
    .collection('diaries')
    .doc(id)
    .set({
      diaryId: id,
      date,
      text,
      mood,
      photoPaths,
      audioPath,
      createdAt: FieldValue.serverTimestamp(),
    })

  return NextResponse.json({ ok: true, id, date, text, mood, photoPaths, audioPath })
}
