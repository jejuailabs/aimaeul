'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, MapPin, UserCheck, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CommunityBadge } from '@/components/community-badge'
import { relativeTime } from '@/lib/village'
import { toast } from 'sonner'

type Request = {
  id: string
  communityId: string
  communityName: string
  communityType: string
  regionName: string
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  message: string | null
  status: string
  createdAt: string | null
}

const TABS = [
  { key: 'pending', label: '대기 중' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '거절됨' },
] as const

export function MemberApprovalClient({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [status, setStatus] = useState<(typeof TABS)[number]['key']>('pending')
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/membership-requests?scope=manage&status=${status}`)
      const data = await res.json().catch(() => ({}))
      setRequests(data.requests || [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, action: 'approve' | 'reject') {
    setActing(id)
    try {
      const res = await fetch(`/api/membership-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '처리에 실패했어요.')
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== id))
      toast.success(action === 'approve' ? '가입을 승인했어요.' : '가입을 거절했어요.')
    } catch {
      toast.error('처리 중 오류가 발생했어요.')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="px-3 py-3">
      {isSuperadmin && (
        <p className="mb-3 rounded-xl bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
          운영자 계정으로 전체 마을의 가입 신청을 보고 있어요.
        </p>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              t.key === status
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <UserCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {status === 'pending' ? '대기 중인 가입 신청이 없어요.' : '해당 내역이 없어요.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={r.photoURL || undefined} alt={r.displayName} />
                  <AvatarFallback className="bg-primary/20 text-sm font-semibold">
                    {r.displayName?.slice(0, 1) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.displayName}</p>
                  {r.email && (
                    <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <CommunityBadge type={r.communityType} size="sm" />
                    <span className="truncate text-xs font-medium">{r.communityName}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {r.regionName}
                    {r.createdAt && (
                      <>
                        <span className="mx-1">·</span>
                        {relativeTime(r.createdAt)}
                      </>
                    )}
                  </p>
                  {r.message && (
                    <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">{r.message}</p>
                  )}
                </div>
              </div>

              {status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => decide(r.id, 'approve')}
                    disabled={acting === r.id}
                    className="flex-1 rounded-xl"
                  >
                    {acting === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" /> 승인
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => decide(r.id, 'reject')}
                    disabled={acting === r.id}
                    variant="outline"
                    className="rounded-xl"
                  >
                    <X className="mr-1 h-4 w-4" /> 거절
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
