# 04. 사진 업로드 · EXIF 자동 추출 · Live Feed

## 목표

회원은 사진만 업로드하면 된다. 별도 설명 입력 없이 EXIF 정보(촬영일시, GPS, 기종, 렌즈)를 자동 추출해
디자인적인 오버레이로 표시하고, 이 데이터는 마을 홈페이지의 Live Feed(05 문서)와 AI 검색(08 문서)의
원천 데이터가 된다.

## 업로드 플로우

1. 회원이 채팅방(03 문서) 또는 사진 탭(`/app/photos`)에서 사진 첨부 버튼 탭
2. 클라이언트에서 이미지 선택 (다중 선택 허용)
3. 원본 파일을 Firebase Storage `communities/{communityId}/photos/{photoId}/original.jpg` 경로에 업로드
4. 업로드 완료 트리거로 서버 처리(Cloud Function 또는 Route Handler)가 실행됨:
   - EXIF 파싱 (`exif-js`, `exifr` 등 라이브러리 사용 — 클라이언트에서 미리 파싱해 업로드 시 함께 전송하는 방식도 가능,
     신뢰성을 위해 서버에서 재검증 권장)
   - 썸네일 생성(리사이즈, 예: 800px 가로 기준) 후 `thumbnail.jpg`로 별도 저장
   - `communities/{id}/photos/{photoId}` Firestore 문서 생성 (01 문서 스키마 참고)
   - 동시에 `communities/{id}/messages`에 `type: "photo"` 메시지 자동 생성 → 채팅방과 홈페이지 Live Feed에 즉시 반영

## EXIF 오버레이 디자인

사진 위에 다음 정보를 아이콘+텍스트 조합으로 오버레이 (위치는 사진 하단, 반투명 그라데이션 배경 위):

- 📍 위치 — GPS 좌표를 역지오코딩(reverse geocoding, 예: Google Geocoding API)해 "애월읍 봉성리" 같은 행정동 단위로 표시
- 📷 기기 — EXIF의 `Model` 필드 (예: "Galaxy S25 Ultra")
- 🗓 날짜 — EXIF `DateTimeOriginal`
- 🕒 시간 — 위와 동일 필드에서 시:분 추출

EXIF 정보가 없는 사진(스크린샷, 다운로드 이미지 등)은 오버레이 항목을 조용히 생략하고 업로드 자체는 허용한다
(에러로 막지 않는다).

## 사진 탭 (`/app/photos`)

- 그리드 뷰(3열 정도)로 소속 공동체의 전체 사진을 최신순 표시
- 탭하면 상세 뷰로 확대, EXIF 오버레이 + 업로더 이름 + 좋아요/댓글은 이 범위에서는 생략(향후 확장 여지로 TODO만 표시)
- 무한 스크롤 페이지네이션 (`orderBy('createdAt', 'desc')` + `startAfter` 커서)

## 마을 홈페이지 Live Feed와의 연동

- 05 문서의 홈페이지 상단 세로형 사진 Feed는 이 `photos` 컬렉션을 그대로 구독한다 (별도 컬렉션 아님)
- 회원 앱의 "사진 탭"과 비회원용 "홈페이지 Feed"는 동일한 데이터 소스, 다른 레이아웃(그리드 vs 세로 슬라이드)

## 구현 시 주의사항

- 개인정보/보안: GPS 정보가 포함된 사진이 공개 홈페이지(비회원 열람)에 그대로 노출될 수 있음을 고려해,
  `communities/{id}.isPublic == false`인 비공개 커뮤니티는 사진도 비회원에게 노출되지 않도록 Security Rules 적용
- 업로드 용량 제한(예: 장당 20MB) 및 이미지 포맷(HEIC 포함) 처리 — HEIC는 서버에서 JPEG로 변환 후 저장 권장
- EXIF 파싱 실패는 전체 업로드 실패로 처리하지 않는다 (사진 저장은 항상 성공, 메타데이터만 부분적으로 비어있을 수 있음)
