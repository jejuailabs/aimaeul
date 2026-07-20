'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2 } from 'lucide-react'
import { VIEW_MODE_LABELS, type ViewMode } from '@/lib/view-mode'
import { toast } from 'sonner'

const MODES: { key: ViewMode; desc: string }[] = [
  { key: 'superadmin', desc: '모든 마을 승인·관리' },
  { key: 'leader', desc: '내 마을만 승인' },
  { key: 'member', desc: '일반 회원 화면' },
]

/**
 * 슈퍼관리자가 회장/회원 시점으로 바꿔가며 화면을 확인하는 스위처.
 * 실제 권한은 그대로이며, 언제든 슈퍼관리자로 되돌릴 수 있다.
 */
export function ViewModeSwitcher() {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode | null>(null)
  const [canSwitch, setCanSwitch] = useState(false)
  const [saving, setSaving] = useState<ViewMode | null>(null)

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

  async function change(next: ViewMode) {
    if (next === mode) return
    setSaving(next)
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
      toast.success(`${VIEW_MODE_LABELS[next]} 모드로 전환했어요.`)
      // 서버 컴포넌트가 새 권한으로 다시 렌더링되도록 갱신
      router.refresh()
    } catch {
      toast.error('모드 전환 중 오류가 발생했어요.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
      <div className="mb-1 flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">체험 모드</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        회장·회원 입장에서 화면이 어떻게 보이는지 확인할 수 있어요. 실제 권한은 그대로예요.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = m.key === mode
          return (
            <button
              key={m.key}
              onClick={() => change(m.key)}
              disabled={saving !== null}
              className={`rounded-xl border px-2 py-2 text-center transition-colors disabled:opacity-60 ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-xs font-semibold">
                {saving === m.key && <Loader2 className="h-3 w-3 animate-spin" />}
                {VIEW_MODE_LABELS[m.key]}
              </span>
              <span
                className={`mt-0.5 block text-[10px] leading-tight ${
                  active ? 'text-primary-foreground/80' : 'text-muted-foreground'
                }`}
              >
                {m.desc}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
