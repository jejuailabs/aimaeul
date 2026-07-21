import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { adminStorage } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

/**
 * 일기 사진 열람.
 *
 * 일기 사진은 공개 URL이 없다. 본인 여부를 확인한 뒤에만
 * 짧게 유효한 서명 URL로 리다이렉트한다.
 * 경로가 반드시 diaries/{본인 uid}/ 로 시작하는지 확인해
 * 남의 일기 사진을 요청하는 것을 막는다.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') ?? ''

  const prefix = `diaries/${user.uid}/`
  // '..' 같은 경로 조작과 타인 경로 접근을 모두 차단한다.
  if (!path.startsWith(prefix) || path.includes('..')) {
    return NextResponse.json({ error: '접근할 수 없어요.' }, { status: 403 })
  }

  const file = adminStorage.bucket().file(path)
  const [exists] = await file.exists()
  if (!exists) {
    return NextResponse.json({ error: '사진을 찾을 수 없어요.' }, { status: 404 })
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000, // 10분
  })

  return NextResponse.redirect(url)
}
