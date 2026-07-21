'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Calendar, Camera, Gamepad2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TimelineItem = {
  id: string
  type: 'photo' | 'game_result' | 'event' | 'text'
  time: string
  authorName: string
  text?: string
  photoUrl?: string
  caption?: string
  gamePayload?: any
  eventTitle?: string
  eventLocation?: string
}

/**
 * 오늘 날짜(한국 시간 기준).
 *
 * toISOString()은 UTC라 한국 시간과 하루가 어긋난다.
 * 로컬 값으로 직접 만들어야 날짜 이동이 어긋나지 않는다.
 */
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TimelinePage() {
  const params = useParams()
  const communityId = params.communityId as string

  const [date, setDate] = useState(todayLocal)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [communityName, setCommunityName] = useState('')
  const [loading, setLoading] = useState(true)
  /** 활동 기록이 있는 날짜(최신순). 빈 날짜는 건너뛰기 위해 쓴다. */
  const [activeDates, setActiveDates] = useState<string[]>([])

  const fetchTimeline = useCallback(async (targetDate: string) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/v1/village/${communityId}/feed?date=${targetDate}`,
      )
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        if (data.communityName) setCommunityName(data.communityName)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    fetchTimeline(date)
  }, [date, fetchTimeline])

  // 기록이 있는 날짜를 받아, 가장 최근 기록일로 시작한다.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/village/${communityId}/active-dates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.dates) return
        setActiveDates(d.dates)
        if (d.dates.length > 0 && !d.dates.includes(todayLocal())) {
          setDate(d.dates[0])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [communityId])

  /**
   * 기록이 있는 날짜로만 이동한다.
   * activeDates는 최신순이므로, 과거로 가려면 인덱스를 늘린다.
   */
  const goToAdjacent = (direction: 'prev' | 'past' | 'next') => {
    if (activeDates.length === 0) return
    const idx = activeDates.indexOf(date)
    if (idx === -1) {
      // 목록에 없는 날짜(직접 고른 날)면 가장 가까운 기록일로 이동
      const target =
        direction === 'past'
          ? activeDates.find((d) => d < date)
          : [...activeDates].reverse().find((d) => d > date)
      if (target) setDate(target)
      return
    }
    const nextIdx = direction === 'past' ? idx + 1 : idx - 1
    if (nextIdx >= 0 && nextIdx < activeDates.length) setDate(activeDates[nextIdx])
  }

  const hasPast = activeDates.some((d) => d < date)
  const hasFuture = activeDates.some((d) => d > date)

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Link
          href={`/village/${communityId}`}
          className="flex items-center gap-1 text-sm font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {communityName || '마을'}
        </Link>
        <h1 className="text-sm font-bold">타임라인</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {/* Date Picker */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="이전 기록일"
            onClick={() => goToAdjacent('past')}
            disabled={!hasPast}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <input
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="다음 기록일"
            onClick={() => goToAdjacent('next')}
            disabled={!hasFuture}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-1 text-center text-xs text-muted-foreground">{displayDate}</p>
        {activeDates.length > 0 && (
          <p className="mb-4 text-center text-[11px] text-muted-foreground">
            기록이 있는 날 {activeDates.length}일 · 화살표로 넘겨보세요
          </p>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            이 날의 활동 기록이 없어요.
          </div>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 h-full w-px bg-border" />

            {items.map((item) => (
              <div key={item.id} className="relative flex gap-3 pb-4">
                {/* Timeline dot */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                  {item.type === 'photo' && (
                    <Camera className="h-4 w-4 text-blue-500" />
                  )}
                  {item.type === 'game_result' && (
                    <Gamepad2 className="h-4 w-4 text-green-500" />
                  )}
                  {item.type === 'event' && (
                    <Calendar className="h-4 w-4 text-orange-500" />
                  )}
                  {item.type === 'text' && (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold">{item.authorName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {item.type === 'photo' && item.photoUrl && (
                    <div className="overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.photoUrl}
                        alt={item.caption || '사진'}
                        className="w-full object-cover"
                        style={{ maxHeight: '300px' }}
                      />
                      {item.caption && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.caption}</p>
                      )}
                    </div>
                  )}

                  {item.type === 'game_result' && item.gamePayload && (
                    <div>
                      <p className="text-xs text-muted-foreground">{item.gamePayload.gameType}</p>
                      <p className="font-semibold text-sm">{item.gamePayload.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                        {item.gamePayload.resultSummary}
                      </p>
                    </div>
                  )}

                  {item.type === 'event' && (
                    <div>
                      <p className="font-semibold text-sm">{item.eventTitle}</p>
                      {item.eventLocation && (
                        <p className="text-xs text-muted-foreground">{item.eventLocation}</p>
                      )}
                    </div>
                  )}

                  {item.type === 'text' && item.text && (
                    <p className="text-sm">{item.text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        {communityName || '마을'} · 우리마을 타임라인
      </footer>
    </div>
  )
}
