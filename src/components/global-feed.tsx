import Link from 'next/link'
import { MapPin, MessageCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommunityBadge } from '@/components/community-badge'
import { relativeTime } from '@/lib/village'
import type { FeedItem } from '@/lib/global-feed'

/**
 * 전국 마을 통합 피드 (SNS 형태).
 * 비회원도 볼 수 있는 공개 콘텐츠만 들어온다.
 */
export function GlobalFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        아직 올라온 소식이 없어요.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          {/* 작성자 + 마을 */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={item.authorPhotoURL || undefined} alt={item.authorName} />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold">
                {item.authorName?.slice(0, 1) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{item.authorName}</span>
                <CommunityBadge type={item.communityType} size="sm" />
              </div>
              <Link
                href={`/village/${item.communityId}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {item.communityName} · {item.regionName}
                </span>
              </Link>
            </div>
            {item.createdAt && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {relativeTime(item.createdAt)}
              </span>
            )}
          </div>

          {/* 본문 */}
          {item.kind === 'photo' && item.thumbnailUrl ? (
            <Link href={`/village/${item.communityId}`} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnailUrl}
                alt={item.aiCaption || `${item.communityName} 사진`}
                loading="lazy"
                className="max-h-[420px] w-full bg-muted object-cover"
              />
              {(item.aiCaption || item.exifAddress) && (
                <div className="px-3 py-2">
                  {item.aiCaption && <p className="text-sm">{item.aiCaption}</p>}
                  {item.exifAddress && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {item.exifAddress}
                    </p>
                  )}
                </div>
              )}
            </Link>
          ) : (
            <div className="px-3 pb-3">
              <p className="flex gap-2 whitespace-pre-line break-words rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{item.text}</span>
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
