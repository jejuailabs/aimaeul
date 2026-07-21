'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Send,
  ImagePlus,
  Smile,
  Gamepad2,
  Users,
  Circle,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatSocket, type ChatMessage } from '@/hooks/use-chat-socket'
import { MessageBubble, type PhotoData } from '@/components/message-bubble'
import { communityTypeMeta, formatKoreanTime } from '@/lib/village'
import { cn } from '@/lib/utils'
import { GamesClient } from '@/app/app/games/games-client'
import { toast } from 'sonner'

const EMOJI_SET = [
  '😀','😂','🥰','😍','😎','🤣','😅','😊',
  '🙏','👍','👏','🙌','💪','🤝','👋','✌️',
  '❤️','🧡','💛','💚','💙','💜','🤍','🔥',
  '🎉','✨','🌸','🌷','🌹','🌻','🍀','⭐',
  '🥔','🌽','🥬','🍅','🍓','🍊','🍎','🥚',
  '☕','🍵','🍰','🥘','🍜','🍚','🥢','🍽️',
  '📷','🎨','⚽','🚶','🏕️','🌄','🌅','🌈',
]

type EmojiPack = {
  id: string
  name: string
  images: string[]
  isDefault?: boolean
}

type Props = {
  community: {
    id: string
    name: string
    communityType: string
    regionName: string
    coverImageUrl: string | null
  }
  user: { id: string; name: string; photoURL?: string | null }
  initialMessages: ChatMessage[]
  photoMap: Record<string, PhotoData>
  /** 게임 참가자 후보 (마을 회원). 게임 모달에서 사용한다. */
  gameMembers: { id: string; name: string; photoURL?: string | null }[]
}

