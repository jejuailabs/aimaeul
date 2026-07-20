# Worklog — 마을 공동체 플랫폼 (KakaoTalk-style Village Community Platform)

This file is the shared worklog for all agents. Each agent MUST append a new section (starting with `---`) after finishing its Task ID. Do NOT overwrite previous content.

## Project Overview

카카오톡 UI/UX를 차용한 마을 공동체 디지털 플랫폼. 명세(`upload/*.md`)는 Firebase 기반이지만, 본 환경은 Next.js 16 + Prisma/SQLite + socket.io + z-ai-web-dev-sdk 이므로 다음과 같이 적응하여 구현한다:

- Firebase Auth → NextAuth (Credentials provider, email 기반 간편 로그인) + 비회원 게스트 모드
- Firestore → Prisma + SQLite (`prisma/schema.prisma`)
- Firestore onSnapshot 실시간 → socket.io mini-service (port 3003, path `/`)
- Firebase Storage → 로컬 파일 저장 (`public/uploads/...`, sharp 로 썸네일 생성)
- Cloud Functions → Next.js Route Handlers (`src/app/api/**`)
- Anthropic API → z-ai-web-dev-sdk (LLM/VLM/image-generation)

### Key Conventions
- Kakao 톤: 노란(primary) 포인트 컬러, 둥근 말풍선, 하단 5개 탭, 큰 버튼, 최소 입력
- 다크/라이트 모드: next-themes, localStorage + (로그인 시) User.themePreference
- 공동체 확장 가능: `communityType` 필드로 부녀회/청년회/노인회/동호회 등
- 모든 쓰기는 회원 전용; 비회원은 읽기 전용 (공개 커뮤니티만)
- 실시간: 채팅 ↔ 마을 홈페이지 Live Chat 동일 socket room

### Routes
- `/` — 비회원 진입: 대한민국 마을 지도 (공개 커뮤니티 마커)
- `/village/[communityId]` — 마을 홈페이지 (공개, SSR)
- `/login` — 로그인
- `/onboarding` — 공동체 선택/초대코드
- `/app/chat`, `/app/chat/[communityId]` — 회원 채팅
- `/app/home`, `/app/photos`, `/app/games`, `/app/me` — 회원 탭
- `/app/report`, `/app/vacant-houses` — 회원 도구
- `/api/v1/**` — 공개 REST API

---
Task ID: 1
Agent: orchestrator (main)
Task: Foundation setup — Prisma schema, theme, layout, auth, socket service, seed, shared libs

Work Log:
- (in progress)

---
Task ID: 6
Agent: general-purpose (games)
Task: Build /app/games with 15 community tool games + participant picker + chat result posting

Work Log:
- Read worklog.md, prisma/schema.prisma, src/lib/session.ts, src/lib/village.ts, src/components/app-shell.tsx, src/components/bottom-tab-bar.tsx, src/components/theme-toggle.tsx, src/app/api/games/result/route.ts, upload/06-games-tools.md to absorb conventions and existing API contract.
- Confirmed dev server already running on :3000, sonner Toaster wired in layout.tsx, shadcn Dialog/Select/Checkbox/Collapsible/ScrollArea/Textarea all present, framer-motion ^12 + vaul available.
- Created src/app/app/games/games-logic.ts:
  * Type definitions: Participant, GameId, GameDef, LadderRung, RpsHand, RpsOutcome, GameResultPayload
  * GAMES array — 15 game definitions (id, name, gameType, Lucide icon, desc, defaultTitle, needsParticipants)
  * Helpers: circled(①②③…⑳), shuffle (Fisher–Yates), pickRandom, pickN, splitTeams (round-robin), randInt, runLadder (rung-generation + swap simulation that returns ordered result + viz rungs), rpsAI, rpsJudge
  * FORTUNE_POOL — 12 Korean fortunes
- Created src/app/app/games/participant-picker.tsx ('use client'):
  * ScrollArea checkbox list prefilled from community members
  * "이름 직접 추가" Input + Plus button → adds Participant with stable id `extra-${ts}-${rand}`
  * X button to remove extra (also clears from selection)
  * Live count display, min-participant hint
