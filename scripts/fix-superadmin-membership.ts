/**
 * 슈퍼관리자의 대기 중 가입 신청을 정리하고 모든 공개 마을에 참여시킨다.
 *
 * 슈퍼관리자는 스스로 승인 권한을 갖기 때문에 승인을 기다리는 상태 자체가
 * 의미가 없다. 체험용으로 전 마을에 즉시 소속시킨다.
 *
 * 사용법: npx tsx scripts/fix-superadmin-membership.ts <uid 또는 이메일>
 */
import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

config({ path: '.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('사용법: npx tsx scripts/fix-superadmin-membership.ts <uid 또는 이메일>')
    process.exit(1)
  }

  let userRef = db.collection('users').doc(target)
  let snap = await userRef.get()
  if (!snap.exists) {
    const byEmail = await db.collection('users').where('email', '==', target).limit(1).get()
    if (byEmail.empty) {
      console.error(`사용자를 찾을 수 없습니다: ${target}`)
      process.exit(1)
    }
    userRef = byEmail.docs[0].ref
    snap = byEmail.docs[0]
  }

  const uid = userRef.id

  // 1) 대기 중 신청을 승인 처리
  const pending = await db
    .collection('membershipRequests')
    .where('uid', '==', uid)
    .where('status', '==', 'pending')
    .get()

  for (const d of pending.docs) {
    await d.ref.update({
      status: 'approved',
      decidedAt: FieldValue.serverTimestamp(),
      decidedBy: uid,
    })
    console.log(`  대기 신청 승인 처리: ${d.data().communityName}`)
  }
  if (pending.empty) console.log('  대기 중인 신청 없음')

  // 2) 모든 공개 마을에 참여 + 회장 권한
  const comms = await db.collection('communities').where('isPublic', '==', true).get()
  const ids = comms.docs.map((d) => d.id)

  await userRef.update({
    communityIds: FieldValue.arrayUnion(...ids),
    adminCommunities: FieldValue.arrayUnion(...ids),
  })

  const after = (await userRef.get()).data()!
  console.log('\n정리 완료')
  console.log(`  uid: ${uid}`)
  console.log(`  이메일: ${after.email}`)
  console.log(`  role: ${after.role}`)
  console.log(`  communityIds: ${JSON.stringify(after.communityIds)}`)
  console.log(`  adminCommunities: ${JSON.stringify(after.adminCommunities)}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('실패:', e.message)
    process.exit(1)
  })
