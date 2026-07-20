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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatSocket, type ChatMessage } from '@/hooks/use-chat-socket'
import { MessageBubble, type PhotoData } from '@/components/message-bubble'
import { communityTypeMeta, formatKoreanTime } from '@/lib/village'
import { cn } from '@/lib/utils'
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
}

export function ChatRoomClient({
  community,
  user,
  initialMessages,
  photoMap,
}: Props) {
  const router = useRouter()
  const { messages, send, online, typingFrom } = useChatSocket(
    community.id,
    initialMessages,
    300
  )
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
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

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('communityId', community.id)
        fd.append('broadcast', 'true')
        const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          toast.error(d.error || '사진 업로드 실패')
        }
      }
      toast.success('사진을 올렸어요 📷')
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

          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="게임">
            <Link href={`/app/games?communityId=${community.id}`}>
              <Gamepad2 className="h-5 w-5" />
            </Link>
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
    </div>
  )
}
