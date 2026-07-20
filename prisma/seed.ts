// 마을 공동체 플랫폼 — 시드 데이터
// 실행: bun run prisma/seed.ts  (또는 bun prisma/seed.ts)
// idempotent: 커뮤니티 inviteCode 기준 upsert. 기존 데이터는 보존하되 신규 필드 채움.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000)
const minsAgo = (n: number) => new Date(now.getTime() - n * 60000)
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000)

type SeedCommunity = {
  id: string
  communityType: string
  name: string
  regionName: string
  lat: number
  lng: number
  inviteCode: string
  isPublic: boolean
  coverImageUrl: string
  description: string
}

const communities: SeedCommunity[] = [
  {
    id: 'bongseong',
    communityType: '부녀회',
    name: '애월읍 봉성리 부녀회',
    regionName: '제주특별자치도 애월읍 봉성리',
    lat: 33.4649,
    lng: 126.3198,
    inviteCode: 'BONG2026',
    isPublic: true,
    coverImageUrl: '/uploads/seed/cover-bongseong.png',
    description:
      '제주 애월읍 봉성리 부녀회입니다. 감자·당근 수확, 김장 담가기, 마을 환경정화 등을 함께하고 있어요.',
  },
  {
    id: 'hongcheon',
    communityType: '청년회',
    name: '홍천 서면 청년회',
    regionName: '강원도 홍천군 서면',
    lat: 37.6932,
    lng: 127.8781,
    inviteCode: 'HOPE2026',
    isPublic: true,
    coverImageUrl: '/uploads/seed/cover-hongcheon.png',
    description:
      '강원도 홍천 서면 청년회입니다. 귀농 청년들과 함께 마을 축제 기획, 벼 수확 봉사, 등산 모임을 합니다.',
  },
  {
    id: 'hadong',
    communityType: '노인회',
    name: '하동 화개리 노인회',
    regionName: '경상남도 하동군 화개읍',
    lat: 35.2756,
    lng: 127.6267,
    inviteCode: 'TEA2026',
    isPublic: true,
    coverImageUrl: '/uploads/seed/cover-hadong.png',
    description:
      '경남 하동 화개리 노인회입니다. 녹차 밭 관리, 산책 모임, 건강 체조로 건강한 마을을 만듭니다.',
  },
  {
    id: 'jongno',
    communityType: '동호회',
    name: '종로 도심 등산 동호회',
    regionName: '서울특별시 종로구',
    lat: 37.5796,
    lng: 126.977,
    inviteCode: 'HIKE2026',
    isPublic: false,
    coverImageUrl: '/uploads/seed/cover-jongno.png',
    description:
      '서울 종로를 기반으로 매주 북악산·인왕산·남산을 오르는 도심 등산 동호회입니다. (비공개)',
  },
]

type SeedUser = {
  id: string
  email: string
  name: string
  photoURL?: string
  bio?: string
  communities: string[]
}

const users: SeedUser[] = [
  // 봉성리 부녀회
  { id: 'u-younghee', email: 'younghee@maul.kr', name: '김영희', communities: ['bongseong'], bio: '봉성리 부녀회장' },
  { id: 'u-soonja', email: 'soonja@maul.kr', name: '이순자', communities: ['bongseong'] },
  { id: 'u-misuk', email: 'misuk@maul.kr', name: '박미숙', communities: ['bongseong'] },
  { id: 'u-youngja', email: 'youngja@maul.kr', name: '강영자', communities: ['bongseong'] },
  // 홍천 청년회
  { id: 'u-minho', email: 'minho@maul.kr', name: '정민호', communities: ['hongcheon'], bio: '귀농 3년차' },
  { id: 'u-jieun', email: 'jieun@maul.kr', name: '한지은', communities: ['hongcheon'] },
  { id: 'u-donghyun', email: 'donghyun@maul.kr', name: '오동현', communities: ['hongcheon'] },
  // 하동 노인회
  { id: 'u-gildong', email: 'gildong@maul.kr', name: '홍길동 할아버지', communities: ['hadong'] },
  { id: 'u-sunok', email: 'sunok@maul.kr', name: '김순옥 할머니', communities: ['hadong'] },
  // 종로 등산 동호회
  { id: 'u-seojin', email: 'seojin@maul.kr', name: '이서진', communities: ['jongno'] },
  { id: 'u-hyemin', email: 'hyemin@maul.kr', name: '박혜민', communities: ['jongno'] },
]