- Created src/app/app/games/games-client.tsx ('use client', ~1960 lines):
  * GamesClient — AppShell(title="게임"), pill-style community selector (only if >1 community), responsive grid (3 cols mobile / 4 sm / 5 md) of game cards with Kakao-yellow icon circles
  * Single Dialog (max-w-md, max-h-[90vh], overflow-y-auto) hosts the active game's panel via GamePanelHost switch
  * postResult callback POSTs to /api/games/result, shows sonner toast.success with "채팅 보기" action navigating to /app/chat/[communityId], closes dialog on success
  * 15 panels, each managing own state (selected participants, extras, title, result, running):
    1. LadderPanel — ParticipantPicker + SVG ladder visual (verticals + animated rungs via framer-motion pathLength) + circled-number result list
    2. RoulettePanel — conic-gradient wheel (10 colors) + pointer + framer-motion rotate (5 full spins + segment-center math so winner lands at top)
    3. JebyPanel — N-winners selector (Select 1..N) + pickN + result list
    4. RandomNumberPanel — min/max Inputs + randInt + spring-animated big number
    5. OrderPanel — shuffle + "① 이름 ② 이름…" summary
    6. TeamPanel — team-count Select (2–6) + splitTeams + grouped result list
    7. DutyPanel — pickRandom + spring-animated winner card
    8. RandomNamePanel — Textarea (newline/comma separated) + pickRandom
    9. RandomNumGenPanel — min/max/count Inputs + unique-or-duplicate generation + bubble number chips
    10. OxPanel — random O/X with flip animation (primary/destructive color)
    11. CoinPanel — random 앞/뒤 with 720° rotateY coin animation
    12. DicePanel — 1–6 dice count + lucide Dice1..Dice6 face icons + sum in summary
    13. RpsPanel — 3 hand buttons (Scissors/Hand/Square icons) vs rpsAI + judge + outcome card (win primary / lose destructive / draw muted)
    14. LuckyBoxPanel — Textarea items + pickRandom + spring reveal
    15. FortunePanel — pickRandom from FORTUNE_POOL + fade-in reveal
  * Shared ResultFooter (title Input + "게임 결과 채팅방에 올리기" lg Button with Send icon, disabled until result exists) and ResultBox (yellow-tinted result container)
  * Winner field populated for: roulette, jeby (single winner only), duty, randomName, luckyBox — null for all others per spec
- Created src/app/app/games/page.tsx (server component):
  * getCurrentUser() → redirect to /login if not logged in
  * Empty-state (🎮 + "참여 중인 마을이 없어요" + Link to /onboarding) if user.communities.length === 0
  * Pre-fetches each community's members via db.communityMember.findMany({include:{user:{select:{id,name}}}}) so the ParticipantPicker is pre-populated
  * Passes communities (with nested members[]) + defaultCommunityId to GamesClient
- Did NOT modify Prisma schema, auth, socket service, broadcast lib, AppShell, BottomTabBar, ThemeToggle, or /api/games/result route — used existing /api/games/result endpoint as-is.
- Verification:
  * `bun run lint` → 0 errors, 0 warnings in games files (12 pre-existing warnings in other untouched files)
  * `npx tsc --noEmit --skipLibCheck` → 0 errors in games files (pre-existing errors only in prisma/seed.ts, skills/, photos/upload/route.ts)
  * `npx eslint src/app/app/games/` → EXIT=0
  * Authenticated smoke test: logged in as younghee@maul.kr (CSRF + credentials POST), GET /app/games returned 200, HTML contained all 15 game names (사다리타기, 룰렛 돌리기, 제비뽑기, 랜덤 번호 추첨, 순번 정하기, 팀 나누기, 당번 뽑기, 랜덤 이름 뽑기, 랜덤 숫자 생성, OX 선택, 동전 던지기, 주사위 굴리기, 가위바위보, 행운의 박스, 오늘의 운세)
  * dev.log: no games-related errors (only pre-existing EADDRINUSE from a second dev-server attempt)

Stage Summary:
- Files created:
  * src/app/app/games/page.tsx (server component, member pre-fetch, empty state)
  * src/app/app/games/games-client.tsx ('use client', GamesClient + GamePanelHost + 15 game panels + shared ResultFooter/ResultBox + LadderVisual + RouletteWheel conic-gradient builder)
  * src/app/app/games/games-logic.ts (types, GAMES[15], FORTUNE_POOL[12], pure helpers: shuffle/pickRandom/pickN/splitTeams/randInt/runLadder/rpsAI/rpsJudge/circled)
  * src/app/app/games/participant-picker.tsx (shared ParticipantPicker with checkbox list + name-direct-add)
- Key decisions:
  * Two-step UX per game: configure → run (with ~0.7–1.8s animation) → review result → post. Result title is editable in a shared ResultFooter.
  * Each game panel is an isolated component with own useState, mounted only when its dialog is open → state auto-resets when dialog closes (no manual reset needed).
  * Ladder visualization uses real rungs from runLadder() (col + heightRatio) so the SVG matches the actual swap simulation; framer-motion animates rung pathLength.
  * Roulette wheel uses conic-gradient + framer-motion rotate; target rotation = 5 full spins + (360 − (winnerIdx+0.5)·segmentAngle) so the winner segment's center lands at the top pointer.
  * Kakao-yellow circles for game icons (bg-primary text-primary-foreground), pill-style community selector, max-w-md dialog with overflow-y-auto for mobile-friendly near-fullscreen feel.
  * Reused /api/games/result route verbatim (no new API routes). sonner toast with "채팅 보기" action button navigates to the chat room.
  * Winner field is set only for winner-type games (당번, 룰렛, 제비뽑기-when-single, 이름뽑기, 행운의박스); null for ordering/team/number games per spec.
  * Lint passes clean (0/0 on games files); TypeScript check passes clean on games files.
