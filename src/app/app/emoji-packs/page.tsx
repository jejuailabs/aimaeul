import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { EmojiPacksClient } from './emoji-packs-client'

export const dynamic = 'force-dynamic'

export default async function EmojiPacksPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/app/emoji-packs')
  if (user.communities.length === 0) redirect('/onboarding')

  return (
    <AppShell title="이모티콘 팩 관리">
      <EmojiPacksClient
        communities={user.communities}
        userId={user.uid}
      />
    </AppShell>
  )
}
