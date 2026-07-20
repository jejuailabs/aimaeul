import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommunityBadge } from '@/components/community-badge'
import { getCurrentUser } from '@/lib/session'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { createMessageAndBroadcast } from '@/lib/broadcast'

export const dynamic = 'force-dynamic'

/**
 * 초대 링크 진입점.
 *
 * 스마트폰이 익숙하지 않은 어르신 회원을 위해 "초대코드 입력" 없이
 * 링크를 누르는 것만으로 마을에 참여되도록 한다.
 * 미로그인 상태면 로그인 후 이 페이지로 되돌아온다.
 */
export default async function JoinByInvitePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const inviteCode = decodeURIComponent(code).trim().toUpperCase()

  const snap = await adminDb
    .collection('communities')
    .where('inviteCode', '==', inviteCode)
    .limit(1)
    .get()

  const doc = snap.docs[0]
  if (!doc) return <InviteError message="초대 링크가 올바르지 않거나 만료되었어요." />

  const community = doc.data()
  const user = await getCurrentUser()

  // 로그인 전이면 로그인 후 이 링크로 되돌아온다.
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${inviteCode}`)}`)
  }

  // 이미 참여한 마을이면 바로 채팅방으로.
  if (user.communities.some((c) => c.id === doc.id)) {
    redirect(`/app/chat/${doc.id}`)
  }

  // 초대 링크는 회장이 직접 보낸 것이므로 승인 없이 참여시키되, 이력은 남긴다.
  await adminDb.collection('users').doc(user.uid).update({
    communityIds: FieldValue.arrayUnion(doc.id),
  })

  const reqRef = adminDb.collection('membershipRequests').doc()
  await reqRef.set({
    requestId: reqRef.id,
    communityId: doc.id,
    communityName: community.name,
    communityType: community.communityType,
    regionName: community.regionName,
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
    message: null,
    source: 'invite',
    status: 'approved',
    createdAt: FieldValue.serverTimestamp(),
    decidedAt: FieldValue.serverTimestamp(),
    decidedBy: 'invite-link',
  })

  await createMessageAndBroadcast({
    communityId: doc.id,
    authorUid: user.uid,
    authorName: '시스템',
    type: 'system',
    text: `${user.displayName}님이 참여했습니다`,
  })

  // 참여 완료 → 카카오톡과 동일한 채팅 화면으로 바로 진입
  redirect(`/app/chat/${doc.id}`)
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">{message}</p>
      <p className="text-sm text-muted-foreground">
        마을 회장님께 초대 링크를 다시 받아주세요.
      </p>
      <Button asChild className="rounded-full">
        <Link href="/">마을 지도로 가기</Link>
      </Button>
    </div>
  )
}