type SeedPhoto = {
  id: string
  communityId: string
  uploaderId: string
  storageUrl: string
  thumbnailUrl: string
  exifTakenAt: Date
  exifLat?: number
  exifLng?: number
  exifDevice: string
  aiTags: string[]
  aiCaption: string
  createdAt: Date
}

const photos: SeedPhoto[] = [
  {
    id: 'ph-potato',
    communityId: 'bongseong',
    uploaderId: 'u-younghee',
    storageUrl: '/uploads/seed/photo-potato.png',
    thumbnailUrl: '/uploads/seed/photo-potato.png',
    exifTakenAt: hoursAgo(20),
    exifLat: 33.4649,
    exifLng: 126.3198,
    exifDevice: 'Galaxy S25 Ultra',
    aiTags: ['감자', '수확', '봉성리', '부녀회', '농작업'],
    aiCaption: '봉성리 부녀회원들이 감자를 수확하는 모습',
    createdAt: hoursAgo(19),
  },
  {
    id: 'ph-kimjang',
    communityId: 'bongseong',
    uploaderId: 'u-soonja',
    storageUrl: '/uploads/seed/photo-kimjang.png',
    thumbnailUrl: '/uploads/seed/photo-kimjang.png',
    exifTakenAt: daysAgo(2),
    exifLat: 33.465,
    exifLng: 126.32,
    exifDevice: 'iPhone 16 Pro',
    aiTags: ['김장', '김치', '겨울', '부녀회', '모임'],
    aiCaption: '부녀회원들이 모여 김장을 담그는 모습',
    createdAt: daysAgo(2),
  },
  {
    id: 'ph-cleanup',
    communityId: 'bongseong',
    uploaderId: 'u-misuk',
    storageUrl: '/uploads/seed/photo-cleanup.png',
    thumbnailUrl: '/uploads/seed/photo-cleanup.png',
    exifTakenAt: daysAgo(5),
    exifLat: 33.4648,
    exifLng: 126.32,
    exifDevice: 'Galaxy S24',
    aiTags: ['환경정화', '봉사', '마을길', '청소'],
    aiCaption: '마을 진입로 환경정화 봉사 활동',
    createdAt: daysAgo(5),
  },
  {
    id: 'ph-sunset',
    communityId: 'bongseong',
    uploaderId: 'u-youngja',
    storageUrl: '/uploads/seed/photo-sunset.png',
    thumbnailUrl: '/uploads/seed/photo-sunset.png',
    exifTakenAt: daysAgo(7),
    exifLat: 33.465,
    exifLng: 126.321,
    exifDevice: 'iPhone 15',
    aiTags: ['노을', '풍경', '해질녘', '농촌'],
    aiCaption: '봉성리 들판에 지는 노을',
    createdAt: daysAgo(7),
  },
  {
    id: 'ph-flowers',
    communityId: 'hongcheon',
    uploaderId: 'u-jieun',
    storageUrl: '/uploads/seed/photo-flowers.png',
    thumbnailUrl: '/uploads/seed/photo-flowers.png',
    exifTakenAt: daysAgo(3),
    exifLat: 37.6932,
    exifLng: 127.8781,
    exifDevice: 'iPhone 16 Pro',
    aiTags: ['벚꽃', '봄', '꽃', '마을길'],
    aiCaption: '홍천 서면 마을길에 핀 벚꽃',
    createdAt: daysAgo(3),
  },
  {
    id: 'ph-festival',
    communityId: 'hongcheon',
    uploaderId: 'u-minho',
    storageUrl: '/uploads/seed/photo-festival.png',
    thumbnailUrl: '/uploads/seed/photo-festival.png',
    exifTakenAt: daysAgo(10),
    exifLat: 37.6933,
    exifLng: 127.8782,
    exifDevice: 'Galaxy S25 Ultra',
    aiTags: ['축제', '잔치', '마을잔치', '만찬', '저녁'],
    aiCaption: '홍천 서면 청년회 마을 잔치 만찬',
    createdAt: daysAgo(10),
  },
]

type SeedMessage = {
  communityId: string
  authorId: string
  authorName: string
  type: string
  text?: string
  photoId?: string
  emojiUrl?: string
  gameResultPayload?: any
  createdAt: Date
}

