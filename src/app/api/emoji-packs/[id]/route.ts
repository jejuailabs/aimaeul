import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await params

  const doc = await adminDb.collection('emojiPacks').doc(id).get()
  if (!doc.exists) {
    return NextResponse.json({ error: '이모티콘 팩을 찾을 수 없습니다.' }, { status: 404 })
  }

  const pack = doc.data()!
  if (pack.createdBy !== user.uid) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  if (pack.communityId) {
    await adminDb.collection('communities').doc(pack.communityId).update({
      emojiPackIds: FieldValue.arrayRemove(id),
    })
  }

  await adminDb.collection('emojiPacks').doc(id).delete()

  return NextResponse.json({ ok: true })
}
