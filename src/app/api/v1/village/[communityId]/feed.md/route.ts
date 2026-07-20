import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { fetchVillageFeed, type FeedItem } from '@/lib/village-feed'

export const revalidate = 300 // ISR: 5 min

function formatFeedAsMarkdown(feed: {
  communityId: string
  communityName: string
  date: string
  items: FeedItem[]
  total: number
}): string {
  const lines: string[] = []
  lines.push(`# ${feed.communityName} - Village Feed`)
  lines.push(``)
  lines.push(`**Date:** ${feed.date}`)
  lines.push(`**Total items:** ${feed.total}`)
  lines.push(``)

  if (feed.items.length === 0) {
    lines.push(`_No activity for this period._`)
    return lines.join('\n')
  }

  lines.push(`## Timeline`)
  lines.push(``)

  for (const item of feed.items) {
    const time = item.time.slice(11, 16) // HH:MM
    switch (item.type) {
      case 'text':
        lines.push(`- **[${time}]** ${item.authorName}: ${item.text}`)
        break
      case 'photo':
        lines.push(`- **[${time}]** ${item.authorName} shared a photo${item.caption ? `: "${item.caption}"` : ''}`)
        if (item.photoUrl) lines.push(`  - ![photo](${item.photoUrl})`)
        break
      case 'event':
        lines.push(`- **[${time}]** Event: **${item.eventTitle}**${item.eventLocation ? ` (${item.eventLocation})` : ''}`)
        break
      case 'game_result':
        lines.push(`- **[${time}]** ${item.authorName} shared a game result`)
        break
    }
  }

  lines.push(``)
  lines.push(`---`)
  lines.push(`_Generated from ${feed.communityName} village feed._`)

  return lines.join('\n')
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  const { communityId } = await params
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')

  const communitySnap = await adminDb.collection('communities').doc(communityId).get()
  if (!communitySnap.exists) {
    return new NextResponse('Community not found', { status: 404 })
  }
  const community = communitySnap.data()!
  if (!community.isPublic) {
    return new NextResponse('Private community', { status: 403 })
  }

  const feed = await fetchVillageFeed(communityId, community, dateParam)
  const markdown = formatFeedAsMarkdown(feed)

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
