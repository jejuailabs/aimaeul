/**
 * 슈퍼관리자 체험 모드.
 *
 * 슈퍼관리자가 회장/회원 입장에서 화면이 어떻게 보이는지 확인할 수 있도록
 * 실제 권한(realRole)은 유지한 채 "적용 권한"만 낮춰서 보여준다.
 *
 * 모드 전환 자체는 항상 실제 권한으로 검사하므로, 회원 모드에 들어가도
 * 언제든 되돌릴 수 있다.
 */
export type ViewMode = 'superadmin' | 'leader' | 'member'

export const VIEW_MODE_COOKIE = 'viewMode'

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  superadmin: '슈퍼관리자',
  leader: '회장',
  member: '회원',
}

export function isViewMode(v: unknown): v is ViewMode {
  return v === 'superadmin' || v === 'leader' || v === 'member'
}
