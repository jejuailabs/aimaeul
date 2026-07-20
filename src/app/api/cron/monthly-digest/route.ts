import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { generateMonthlyDigest } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  // Verify Vercel Cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Target: previous month
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const targetMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

  // Fetch all communities
  const communitiesSnap = await adminDb.collection('communities').get()
  const results: { communityId: string; ok: boolean; error?: string }[] = []

  for (const doc of communitiesSnap.docs) {
    try {
      await generateMonthlyDigest(doc.id, doc.data(), targetMonth)
      results.push({ communityId: doc.id, ok: true })
    } catch (e: any) {
      console.error(`[cron/monthly-digest] Failed for ${doc.id}:`, e)
      results.push({ communityId: doc.id, ok: false, error: e.message })
    }
  }

  return NextResponse.json({
    ok: true,
    month: targetMonth,
    processed: results.length,
    results,
  })
}
