export const COMMUNITY_TYPE_META: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  부녀회: { emoji: '🌸', color: '#FEE500', label: '부녀회' },
  청년회: { emoji: '🌱', color: '#34d399', label: '청년회' },
  노인회: { emoji: '🍂', color: '#f59e0b', label: '노인회' },
  동호회: { emoji: '⛳', color: '#60a5fa', label: '동호회' },
}

export function communityTypeMeta(type: string) {
  return (
    COMMUNITY_TYPE_META[type] ?? {
      emoji: '🏘',
      color: '#a78bfa',
      label: type,
    }
  )
}

export function formatKoreanDate(d: Date | string | any) {
  const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatKoreanTime(d: Date | string | any) {
  const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(d: Date | string | any) {
  const date = d instanceof Date ? d : d?.toDate ? d.toDate() : new Date(d)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return formatKoreanDate(date)
}

export function formatRent(rent: number | null, deposit: number | null) {
  const parts: string[] = []
  if (deposit != null) parts.push(`보증금 ${deposit.toLocaleString()}만`)
  if (rent != null) parts.push(`월세 ${rent.toLocaleString()}만`)
  if (parts.length === 0) return '가격 협의'
  return parts.join(' / ')
}

export function toDate(d: any): Date {
  if (d instanceof Date) return d
  if (d?.toDate) return d.toDate()
  if (d?.seconds) return new Date(d.seconds * 1000)
  return new Date(d)
}

export function toISOString(d: any): string {
  return toDate(d).toISOString()
}
