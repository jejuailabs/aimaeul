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

export default function TimelinePage() {
  const params = useParams()
  const communityId = params.communityId as string

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<TimelineItem[]>([])
  const [communityName, setCommunityName] = useState('')
  const [loading, setLoading] = useState(true)

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

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

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
            onClick={() => changeDate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => changeDate(1)}
            disabled={date >= new Date().toISOString().slice(0, 10)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-4 text-center text-xs text-muted-foreground">{displayDate}</p>

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
