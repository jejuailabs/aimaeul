import { cache } from 'react'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { isViewMode, VIEW_MODE_COOKIE, type ViewMode } from '@/lib/view-mode'

/** 쿠키에서 체험 모드를 읽는다. 서버 전용. */
async function getViewMode(): Promise<ViewMode> {
  const store = await cookies()
  const raw = store.get(VIEW_MODE_COOKIE)?.value
  return isViewMode(raw) ? raw : 'superadmin'
}

export type CurrentUser = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
  communities: { id: string; name: string; communityType: string; regionName: string }[]
  /**
   * 체험 모드가 적용된 역할. 권한 판정은 항상 이 값을 쓴다.
   * 슈퍼관리자가 회장/회원 모드를 켜면 그에 맞게 낮아진다.
   */
  role: 'superadmin' | 'user'
  /** 체험 모드가 적용된 회장 공동체 목록. */
  adminCommunities: string[]
  /** DB에 저장된 실제 역할. 모드 전환 권한 검사에만 사용한다. */
  realRole: 'superadmin' | 'user'
  /** DB에 저장된 실제 회장 공동체 목록. */
  realAdminCommunities: string[]
  /** 현재 체험 모드. 슈퍼관리자가 아니면 항상 'superadmin'(=무효)로 취급하지 않고 무시된다. */
  viewMode: ViewMode
}

/**
 * 실제 권한에 체험 모드를 적용해 "적용 권한"을 계산한다.
 * 슈퍼관리자가 아닌 사용자에게는 모드가 아무 영향을 주지 않는다.
 */
function applyViewMode(
  realRole: 'superadmin' | 'user',
  realAdminCommunities: string[],
  viewMode: ViewMode
) {
  if (realRole !== 'superadmin') {
    return {
      role: realRole,
      adminCommunities: realAdminCommunities,
      realRole,
      realAdminCommunities,
      viewMode: 'superadmin' as ViewMode,
    }
  }

  switch (viewMode) {
    case 'member':
      // 일반 회원 시점 — 승인 권한 없음
      return {
        role: 'user' as const,
        adminCommunities: [],
        realRole,
        realAdminCommunities,
        viewMode,
      }
    case 'leader':
      // 회장 시점 — 담당 공동체만 승인 가능
      return {
        role: 'user' as const,
        adminCommunities: realAdminCommunities,
        realRole,
        realAdminCommunities,
        viewMode,
      }
    default:
      return {
        role: realRole,
        adminCommunities: realAdminCommunities,
        realRole,
        realAdminCommunities,
        viewMode: 'superadmin' as ViewMode,
      }
  }
}

/**
 * 현재 로그인 사용자.
 *
 * 한 화면을 그릴 때 페이지·헤더·셸이 각각 이 함수를 부르므로 cache로 감싼다.
 * 감싸지 않으면 같은 조회를 요청 한 번에 서너 번 반복한다.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return null

  try {
    // checkRevoked를 켜면 매 요청마다 구글 인증 서버를 왕복해 0.8초가 더 붙는다.
    // 세션 쿠키 자체에 만료(5일)가 있고, 로그아웃 시 쿠키를 지우므로 끈다.
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, false)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return null

    const userData = userDoc.data()!
    const communityIds: string[] = userData.communityIds || []

    // 마을을 하나씩 순차로 읽으면 소속 수만큼 왕복이 늘어난다. 한 번에 가져온다.
    const communities: CurrentUser['communities'] = []
    if (communityIds.length > 0) {
      const docs = await adminDb.getAll(
        ...communityIds.map((id) => adminDb.collection('communities').doc(id))
      )
      for (const cDoc of docs) {
        if (!cDoc.exists) continue
        const d = cDoc.data()!
        communities.push({
          id: cDoc.id,
          name: d.name,
          communityType: d.communityType,
          regionName: d.regionName,
        })
      }
    }

    return {
      uid: decoded.uid,
      displayName: userData.displayName || '익명',
      email: userData.email || null,
      photoURL: userData.photoURL || null,
      communities,
      ...applyViewMode(
        userData.role === 'superadmin' ? 'superadmin' : 'user',
        userData.adminCommunities || [],
        await getViewMode()
      ),
    }
  } catch {
    return null
  }
})