const messages: SeedMessage[] = [
  // 봉성리 부녀회 — 최근 대화 흐름
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'system', text: '김영희님이 참여했습니다', createdAt: daysAgo(30) },
  { communityId: 'bongseong', authorId: 'u-soonja', authorName: '이순자', type: 'system', text: '이순자님이 참여했습니다', createdAt: daysAgo(30) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'text', text: '내일 오전 9시 감자밭에서 수확합니다~ 다들 무릎 보호대 챙기세요 🥔', createdAt: hoursAgo(28) },
  { communityId: 'bongseong', authorId: 'u-misuk', authorName: '박미숙', type: 'text', text: '네 회장님! 저는 삽 챙겨갈게요', createdAt: hoursAgo(27) },
  { communityId: 'bongseong', authorId: 'u-soonja', authorName: '이순자', type: 'text', text: '저도요~ 점심은 제가 떡국 끓여갈게요', createdAt: hoursAgo(26) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'text', text: '감사해요 순자님 🙏 오늘 다들 고생 많으셨어요', createdAt: hoursAgo(19) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'photo', photoId: 'ph-potato', text: null, createdAt: hoursAgo(19) },
  { communityId: 'bongseong', authorId: 'u-misuk', authorName: '박미숙', type: 'text', text: '와 금방 캤네요ㅎㅎ 올해 감자 대박이네!', createdAt: hoursAgo(18) },
  { communityId: 'bongseong', authorId: 'u-youngja', authorName: '강영자', type: 'text', text: '저녁에 회관에서 도시락 싸서 드실 분?', createdAt: hoursAgo(6) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'emoji', emojiUrl: '👍', createdAt: hoursAgo(5) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'game_result', gameResultPayload: { gameType: '순번정하기', title: '감자캐기 순번', resultSummary: '① 김영희 ② 이순자 ③ 박미숙 ④ 강영자', winner: null }, text: null, createdAt: hoursAgo(28) },
  { communityId: 'bongseong', authorId: 'u-misuk', authorName: '박미숙', type: 'game_result', gameResultPayload: { gameType: '룰렛', title: '오늘 청소 당번', resultSummary: '당첨: 김영희 🎉', winner: '김영희' }, text: null, createdAt: daysAgo(1) },
  { communityId: 'bongseong', authorId: 'u-soonja', authorName: '이순자', type: 'text', text: '다음 주 수요일 김장 모임 가격 이야기해요. 배추 200포기면 될까요?', createdAt: daysAgo(2) },
  { communityId: 'bongseong', authorId: 'u-soonja', authorName: '이순자', type: 'photo', photoId: 'ph-kimjang', text: null, createdAt: daysAgo(2) },
  { communityId: 'bongseong', authorId: 'u-misuk', authorName: '박미숙', type: 'photo', photoId: 'ph-cleanup', text: null, createdAt: daysAgo(5) },
  { communityId: 'bongseong', authorId: 'u-youngja', authorName: '강영자', type: 'photo', photoId: 'ph-sunset', text: null, createdAt: daysAgo(7) },
  { communityId: 'bongseong', authorId: 'u-younghee', authorName: '김영희', type: 'text', text: '이번 주 토요일 마을 진입로 환경정화 합니다. 9시 회관 앞!', createdAt: daysAgo(5) },

  // 홍천 청년회
  { communityId: 'hongcheon', authorId: 'u-minho', authorName: '정민호', type: 'text', text: '이번 주 일요일 벼 수확 봉사하러 갑니다. 7시 서면사무소 앞 출발!', createdAt: daysAgo(4) },
  { communityId: 'hongcheon', authorId: 'u-jieun', authorName: '한지은', type: 'text', text: '저도 참석할게요. 장갑 여분 챙겨갈게요 🧤', createdAt: daysAgo(4) },
  { communityId: 'hongcheon', authorId: 'u-jieun', authorName: '한지은', type: 'photo', photoId: 'ph-flowers', text: null, createdAt: daysAgo(3) },
  { communityId: 'hongcheon', authorId: 'u-donghyun', authorName: '오동현', type: 'text', text: '서면 마을길 벚꽃 폈네요 예쁘다ㅎㅎ', createdAt: daysAgo(3) },
  { communityId: 'hongcheon', authorId: 'u-minho', authorName: '정민호', type: 'photo', photoId: 'ph-festival', text: null, createdAt: daysAgo(10) },
  { communityId: 'hongcheon', authorId: 'u-minho', authorName: '정민호', type: 'text', text: '지난 마을잔치 사진 올립니다~ 다들 즐거우셨죠?', createdAt: daysAgo(10) },
  { communityId: 'hongcheon', authorId: 'u-donghyun', authorName: '오동현', type: 'game_result', gameResultPayload: { gameType: '팀나누기', title: '수확 봉사 팀 나누기', resultSummary: 'A팀: 정민호, 한지은 / B팀: 오동현, 김영수', winner: null }, text: null, createdAt: daysAgo(4) },

  // 하동 노인회
  { communityId: 'hadong', authorId: 'u-gildong', authorName: '홍길동 할아버지', type: 'text', text: '내일 아침 화개장터에서 산책 모임 있어요. 7시에 뵙겠습니다.', createdAt: daysAgo(1) },
  { communityId: 'hadong', authorId: 'u-sunok', authorName: '김순옥 할머니', type: 'text', text: '네 늦지 않게 가겠습니다~', createdAt: daysAgo(1) },
  { communityId: 'hadong', authorId: 'u-gildong', authorName: '홍길동 할아버지', type: 'text', text: '녹차 따러 가실 분? 모레 오전에 밭에 갑니다.', createdAt: hoursAgo(10) },

  // 종로 등산 동호회 (비공개)
  { communityId: 'jongno', authorId: 'u-seojin', authorName: '이서진', type: 'text', text: '이번 주 토요일 북악산 오릅니다. 창의문 앞 8시 집결!', createdAt: daysAgo(2) },
  { communityId: 'jongno', authorId: 'u-hyemin', authorName: '박혜민', type: 'text', text: '참석합니다 🙋‍♀️', createdAt: daysAgo(2) },
]

