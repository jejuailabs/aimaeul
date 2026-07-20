'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2, Send, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Report = {
  id: string
  communityId: string
  category: string
  title: string
  content: string
  reporterName: string
  status: string
  adminNote: string
  createdAt: string | null
}

const STATUS_LIST = ['접수', '안전신문고 전달완료', '처리중', '종료'] as const
const STATUS_META: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  '접수': { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  '안전신문고 전달완료': { icon: Send, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  '처리중': { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  '종료': { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
}

export function ReportAdminClient({
  reports: initialReports,
  communityNames,
}: {
  reports: Report[]
  communityNames: Record<string, string>
}) {
  const [reports, setReports] = useState(initialReports)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('전체')
  const [updating, setUpdating] = useState<string | null>(null)

  const filtered = filter === '전체' ? reports : reports.filter((r) => r.status === filter)

  async function updateStatus(reportId: string, newStatus: string) {
    setUpdating(reportId)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || '상태 변경에 실패했습니다.')
        return
      }
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      )
      toast.success(`상태가 "${newStatus}"(으)로 변경되었습니다.`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setUpdating(null)
    }
  }

  const statusCounts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {['전체', ...STATUS_LIST].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s} {s === '전체' ? `(${reports.length})` : statusCounts[s] ? `(${statusCounts[s]})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">해당 상태의 제보가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META['접수']
            const Icon = meta.icon
            const isExpanded = expandedId === r.id
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {communityNames[r.communityId] || '알 수 없는 마을'} · {r.reporterName} · {r.category}
                      {r.createdAt && ` · ${new Date(r.createdAt).toLocaleDateString('ko-KR')}`}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="mb-3 whitespace-pre-line text-sm text-foreground">{r.content}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_LIST.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={r.status === s ? 'default' : 'outline'}
                          className="h-7 rounded-full text-xs"
                          disabled={r.status === s || updating === r.id}
                          onClick={() => updateStatus(r.id, s)}
                        >
                          {updating === r.id ? '...' : s}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
