import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const communityId = url.searchParams.get('communityId')

  if (!communityId) {
    return NextResponse.json({ error: 'communityId가 필요합니다.' }, { status: 400 })
  }

  const commDoc = await adminDb.collection('communities').doc(communityId).get()
  if (!commDoc.exists) {
    return NextResponse.json({ error: '마을을 찾을 수 없습니다.' }, { status: 404 })
  }

  const emojiPackIds: string[] = commDoc.data()!.emojiPackIds || []

  const defaultPacksSnap = await adminDb
    .collection('emojiPacks')
    .where('isDefault', '==', true)
    .get()

  const defaultPacks = defaultPacksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const communityPacks: any[] = []
  for (const pid of emojiPackIds) {
    const doc = await adminDb.collection('emojiPacks').doc(pid).get()
    if (doc.exists) communityPacks.push({ id: doc.id, ...doc.data() })
  }

  return NextResponse.json({
    packs: [...defaultPacks, ...communityPacks],
  })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const formData = await req.formData()
  const communityId = formData.get('communityId') as string
  const packName = formData.get('name') as string
  const files = formData.getAll('files') as File[]

  if (!communityId || !packName) {
    return NextResponse.json({ error: 'communityId와 name이 필요합니다.' }, { status: 400 })
  }

  if (!files.length) {
    return NextResponse.json({ error: '이모티콘 이미지를 1개 이상 업로드해주세요.' }, { status: 400 })
  }

  if (files.length > 30) {
    return NextResponse.json({ error: '이모티콘은 최대 30개까지 업로드 가능합니다.' }, { status: 400 })
  }

  const isMember = user.communities.some((c) => c.id === communityId)
  if (!isMember) {
    return NextResponse.json({ error: '해당 마을의 멤버가 아닙니다.' }, { status: 403 })
  }

  const packId = randomUUID()
  const bucket = adminStorage.bucket()
  const images: string[] = []

  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'png'
    const filename = `emoji-packs/${packId}/${randomUUID()}.${ext}`
    const fileRef = bucket.file(filename)

    await fileRef.save(buf, {
      metadata: { contentType: file.type || 'image/png' },
    })
    await fileRef.makePublic()

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`
    images.push(url)
  }

  const packData = {
    name: packName.trim(),
    communityId,
    images,
    isDefault: false,
    createdBy: user.uid,
    createdByName: user.displayName,
    createdAt: FieldValue.serverTimestamp(),
  }

  await adminDb.collection('emojiPacks').doc(packId).set(packData)

  await adminDb.collection('communities').doc(communityId).update({
    emojiPackIds: FieldValue.arrayUnion(packId),
  })

  return NextResponse.json({ ok: true, pack: { id: packId, ...packData } })
}