const events = [
  { id: 'ev-potato', communityId: 'bongseong', title: '봉성리 감자 수확', description: '오전 9시 감자밭 집결. 무릎 보호대, 삽, 장갑 지참.', startAt: daysAhead(1), endAt: daysAhead(1), location: '봉성리 감자밭', createdById: 'u-younghee' },
  { id: 'ev-kimjang', communityId: 'bongseong', title: '부녀회 김장 담기', description: '배추 200포기, 부재료 각자 1가지씩 준비. 회관 앞마당.', startAt: daysAhead(5), endAt: daysAhead(5), location: '부녀회관 앞마당', createdById: 'u-soonja' },
  { id: 'ev-harvest', communityId: 'hongcheon', title: '서면 벼 수확 봉사', description: '7시 서면사무소 앞 출발. 도시락 개별 준비.', startAt: daysAhead(2), endAt: daysAhead(2), location: '서면사무소 앞', createdById: 'u-minho' },
  { id: 'ev-walk', communityId: 'hadong', title: '화개장터 산책 모임', description: '매일 아침 7시. 가볍게 걸으며 건강 챙겨요.', startAt: daysAhead(1), endAt: daysAhead(1), location: '화개장터', createdById: 'u-gildong' },
]

const reports = [
  { id: 'rp-1', communityId: 'bongseong', reporterId: 'u-misuk', photoUrl: '/uploads/seed/photo-cleanup.png', exifRaw: '{}', description: '마을 진입로 포트홀 발생. 차량 통행 주의 요망.', status: '접수', createdAt: daysAgo(3) },
  { id: 'rp-2', communityId: 'bongseong', reporterId: 'u-youngja', photoUrl: null, exifRaw: '{}', description: '회관 옆 가로등 고장. 밤에 어두워 위험합니다.', status: '안전신문고 전달완료', createdAt: daysAgo(8) },
]

const vacantHouses = [
  { id: 'vh-1', communityId: 'bongseong', posterId: 'u-younghee', photos: '["/uploads/seed/cover-bongseong.png"]', monthlyRent: 30, deposit: 500, description: '봉성리 한적한 안방. 감자밭 뷰. 전세 전환 가능.', lat: 33.465, lng: 126.32, status: '게시중', createdAt: daysAgo(6) },
  { id: 'vh-2', communityId: 'hongcheon', posterId: 'u-minho', photos: '["/uploads/seed/cover-hongcheon.png"]', monthlyRent: 20, deposit: 300, description: '홍천 서면 농가주택. 앞마당 넓고 물 좋습니다.', lat: 37.6932, lng: 127.8781, status: '게시중', createdAt: daysAgo(12) },
]

const today = new Date().toISOString().slice(0, 10)
const dailyDigests = [
  {
    id: 'dd-bongseong-today',
    communityId: 'bongseong',
    date: today,
    summaryText:
      '오늘 봉성리 부녀회는 오전 감자 수확을 시작으로, 오후에는 마을 진입로 환경정화 봉사를 진행했습니다. 강영자님이 올린 노을 사진이 화제였어요. 내일은 김장 모임 준비 회의가 예정되어 있습니다.',
    topPhotos: '["ph-potato","ph-sunset"]',
    eventHighlights: '["감자 수확 (오전 9시)","환경정화 봉사 (오후 2시)"]',
    topKeywords: '["감자","수확","환경정화","김장","노을"]',
    tomorrowSchedulePreview: '내일 오전 9시 감자밭 수확 속행',
    isMemorable: false,
  },
]

