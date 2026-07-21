import Link from 'next/link'
import { Camera, MapPin, MessageCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommunityBadge } from '@/components/community-badge'
import { relativeTime } from '@/lib/village'
import type { GlobalFeed as GlobalFeedData, PhotoFeedItem, TextFeedItem } from '@/lib/global-feed'

/**
 * 전국 마을 통합 피드.
 *
 * 사진 소식이 가장 눈에 띄어야 하므로 사진 섹션을 위에 크게 두고,
 * 사진 직후에 이어진 대화는 그 사진 카드 안에 말풍선으로 붙인다.
 * 사진과 무관한 대화만 아래 "마을 대화" 섹션에 모아 보여준다.
 */
export function GlobalFeed({ feed }: { feed: GlobalFeedData }) {
  const { photos, texts } = feed

  if (photos.length === 0 && texts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        아직 올라온 소식이 없어요.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {photos.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-bold">
            <Camera className="h-4 w-4 text-primary" /> 사진 소식
          </h3>
          <div className="space-y-4">
            {photos.map((p) => (
              <PhotoCard key={p.id} item={p} />
            ))}
          </div>
        </section>
      )}

      {texts.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-bold">
            <MessageCircle className="h-4 w-4 text-muted-foreground" /> 마을 대화
          </h3>
          <div className="space-y-2">
            {texts.map((t) => (
              <TextCard key={t.id} item={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function VillageLine({
  communityId,
  communityName,
  regionName,
}: {
  communityId: string
  communityName: string
  regionName: string
}) {
  return (
    <Link
      href={`/village/${communityId}`}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <MapPin className="h-3 w-3" />
      <span className="truncate">
        {communityName} · {regionName}
      </span>
    </Link>
  )
}

function PhotoCard({ item }: { item: PhotoFeedItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
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
          <VillageLine
            communityId={item.communityId}
            communityName={item.communityName}
            regionName={item.regionName}
          />
        </div>
        {item.createdAt && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {relativeTime(item.createdAt)}
          </span>
        )}
      </div>

      {item.thumbnailUrl && (
        <Link href={`/village/${item.communityId}`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnailUrl}
            alt={item.aiCaption || `${item.communityName} 사진`}
            loading="lazy"
            className="max-h-[440px] w-full bg-muted object-cover"
          />
        </Link>
      )}

      {(item.aiCaption || item.exifAddress) && (
        <div className="px-3 pt-2">
          {item.aiCaption && <p className="text-sm">{item.aiCaption}</p>}
          {item.exifAddress && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {item.exifAddress}
            </p>
          )}
        </div>
      )}

      {/* 사진 직후 대화 — 어떤 이야기가 이어졌는지 바로 보이게 */}
      {item.comments.length > 0 && (
        <div className="space-y-1.5 px-3 pb-3 pt-2">
          {item.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                <AvatarImage src={c.authorPhotoURL || undefined} alt={c.authorName} />
                <AvatarFallback className="bg-muted text-[10px] font-semibold">
                  {c.authorName?.slice(0, 1) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="mr-1 text-[11px] font-semibold text-muted-foreground">
                  {c.authorName}
                </span>
                <span className="inline-block rounded-2xl rounded-tl-md bg-muted/70 px-2.5 py-1.5 text-sm">
                  {c.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {item.comments.length === 0 && !item.aiCaption && <div className="pb-2" />}
    </article>
  )
}

function TextCard({ item }: { item: TextFeedItem }) {
  return (
    <article className="rounded-2xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={item.authorPhotoURL || undefined} alt={item.authorName} />
          <AvatarFallback className="bg-primary/20 text-[10px] font-semibold">
            {item.authorName?.slice(0, 1) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">{item.authorName}</span>
            <CommunityBadge type={item.communityType} size="sm" />
          </div>
        </div>
        {item.createdAt && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relativeTime(item.createdAt)}
          </span>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-line break-words rounded-xl bg-muted/50 px-3 py-2 text-sm">
        {item.text}
      </p>
      <div className="mt-1.5">
        <VillageLine
          communityId={item.communityId}
          communityName={item.communityName}
          regionName={item.regionName}
        />
      </div>
    </article>
  )
}
