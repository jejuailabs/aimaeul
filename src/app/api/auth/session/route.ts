import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase-admin'

const FIVE_DAYS = 60 * 60 * 24 * 5 * 1000

export async function POST(req: Request) {
  const { idToken } = await req.json().catch(() => ({ idToken: null }))
  if (!idToken) {
    return NextResponse.json({ error: 'idToken이 필요합니다.' }, { status: 400 })
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS,
    })
    const cookieStore = await cookies()
    cookieStore.set('__session', sessionCookie, {
      maxAge: FIVE_DAYS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/session] 세션 쿠키 생성 실패:', e)
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('__session')
  return NextResponse.json({ ok: true })
}
