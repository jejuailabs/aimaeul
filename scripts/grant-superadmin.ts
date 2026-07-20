/**
 * 특정 사용자에게 슈퍼관리자 권한을 부여한다.
 *
 * 사용법:
 *   npx tsx scripts/grant-superadmin.ts <uid 또는 이메일>
 *
 * 슈퍼관리자는 모든 마을의 가입 신청을 승인할 수 있고,
 * 회장 모드 / 회원 모드로 전환해 체험할 수 있다.
 */
import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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
    console.error('사용법: npx tsx scripts/grant-superadmin.ts <uid 또는 이메일>')
    process.exit(1)
  }

  // uid로 먼저 찾고, 없으면 이메일로 조회한다.
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

  // 모든 공동체의 회장 권한도 함께 부여해 회장 모드를 체험할 수 있게 한다.
  const comms = await db.collection('communities').get()
  const allCommunityIds = comms.docs.map((d) => d.id)

  await userRef.update({
    role: 'superadmin',
    adminCommunities: allCommunityIds,
  })

  const after = (await userRef.get()).data()!
  console.log(`슈퍼관리자 권한 부여 완료`)
  console.log(`  uid: ${userRef.id}`)
  console.log(`  이름: ${after.displayName}`)
  console.log(`  이메일: ${after.email}`)
  console.log(`  role: ${after.role}`)
  console.log(`  회장 공동체: ${allCommunityIds.length}개 (${allCommunityIds.join(', ')})`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('실패:', e.message)
    process.exit(1)
  })
