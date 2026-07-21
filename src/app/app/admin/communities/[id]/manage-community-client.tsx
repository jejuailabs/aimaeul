'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Loader2, LogOut, Trash2, UserMinus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CommunityBadge } from '@/components/community-badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CommunityImageEditor } from '@/components/community-image-editor'
import { relativeTime } from '@/lib/village'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Member = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
  isLeader: boolean
  isSuperadmin: boolean
}

type ContentItem = {
  id: string
  kind: 'photo' | 'message'
  thumbnailUrl: string | null
  authorName: string
  text: string | null
  createdAt: string | null
}

type Community = {
  id: string
  name: string
  communityType: string
  regionName: string
  inviteCode: string
  coverImageUrl: string | null
  mascotImageUrl: string | null
}

const TABS = [
  { key: 'members', label: '회원' },
  { key: 'photo', label: '사진' },
  { key: 'message', label: '대화' },
] as const

export function ManageCommunityClient({
  community,
  isSuperadmin,
}: {
  community: Community
  isSuperadmin: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'members') {
        const res = await fetch(`/api/communities/${community.id}/members`)
        const d = await res.json().catch(() => ({}))
        setMembers(d.members || [])
      } else {
        const res = await fetch(`/api/communities/${community.id}/content?kind=${tab}`)
        const d = await res.json().catch(() => ({}))
        setItems(d.items || [])
      }
    } finally {
      setLoading(false)
    }
  }, [tab, community.id])

  useEffect(() => {
    load()
  }, [load])

  async function memberAction(uid: string, action: 'promote' | 'demote' | 'remove') {
    setActing(uid)
    try {
      const res = await fetch(`/api/communities/${community.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, action }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || '처리에 실패했어요.')
        return
      }
      if (action === 'remove') {
        setMembers((prev) => prev.filter((m) => m.uid !== uid))
        toast.success('회원을 내보냈어요.')
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.uid === uid ? { ...m, isLeader: action === 'promote' } : m))
        )
        toast.success(action === 'promote' ? '회장으로 임명했어요.' : '회장 권한을 해제했어요.')
      }
    } finally {
      setActing(null)
    }
  }

  async function deleteItem(item: ContentItem) {
    setActing(item.id)
    try {
      const res = await fetch(`/api/communities/${community.id}/content`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, kind: item.kind }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || '삭제하지 못했어요.')
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('삭제했어요.')
    } finally {
      setActing(null)
    }
  }

  async function deleteCommunity() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/communities/${community.id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || '마을을 삭제하지 못했어요.')
        return
      }
      toast.success(`${community.name} 마을을 삭제했어요.`)
      router.push('/app/admin')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-3 py-3">
      {/* 마을 정보 */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-bold">{community.name}</h2>
          <CommunityBadge type={community.communityType} size="sm" />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{community.regionName}</p>
        {community.inviteCode && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            초대코드 <span className="font-mono font-bold">{community.inviteCode}</span>
          </p>
        )}
      </div>

      {/* 배너·마스코트 */}
      <div className="mb-4 space-y-3">
        <CommunityImageEditor
          communityId={community.id}
          kind="banner"
          initialUrl={community.coverImageUrl}
        />
        <CommunityImageEditor
          communityId={community.id}
          kind="mascot"
          initialUrl={community.mascotImageUrl}
        />
      </div>

      {/* 탭 */}
      <div className="mb-3 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              t.key === tab
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'members' ? (
        <div className="space-y-2">
          {members.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              회원이 없어요.
            </p>
          )}
          {members.map((m) => (
            <div key={m.uid} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.photoURL || undefined} alt={m.displayName} />
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold">
                    {m.displayName?.slice(0, 1) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{m.displayName}</span>
                    {m.isLeader && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        <Crown className="h-3 w-3" /> 회장
                      </span>
                    )}
                  </div>
                  {m.email && (
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex gap-2">
                {m.isLeader ? (
                  <Button
                    onClick={() => memberAction(m.uid, 'demote')}
                    disabled={acting === m.uid || !isSuperadmin}
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    회장 해제
                  </Button>
                ) : (
                  <Button
                    onClick={() => memberAction(m.uid, 'promote')}
                    disabled={acting === m.uid}
                    size="sm"
                    className="flex-1 rounded-xl"
                  >
                    <Crown className="mr-1 h-4 w-4" /> 회장 임명
                  </Button>
                )}
                <Button
                  onClick={() => memberAction(m.uid, 'remove')}
                  disabled={acting === m.uid || m.isSuperadmin}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-destructive"
                >
                  <UserMinus className="mr-1 h-4 w-4" /> 내보내기
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {tab === 'photo' ? '올라온 사진이 없어요.' : '대화가 없어요.'}
            </p>
          )}
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5"
            >
              {it.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-xl bg-muted object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{it.authorName}</p>
                <p className="truncate text-sm">{it.text || '(내용 없음)'}</p>
                {it.createdAt && (
                  <p className="text-[11px] text-muted-foreground">
                    {relativeTime(it.createdAt)}
                  </p>
                )}
              </div>
              <Button
                onClick={() => deleteItem(it)}
                disabled={acting === it.id}
                size="icon"
                variant="ghost"
                aria-label="삭제"
                className="shrink-0 rounded-full text-destructive"
              >
                {acting === it.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 마을 삭제 — 되돌릴 수 없으므로 운영자만, 이름 확인까지 받는다 */}
      {isSuperadmin && (
        <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <h3 className="text-sm font-bold text-destructive">마을 삭제</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            채팅·사진·행사·소식이 모두 지워지고 되돌릴 수 없어요.
          </p>
          <Button
            onClick={() => setDeleteOpen(true)}
            variant="outline"
            className="mt-2.5 w-full rounded-xl border-destructive/50 text-destructive"
          >
            <LogOut className="mr-1 h-4 w-4" /> 이 마을 삭제하기
          </Button>
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>정말 삭제할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{community.name}</span>의 채팅·사진·행사·소식이
            모두 사라지고 회원들의 소속에서도 제거돼요. 되돌릴 수 없어요.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">
              확인을 위해 마을 이름을 입력하세요
            </label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={community.name}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              취소
            </Button>
            <Button
              onClick={deleteCommunity}
              disabled={deleting || confirmName.trim() !== community.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
