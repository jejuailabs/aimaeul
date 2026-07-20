import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { config } from 'dotenv'

config({ path: '.env.local' })

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}

const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)

async function seed() {
  console.log('Firestore 시드 데이터 생성 시작...')

  const communities = [
    {
      id: 'comm_saneuri',
      name: '산으리마을',
      regionName: '경상북도 영양군 석보면',
      communityType: '부녀회',
      description: '산으리마을 부녀회입니다. 함께 모여 마을을 가꿔가요!',
      coverImageUrl: null,
      inviteCode: 'SANEURI2024',
      isPublic: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      id: 'comm_dure',
      name: '두레마을 청년회',
      regionName: '전라남도 담양군 수북면',
      communityType: '청년회',
      description: '두레마을 청년들이 함께 만들어가는 커뮤니티입니다.',
      coverImageUrl: null,
      inviteCode: 'DURE2024',
      isPublic: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      id: 'comm_songhak',
      name: '송학마을 노인회',
      regionName: '강원도 평창군 대화면',
      communityType: '노인회',
      description: '송학마을 어르신들의 소통 공간입니다.',
      coverImageUrl: null,
      inviteCode: 'SONGHAK24',
      isPublic: true,
      createdAt: FieldValue.serverTimestamp(),
    },
  ]

  for (const c of communities) {
    const { id, ...data } = c
    await db.collection('communities').doc(id).set(data)
    console.log(`  커뮤니티 생성: ${c.name}`)
  }

  const demoUser = {
    displayName: '테스트 사용자',
    email: 'test@example.com',
    photoURL: null,
    communityIds: ['comm_saneuri', 'comm_dure'],
    createdAt: FieldValue.serverTimestamp(),
  }
  await db.collection('users').doc('demo_user_001').set(demoUser)
  console.log(`  사용자 생성: ${demoUser.displayName}`)

  const demoUser2 = {
    displayName: '김영희',
    email: 'younghee@example.com',
    photoURL: null,
    communityIds: ['comm_saneuri'],
    createdAt: FieldValue.serverTimestamp(),
  }
  await db.collection('users').doc('demo_user_002').set(demoUser2)
  console.log(`  사용자 생성: ${demoUser2.displayName}`)

  const demoUser3 = {
    displayName: '박철수',
    email: 'cheolsu@example.com',
    photoURL: null,
    communityIds: ['comm_saneuri', 'comm_dure', 'comm_songhak'],
    createdAt: FieldValue.serverTimestamp(),
  }
  await db.collection('users').doc('demo_user_003').set(demoUser3)
  console.log(`  사용자 생성: ${demoUser3.displayName}`)

  const messages = [
    { authorUid: 'demo_user_001', authorName: '테스트 사용자', type: 'text', text: '안녕하세요! 오늘 날씨가 정말 좋네요 🌞' },
    { authorUid: 'demo_user_002', authorName: '김영희', type: 'text', text: '맞아요~ 오늘 밭에 나가서 고추 좀 따려고요' },
    { authorUid: 'demo_user_003', authorName: '박철수', type: 'text', text: '저도 같이 갈게요! 우리 같이 하면 금방 끝나죠' },
    { authorUid: 'demo_user_001', authorName: '테스트 사용자', type: 'text', text: '점심은 제가 콩나물국 끓일게요 ㅎㅎ' },
    { authorUid: 'demo_user_002', authorName: '김영희', type: 'text', text: '아 좋아요! 감사합니다 😊' },
  ]

  const msgCol = db.collection('communities').doc('comm_saneuri').collection('messages')
  for (const msg of messages) {
    await msgCol.add({
      ...msg,
      authorPhotoURL: null,
      photoId: null,
      emojiUrl: null,
      gameResultPayload: null,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  console.log(`  메시지 ${messages.length}건 생성 (산으리마을)`)

  const now = new Date()
  const events = [
    {
      communityId: 'comm_saneuri',
      title: '마을 대청소의 날',
      description: '봄맞이 마을 대청소를 합니다. 모두 참여해주세요!',
      location: '마을회관 앞',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 9, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 0),
      createdBy: 'demo_user_001',
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      communityId: 'comm_saneuri',
      title: '부녀회 월례회의',
      description: '이번 달 마을 소식 공유 및 다음 행사 계획을 논의합니다.',
      location: '마을회관 2층',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 14, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 16, 0),
      createdBy: 'demo_user_002',
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      communityId: 'comm_dure',
      title: '청년회 바비큐 파티',
      description: '여름맞이 바비큐 파티! 가족과 함께 오세요.',
      location: '두레마을 정자나무 앞',
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 17, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 21, 0),
      createdBy: 'demo_user_003',
      createdAt: FieldValue.serverTimestamp(),
    },
  ]

  for (const ev of events) {
    await db.collection('events').add(ev)
  }
  console.log(`  행사 ${events.length}건 생성`)

  const vacantHouses = [
    {
      communityId: 'comm_saneuri',
      title: '산으리 돌담집',
      description: '마을 입구 돌담집입니다. 마당 넓고 텃밭 가능합니다.',
      address: '경상북도 영양군 석보면 산으리 123',
      area: 85,
      rooms: 3,
      deposit: 500,
      rent: 20,
      status: '게시중',
      imageUrls: [],
      posterId: 'demo_user_001',
      posterName: '테스트 사용자',
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      communityId: 'comm_saneuri',
      title: '마을회관 옆 빈집',
      description: '리모델링 필요하지만 위치가 좋습니다. 마을회관 바로 옆이에요.',
      address: '경상북도 영양군 석보면 산으리 456',
      area: 65,
      rooms: 2,
      deposit: 300,
      rent: 15,
      status: '게시중',
      imageUrls: [],
      posterId: 'demo_user_002',
      posterName: '김영희',
      createdAt: FieldValue.serverTimestamp(),
    },
  ]

  for (const vh of vacantHouses) {
    await db.collection('vacantHouses').add(vh)
  }
  console.log(`  빈집 ${vacantHouses.length}건 생성`)

  console.log('\n시드 데이터 생성 완료!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('시드 실패:', err)
  process.exit(1)
})
