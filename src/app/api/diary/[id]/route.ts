import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminDb, adminStorage } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

/** 일기 삭제. 본인 문서만 지울 수 있고, 사진 파일도 함께 정리한다. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  // 경로 자체가 본인 하위이므로 남의 일기에는 접근할 수 없다.
  const ref = adminDb.collection('users').doc(user.uid).collection('diaries').doc(id)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ error: '일기를 찾을 수 없어요.' }, { status: 404 })
  }

  const paths: string[] = doc.data()?.photoPaths ?? []
  const bucket = adminStorage.bucket()
  await Promise.all(
    paths.map((p) =>
      p.startsWith(`diaries/${user.uid}/`)
        ? bucket.file(p).delete().catch(() => {})
        : Promise.resolve()
    )
  )

  await ref.delete()
  return NextResponse.json({ ok: true })
}