async function main() {
  console.log('🌱 시드 시작...')

  // 1) 커뮤니티
  for (const c of communities) {
    await db.community.upsert({
      where: { id: c.id },
      create: c,
      update: {
        communityType: c.communityType,
        name: c.name,
        regionName: c.regionName,
        lat: c.lat,
        lng: c.lng,
        inviteCode: c.inviteCode,
        isPublic: c.isPublic,
        coverImageUrl: c.coverImageUrl,
        description: c.description,
      },
    })
  }

  // 2) 유저
  for (const u of users) {
    await db.user.upsert({
      where: { id: u.id },
      create: { id: u.id, email: u.email, name: u.name, photoURL: u.photoURL, bio: u.bio },
      update: { email: u.email, name: u.name, photoURL: u.photoURL, bio: u.bio },
    })
  }

  // 3) 멤버십
  for (const u of users) {
    for (const cid of u.communities) {
      await db.communityMember.upsert({
        where: { communityId_userId: { communityId: cid, userId: u.id } },
        create: { communityId: cid, userId: u.id },
        update: {},
      })
    }
  }

  // 4) 사진 (기존 id 보존: delete + create)
  for (const p of photos) {
    await db.photo.deleteMany({ where: { id: p.id } }).catch(() => {})
    await db.photo.create({
      data: {
        id: p.id,
        communityId: p.communityId,
        uploaderId: p.uploaderId,
        uploaderName: users.find((u) => u.id === p.uploaderId)!.name,
        storageUrl: p.storageUrl,
        thumbnailUrl: p.thumbnailUrl,
        exifTakenAt: p.exifTakenAt,
        exifLat: p.exifLat ?? null,
        exifLng: p.exifLng ?? null,
        exifDevice: p.exifDevice,
        aiTags: JSON.stringify(p.aiTags),
        aiCaption: p.aiCaption,
      },
    })
  }

  // 5) 메시지 (delete + recreate to keep order)
  await db.message.deleteMany({})
  for (const m of messages) {
    await db.message.create({
      data: {
        communityId: m.communityId,
        authorId: m.authorId,
        authorName: m.authorName,
        type: m.type,
        text: m.text ?? null,
        photoId: m.photoId ?? null,
        emojiUrl: m.emojiUrl ?? null,
        gameResultPayload: m.gameResultPayload ? JSON.stringify(m.gameResultPayload) : 'null',
        createdAt: m.createdAt,
      },
    })
  }

  // 6) 이벤트
  for (const e of events) {
    await db.event.deleteMany({ where: { id: e.id } }).catch(() => {})
    await db.event.create({
      data: {
        id: e.id,
        communityId: e.communityId,
        title: e.title,
        description: e.description,
        startAt: e.startAt,
        endAt: e.endAt,
        location: e.location,
        createdById: e.createdById,
      },
    })
  }

  // 7) 제보
  for (const r of reports) {
    await db.report.deleteMany({ where: { id: r.id } }).catch(() => {})
    await db.report.create({
      data: {
        id: r.id,
        communityId: r.communityId,
        reporterId: r.reporterId,
        photoUrl: r.photoUrl,
        exifRaw: r.exifRaw,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
      },
    })
  }

  // 8) 빈집
  for (const v of vacantHouses) {
    await db.vacantHouse.deleteMany({ where: { id: v.id } }).catch(() => {})
    await db.vacantHouse.create({
      data: {
        id: v.id,
        communityId: v.communityId,
        posterId: v.posterId,
        photos: v.photos,
        monthlyRent: v.monthlyRent,
        deposit: v.deposit,
        description: v.description,
        lat: v.lat,
        lng: v.lng,
        status: v.status,
        createdAt: v.createdAt,
      },
    })
  }

  // 9) 일일신문
  for (const d of dailyDigests) {
    await db.dailyDigest.upsert({
      where: { communityId_date: { communityId: d.communityId, date: d.date } },
      create: d,
      update: d,
    })
  }

  console.log(`✅ 시드 완료: 커뮤니티 ${communities.length}, 유저 ${users.length}, 사진 ${photos.length}, 메시지 ${messages.length}, 이벤트 ${events.length}, 제보 ${reports.length}, 빈집 ${vacantHouses.length}, 일일신문 ${dailyDigests.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
