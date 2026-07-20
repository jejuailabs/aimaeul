# 01. 아키텍처 및 데이터 모델

## 목표

Vercel(Next.js) + Firebase(Auth/Firestore/Storage/Functions) 기반의 전체 시스템 골격과,
모든 기능 문서가 공유하는 Firestore 데이터 모델을 정의한다. 이 문서의 스키마가 전체 프로젝트의
source of truth이며, 다른 문서에서 컬렉션을 언급할 때는 이 정의를 따른다.

## 스택 구성

- **프론트엔드**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **배포**: Vercel (프리뷰 배포 포함)
- **인증**: Firebase Authentication — Google 공급자만 사용
- **DB**: Firestore (실시간 리스너 적극 사용)
- **파일 저장**: Firebase Storage (사진 원본 + 리사이즈본)
- **서버리스 함수**: Firebase Cloud Functions (EXIF 파싱, AI 편집, 공개 API용 정적 파일 생성 등 무거운 작업)
  또는 Vercel의 Route Handler(`app/api/**`)로 대체 가능 — 팀 판단에 따라 선택하되, Firestore 트리거가
  필요한 작업(사진 업로드 후 자동 처리 등)은 Cloud Functions 권장
- **AI**: Anthropic API(Claude) — 서버사이드에서만 호출, API 키는 서버 환경변수로만 보관

## 다크모드 / 라이트모드

- Tailwind의 `class` 전략 다크모드 사용 (`darkMode: 'class'`)
- 최초 진입 시 `prefers-color-scheme`로 시스템 설정 감지
- 사용자가 토글 스위치를 누르면 `localStorage`에 즉시 저장하고, 로그인 상태라면 `users/{uid}.themePreference`
  필드에도 저장하여 기기 간 동기화
- 토글 스위치는 회원 화면의 "내 정보" 탭, 비회원 홈페이지 상단 헤더 두 곳에 배치

## Firestore 컬렉션 설계

### `communities/{communityId}`
공동체(부녀회, 청년회, 노인회, 동호회 등) 단위 문서.

```
{
  communityId: string,
  communityType: "부녀회" | "청년회" | "노인회" | "동호회" | string, // 확장 가능하도록 자유 문자열 허용
  name: string,               // 예: "애월읍 봉성리 부녀회"
  regionName: string,         // 예: "애월읍 봉성리"
  location: { lat: number, lng: number },
  inviteCode: string,         // 신규 가입 시 사용
  isPublic: boolean,          // 비회원 열람 가능 여부
  emojiPackIds: string[],     // 등록된 커스텀 이모티콘 팩 참조
  createdAt: Timestamp
}
```

### `users/{uid}`
```
{
  uid: string,
  displayName: string,
  photoURL: string,
  communityIds: string[],     // 소속된 공동체 (복수 가능)
  themePreference: "light" | "dark" | "system",
  createdAt: Timestamp
}
```

### `communities/{communityId}/messages/{messageId}`
부녀회 공용 오픈채팅방 메시지. 채팅 UI와 홈페이지 Live Chat이 동일 컬렉션을 구독한다.

```
{
  messageId: string,
  authorUid: string,
  authorName: string,
  authorPhotoURL: string,
  type: "text" | "photo" | "emoji" | "game_result" | "system",
  text: string | null,
  photoId: string | null,     // type="photo"일 때 photos 컬렉션 참조
  gameResultPayload: object | null, // type="game_result"일 때 게임 결과 요약
  createdAt: Timestamp
}
```

### `communities/{communityId}/photos/{photoId}`
```
{
  photoId: string,
  uploaderUid: string,
  uploaderName: string,
  storageUrl: string,         // Firebase Storage 원본
  thumbnailUrl: string,
  exif: {
    takenAt: Timestamp | null,
    gps: { lat: number, lng: number } | null,
    deviceModel: string | null,
    lens: string | null
  },
  aiTags: string[],           // AI 검색용 자동 태그 (08 문서 참고)
  aiCaption: string | null,
  createdAt: Timestamp
}
```

### `communities/{communityId}/events/{eventId}`
행사/일정. 06(게임), 08(AI) 문서에서 참조.
```
{
  eventId: string,
  title: string,
  description: string,
  startAt: Timestamp,
  endAt: Timestamp | null,
  createdBy: string,
  createdAt: Timestamp
}
```

### `communities/{communityId}/reports/{reportId}`
제보하기 (07 문서 참고)
```
{
  reportId: string,
  reporterUid: string,
  photoStorageUrl: string,
  exif: object,
  description: string,
  status: "접수" | "안전신문고 전달완료" | "처리중" | "종료",
  createdAt: Timestamp
}
```

### `communities/{communityId}/vacantHouses/{listingId}`
빈집소개 (07 문서 참고)
```
{
  listingId: string,
  posterUid: string,
  photos: string[],
  monthlyRent: number | null,
  deposit: number | null,
  description: string,
  location: { lat: number, lng: number } | null,
  status: "게시중" | "거래완료" | "게시중지",
  createdAt: Timestamp
}
```

### `communities/{communityId}/dailyDigests/{yyyy-mm-dd}`
AI 일일신문 (08 문서 참고)
```
{
  date: string, // "2026-07-20"
  summaryText: string,
  topPhotos: string[],       // photoId 배열
  eventHighlights: string[],
  topKeywords: string[],
  tomorrowSchedulePreview: string | null,
  generatedAt: Timestamp
}
```

## 라우팅 구조 (Next.js App Router 기준)

```
/                          → 비회원 진입: 대한민국 마을 지도
/village/[communityId]     → 마을 홈페이지 (비회원/회원 공통 열람)
/app/chat                  → 회원 전용: 채팅 리스트 (로그인 필요)
/app/chat/[communityId]    → 회원 전용: 개별 오픈채팅방
/app/home                  → 회원 전용: 부녀회 홈(모바일 내 화면)
/app/photos                → 회원 전용: 사진 탭
/app/games                 → 회원 전용: 게임 탭
/app/me                    → 회원 전용: 내 정보 (다크모드 토글 포함)
/login                     → Google 로그인 진입
/onboarding                → 최초 가입: 공동체 선택/초대코드 입력
/api/**                    → 서버 라우트 (AI 호출, EXIF 파싱, 공개 API 등)
```

## 인증/보안 원칙

- 모든 쓰기(write)는 Firestore Security Rules로 "해당 커뮤니티 멤버만 가능"하도록 제한
- 읽기(read)는 `communities/{id}.isPublic == true`인 경우 비회원도 허용 (지도, 홈페이지, 공개 API용)
- 비공개 커뮤니티는 초대코드로 가입한 멤버만 읽기/쓰기 가능
- Anthropic API 키, Firebase Admin 서비스 계정 키 등은 절대 클라이언트에 노출하지 않는다 (서버 환경변수 전용)
