import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/session'
import { isViewMode, VIEW_MODE_COOKIE } from '@/lib/view-mode'

export const dynamic = 'force-dynamic'

/** 현재 체험 모드와 실제 권한 조회. 스위처 UI 노출 여부 판단에 쓴다. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  return NextResponse.json({
    mode: user.viewMode,
    realRole: user.realRole,
    canSwitch: user.realRole === 'superadmin',
    realAdminCommunities: user.realAdminCommunities,
    // 체험 모드가 적용된 값. UI 노출 판단은 반드시 이 값을 쓴다.
    role: user.role,
    adminCommunities: user.adminCommunities,
    canManageMembers: user.role === 'superadmin' || user.adminCommunities.length > 0,
  })
}

/**
 * 슈퍼관리자 체험 모드 전환.
 *
 * 권한 검사는 반드시 realRole로 한다. 적용 권한(role)으로 검사하면
 * 회원 모드에 들어간 뒤 되돌릴 수 없게 된다.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.realRole !== 'superadmin') {
    return NextResponse.json({ error: '슈퍼관리자만 사용할 수 있습니다.' }, { status: 403 })
  }

  const { mode } = (await req.json().catch(() => ({}))) as { mode?: string }
  if (!isViewMode(mode)) {
    return NextResponse.json({ error: '잘못된 모드입니다.' }, { status: 400 })
  }

  const store = await cookies()
  store.set(VIEW_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return NextResponse.json({ ok: true, mode })
}
