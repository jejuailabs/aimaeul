import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { generateDailyDigest } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min for processing all communities

export async function GET(req: Request) {
  // Verify Vercel Cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Use yesterday's date as the target
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const targetDate = yesterday.toISOString().slice(0, 10)

  // Fetch all communities
  const communitiesSnap = await adminDb.collection('communities').get()
  const results: { communityId: string; ok: boolean; error?: string }[] = []

  for (const doc of communitiesSnap.docs) {
    try {
      await generateDailyDigest(doc.id, doc.data(), targetDate)
      results.push({ communityId: doc.id, ok: true })
    } catch (e: any) {
      console.error(`[cron/daily-digest] Failed for ${doc.id}:`, e)
      results.push({ communityId: doc.id, ok: false, error: e.message })
    }
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    processed: results.length,
    results,
  })
}
