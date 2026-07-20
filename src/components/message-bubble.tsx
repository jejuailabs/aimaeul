'use client'

import { useRouter } from 'next/navigation'
import { Gamepad2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PhotoWithExif, type ExifData } from '@/components/exif-overlay'
import { formatKoreanTime, relativeTime } from '@/lib/village'

export type PhotoData = {
  id: string
  storageUrl: string
  thumbnailUrl: string
  uploaderName?: string
  exifTakenAt?: any
  exifLat?: number | null
  exifLng?: number | null
  exifDevice?: string | null
  exifLens?: string | null
  exifAddress?: string | null
  aiCaption?: string | null
}

export type ChatMessageLike = {
  id: string
  authorUid: string
  authorName: string
  authorPhotoURL?: string | null
  type: string
  text?: string | null
  photoId?: string | null
  emojiUrl?: string | null
  gameResultPayload?: any | null
  createdAt: Date | string | any
}

type Props = {
  message: ChatMessageLike
  mine: boolean
  photo?: PhotoData | null
  compact?: boolean
}

function photoExif(p?: PhotoData | null): ExifData {
  if (!p) return {}
  return {
    takenAt: p.exifTakenAt,
    lat: p.exifLat,
    lng: p.exifLng,
    device: p.exifDevice,
    lens: p.exifLens,
    location: p.exifAddress ?? null,
  }
}

export function MessageBubble({ message, mine, photo, compact }: Props) {
  const router = useRouter()

  if (message.type === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.text}
        </span>
      </div>
    )
  }

  if (message.type === 'emoji') {
    return (
      <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
        {!mine && <AvatarBox name={message.authorName} src={message.authorPhotoURL} compact={compact} />}
        <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
          {!mine && !compact && (
            <span className="mb-0.5 px-1 text-xs text-muted-foreground">{message.authorName}</span>
          )}
          {message.emojiUrl?.startsWith('http') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.emojiUrl} alt="이모티콘" className="h-20 w-20 object-contain" />
          ) : (
            <div className="text-6xl leading-none">{message.emojiUrl}</div>
          )}
          <span className={cn('mt-1 px-1 text-[10px] text-muted-foreground', mine && 'text-right')}>
            {formatKoreanTime(message.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  if (message.type === 'game_result') {
    const payload = message.gameResultPayload || {}
    return (
      <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
        {!mine && <AvatarBox name={message.authorName} src={message.authorPhotoURL} compact={compact} />}
        <div className={cn('flex max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
          {!mine && !compact && (
            <span className="mb-0.5 px-1 text-xs text-muted-foreground">{message.authorName}</span>
          )}
          <div
            className={cn(
              'rounded-2xl border p-3 shadow-sm',
              mine
                ? 'rounded-br-md border-primary/30 bg-primary/10'
                : 'rounded-bl-md border-border bg-card'
            )}
          >
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Gamepad2 className="h-4 w-4 text-primary" />
              <span>{payload.gameType ?? '게임 결과'}</span>
            </div>
            <p className="text-sm font-medium">{payload.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {payload.resultSummary}
            </p>
            {payload.winner && (
              <p className="mt-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                🎉 당첨: {payload.winner}
              </p>
            )}
          </div>
          <span className={cn('mt-1 px-1 text-[10px] text-muted-foreground', mine && 'text-right')}>
            {formatKoreanTime(message.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  if (message.type === 'photo') {
    if (!photo) {
      return (
        <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
          {!mine && <AvatarBox name={message.authorName} src={message.authorPhotoURL} compact={compact} />}
          <div className="max-w-[70%] rounded-2xl border border-border bg-muted p-4 text-xs text-muted-foreground">
            <ImageIcon className="mb-1 h-4 w-4" /> 사진
          </div>
        </div>
      )
    }
    return (
      <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
        {!mine && <AvatarBox name={message.authorName} src={message.authorPhotoURL} compact={compact} />}
        <div className={cn('flex max-w-[75%] flex-col', mine ? 'items-end' : 'items-start')}>
          {!mine && !compact && (
            <span className="mb-0.5 px-1 text-xs text-muted-foreground">{message.authorName}</span>
          )}
          <div className="w-56 sm:w-64">
            <PhotoWithExif
              src={photo.thumbnailUrl || photo.storageUrl}
              alt={photo.aiCaption || `${message.authorName}님의 사진`}
              exif={photoExif(photo)}
              uploaderName={mine ? undefined : message.authorName}
            />
          </div>
          <span className={cn('mt-1 px-1 text-[10px] text-muted-foreground', mine && 'text-right')}>
            {formatKoreanTime(message.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
      {!mine && <AvatarBox name={message.authorName} src={message.authorPhotoURL} compact={compact} />}
      <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        {!mine && !compact && (
          <span className="mb-0.5 px-1 text-xs text-muted-foreground">{message.authorName}</span>
        )}
        <div
          className={cn(
            'whitespace-pre-line break-words px-3 py-2 text-sm shadow-sm',
            mine
              ? 'bubble-me rounded-2xl rounded-br-md'
              : 'bubble-other rounded-2xl rounded-bl-md'
          )}
        >
          {message.text}
        </div>
        <span className={cn('mt-0.5 px-1 text-[10px] text-muted-foreground', mine && 'text-right')}>
          {formatKoreanTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}

function AvatarBox({
  name,
  src,
  compact,
}: {
  name: string
  src?: string | null
  compact?: boolean
}) {
  return (
    <Avatar className={cn(compact ? 'h-7 w-7' : 'h-9 w-9', 'mt-4 shrink-0')}>
      <AvatarImage src={src || undefined} alt={name} />
      <AvatarFallback className="bg-primary/20 text-xs font-semibold">
        {name?.slice(0, 1) || '?'}
      </AvatarFallback>
    </Avatar>
  )
}
