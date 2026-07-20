'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2 } from 'lucide-react'
import { VIEW_MODE_LABELS, type ViewMode } from '@/lib/view-mode'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const ORDER: ViewMode[] = ['superadmin', 'leader', 'member']

/**
 * 앱 상단 어디서나 보이는 체험 모드 배지.
 *
 * 마을 화면을 보면서 바로 회장/회원 시점으로 바꿔볼 수 있어야 하므로
 * 내 정보까지 들어가지 않고 한 번의 탭으로 순환 전환한다.
 * 슈퍼관리자가 아니면 아무것도 렌더링하지 않는다.
 */
export function ViewModeBadge() {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode | null>(null)
  const [canSwitch, setCanSwitch] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/view-mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setCanSwitch(!!d.canSwitch)
        setMode(d.mode)
      })
      .catch(() => {})
  }, [])

  if (!canSwitch || !mode) return null

  async function cycle() {
    const next = ORDER[(ORDER.indexOf(mode!) + 1) % ORDER.length]
    setSaving(true)
    try {
      const res = await fetch('/api/view-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '모드 전환에 실패했어요.')
        return
      }
      setMode(next)
      toast.success(`${VIEW_MODE_LABELS[next]} 모드`)
      router.refresh()
    } catch {
      toast.error('모드 전환 중 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={cycle}
      disabled={saving}
      title="탭하면 슈퍼관리자 → 회장 → 회원 순으로 전환됩니다"
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60',
        mode === 'superadmin' && 'border-primary bg-primary text-primary-foreground',
        mode === 'leader' && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        mode === 'member' && 'border-border bg-muted text-muted-foreground'
      )}
    >
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
      {VIEW_MODE_LABELS[mode]}
    </button>
  )
}
