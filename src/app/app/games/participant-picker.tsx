'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Participant } from './games-logic'

type Props = {
  members: Participant[]
  extras: Participant[]
  selected: string[]
  onToggle: (id: string) => void
  onAddExtra: (name: string) => void
  onRemoveExtra: (id: string) => void
  minHint?: number
}

/**
 * 참가자 선택 공통 컴포넌트.
 * - 마을 멤버 목록을 체크박스로 표시 (미리 체크된 상태는 부모가 결정)
 * - "이름 직접 추가" 입력으로 비회원 참가자 추가 가능
 */
export function ParticipantPicker({
  members,
  extras,
  selected,
  onToggle,
  onAddExtra,
  onRemoveExtra,
  minHint = 2,
}: Props) {
  const [newName, setNewName] = useState('')

  function submitNew() {
    const name = newName.trim()
    if (!name) return
    onAddExtra(name)
    setNewName('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>참가자 선택</Label>
        <span className="text-xs text-muted-foreground">{selected.length}명 선택됨</span>
      </div>
      <ScrollArea className="max-h-48 rounded-lg border border-border">
        <div className="p-1">
          {members.length === 0 && extras.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              마을 멤버가 없어요. 아래에서 직접 추가해주세요.
            </p>
          )}
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(m.id)}
                onCheckedChange={() => onToggle(m.id)}
              />
              <span className="text-sm">{m.name}</span>
            </label>
          ))}
          {extras.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={() => onToggle(p.id)}
              />
              <span className="flex-1 text-sm">
                {p.name}{' '}
                <span className="text-[11px] text-muted-foreground">(직접 추가)</span>
              </span>
              <button
                type="button"
                aria-label="삭제"
                onClick={(e) => {
                  e.preventDefault()
                  onRemoveExtra(p.id)
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </label>
          ))}
        </div>
      </ScrollArea>
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitNew()
            }
          }}
          placeholder="이름 직접 추가"
          className="text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={submitNew}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {minHint > 0 && (
        <p className="text-[11px] text-muted-foreground">최소 {minHint}명 이상 선택하세요.</p>
      )}
    </div>
  )
}