export function ChatRoomClient({
  community,
  user,
  initialMessages,
  photoMap,
  gameMembers,
}: Props) {
  const router = useRouter()
  const { messages, send, online, typingFrom } = useChatSocket(
    community.id,
    initialMessages,
    300
  )
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  // 사진은 확인 창을 거친 뒤에만 올라간다.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  // 게임은 화면 이동 없이 모달로 연다. 진행 권한은 회장·관리자에게만 있다.
  const [gameOpen, setGameOpen] = useState(false)
  const [canRunGame, setCanRunGame] = useState(false)

  useEffect(() => {
    if (!gameOpen || canRunGame) return
    fetch('/api/view-mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setCanRunGame(
          d.role === 'superadmin' || (d.adminCommunities || []).includes(community.id)
        )
      })
      .catch(() => {})
  }, [gameOpen, canRunGame, community.id])
  const [emojiPacks, setEmojiPacks] = useState<EmojiPack[]>([])
  const [emojiPacksLoaded, setEmojiPacksLoaded] = useState(false)
  const [activePackTab, setActivePackTab] = useState<string>('unicode')
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const meta = communityTypeMeta(community.communityType)

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function handleSend() {
    const t = text.trim()
    if (!t) return
    send({
      authorUid: user.id,
      authorName: user.name,
      authorPhotoURL: user.photoURL,
      type: 'text',
      text: t,
    })
    setText('')
  }

  /**
   * 사진을 고르면 바로 올리지 않고 확인 창을 먼저 띄운다.
   * 잘못 고른 사진이 마을 전체에 즉시 공개되는 사고를 막는다.
   */
  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    setPendingFiles(files)
    setPendingPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  function cancelPendingUpload() {
    pendingPreviews.forEach(URL.revokeObjectURL)
    setPendingPreviews([])
    setPendingFiles([])
  }

  function removePendingAt(index: number) {
    URL.revokeObjectURL(pendingPreviews[index])
    const nextFiles = pendingFiles.filter((_, i) => i !== index)
    const nextPreviews = pendingPreviews.filter((_, i) => i !== index)
    setPendingFiles(nextFiles)
    setPendingPreviews(nextPreviews)
  }

  async function confirmPhotoUpload() {
    if (pendingFiles.length === 0) return
    setUploading(true)
    try {
      let failed = 0
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('communityId', community.id)
        fd.append('broadcast', 'true')
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error || '사진 업로드 실패')
          failed++
        }
      }
      if (failed === 0) toast.success('사진을 올렸어요 📷')
      cancelPendingUpload()
    } finally {
      setUploading(false)
    }
  }

  function sendEmoji(emoji: string) {
    send({
      authorUid: user.id,
      authorName: user.name,
      authorPhotoURL: user.photoURL,
      type: 'emoji',
      emojiUrl: emoji,
    })
  }

  async function loadEmojiPacks() {
    if (emojiPacksLoaded) return
    try {
      const res = await fetch(`/api/emoji-packs?communityId=${community.id}`)
      if (res.ok) {
        const data = await res.json()
        setEmojiPacks(data.packs || [])
      }
    } catch { /* ignore */ }
    setEmojiPacksLoaded(true)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/95 px-2 backdrop-blur">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Link href={`/village/${community.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar className="h-8 w-8 rounded-xl">
            <AvatarImage src={community.coverImageUrl || undefined} alt={community.name} />
            <AvatarFallback className="rounded-xl text-sm" style={{ backgroundColor: meta.color + '33' }}>
              {meta.emoji}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{community.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {online > 0 && (
                <>
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  {online}명 접속 중
                </>
              )}
              {online === 0 && (
                <>
                  <Users className="h-3 w-3" /> {community.regionName}
                </>
              )}
            </p>
          </div>
        </Link>
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href={`/village/${community.id}`} aria-label="마을 홈">
            <span className="text-base">{meta.emoji}</span>
          </Link>
        </Button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {messages.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              아직 대화가 없어요. 첫 메시지를 보내보세요!
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.authorUid === user.id}
              photo={m.photoId ? photoMap[m.photoId] || null : null}
            />
          ))}
          {typingFrom && typingFrom !== user.name && (
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
              {typingFrom}님이 입력 중...
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border/60 bg-background/95 px-2 py-2 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoPick}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            aria-label="사진 첨부"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>

          <Popover onOpenChange={(open) => { if (open) loadEmojiPacks() }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label="이모티콘"
              >
                <Smile className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              {/* 탭 헤더 */}
              <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setActivePackTab('unicode')}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    activePackTab === 'unicode' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  기본
                </button>
                {emojiPacks.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setActivePackTab(pack.id)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      activePackTab === pack.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {pack.name}
                  </button>
                ))}
              </div>
              {/* 이모지 그리드 */}
              <div className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto p-2">
                {activePackTab === 'unicode' ? (
                  EMOJI_SET.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => sendEmoji(emo)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl transition-colors hover:bg-muted"
                    >
                      {emo}
                    </button>
                  ))
                ) : (
                  emojiPacks
                    .find((p) => p.id === activePackTab)
                    ?.images.map((url, i) => (
                      <button
                        key={`${activePackTab}-${i}`}
                        type="button"
                        onClick={() => sendEmoji(url)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-7 w-7 object-contain" />
                      </button>
                    )) || (
                    <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">이모티콘이 없어요</p>
                  )
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* 게임은 화면 이동 없이 모달로 연다 */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            aria-label="게임"
            onClick={() => setGameOpen(true)}
          >
            <Gamepad2 className="h-5 w-5" />
          </Button>

          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="메시지를 입력하세요"
            className="min-h-10 flex-1 rounded-full border-border bg-card"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            aria-label="전송"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 게임 — 회장·관리자만 진행할 수 있고, 회원은 결과에 참여만 한다 */}
      <Dialog open={gameOpen} onOpenChange={setGameOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>마을 게임</DialogTitle>
          </DialogHeader>

          {canRunGame ? (
            <GamesClient
              embedded
              communities={[
                {
                  id: community.id,
                  name: community.name,
                  communityType: community.communityType,
                  members: gameMembers,
                },
              ]}
              defaultCommunityId={community.id}
            />
          ) : (
            <div className="py-8 text-center">
              <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">게임은 회장님이 시작해요</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                회장님이 게임을 진행하면 채팅방에 결과가 올라와요.
                <br />
                기다렸다가 함께 참여하시면 돼요.
              </p>
              <Button
                onClick={() => setGameOpen(false)}
                size="lg"
                className="mt-5 rounded-xl"
              >
                확인
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 사진 업로드 확인 — 실수로 올리는 사고를 막는다 */}
      <Dialog
        open={pendingFiles.length > 0}
        onOpenChange={(open) => {
          if (!open && !uploading) cancelPendingUpload()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>이 사진을 올릴까요?</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {community.name} 채팅방과 마을 홈페이지에 함께 공개돼요.
          </p>

          <div className="flex flex-wrap gap-2">
            {pendingPreviews.map((url, i) => (
              <div key={url} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`올릴 사진 ${i + 1}`}
                  className="h-28 w-28 rounded-xl bg-muted object-cover"
                />
                {!uploading && pendingPreviews.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePendingAt(i)}
                    aria-label="이 사진 빼기"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-sm text-destructive-foreground shadow"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={cancelPendingUpload}
              disabled={uploading}
              size="lg"
              className="rounded-xl"
            >
              취소
            </Button>
            <Button
              onClick={confirmPhotoUpload}
              disabled={uploading}
              size="lg"
              className="rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> 올리는 중…
                </>
              ) : (
                `${pendingFiles.length}장 올리기`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
