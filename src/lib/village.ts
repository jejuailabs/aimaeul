import { db } from '@/lib/db'

/** Public community list for the map (guest-visible). */
export async function getPublicCommunities() {
  return db.community.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      communityType: true,
      regionName: true,
      lat: true,
      lng: true,
      coverImageUrl: true,
      description: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getCommunity(communityId: string) {
  return db.community.findUnique({
    where: { id: communityId },
    include: {
      _count: {
        select: { members: true, photos: true, events: true },
      },
    },
  })
}

export async function getRecentMessages(communityId: string, limit = 50) {
  return db.message.findMany({
    where: { communityId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

export async function getRecentPhotos(communityId: string, limit = 20) {
  return db.photo.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getUpcomingEvents(communityId: string, limit = 5) {
  const now = new Date()
  return db.event.findMany({
    where: { communityId, startAt: { gte: now } },
    orderBy: { startAt: 'asc' },
    take: limit,
  })
}

export async function getMembers(communityId: string) {
  return db.communityMember.findMany({
    where: { communityId },
    include: { user: { select: { id: true, name: true, photoURL: true } } },
    orderBy: { joinedAt: 'asc' },
  })
}

export const COMMUNITY_TYPE_META: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  부녀회: { emoji: '🌸', color: '#FEE500', label: '부녀회' },
  청년회: { emoji: '🌱', color: '#34d399', label: '청년회' },
  노인회: { emoji: '银杏', color: '#f59e0b', label: '노인회' },
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

export function formatKoreanDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatKoreanTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
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
