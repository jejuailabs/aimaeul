// 게임 탭 — 게임 정의 + 순수 로직 헬퍼
// 모든 추첨/셔플 로직은 클라이언트에서 실행되지만 결과 저장은 서버 API 가 담당.

import {
  GitBranch,
  CircleDot,
  Bird,
  Hash,
  ListOrdered,
  Users,
  Crown,
  Tag,
  Binary,
  ToggleLeft,
  Coins,
  Dices,
  Hand,
  Gift,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type Participant = { id: string; name: string }

export type GameId =
  | 'ladder'
  | 'roulette'
  | 'jeby'
  | 'randomNumber'
  | 'order'
  | 'team'
  | 'duty'
  | 'randomName'
  | 'randomNumGen'
  | 'ox'
  | 'coin'
  | 'dice'
  | 'rps'
  | 'luckyBox'
  | 'fortune'

export type GameDef = {
  id: GameId
  name: string
  gameType: string
  icon: LucideIcon
  desc: string
  defaultTitle: string
  needsParticipants: boolean
}

export const GAMES: GameDef[] = [
  {
    id: 'ladder',
    name: '사다리타기',
    gameType: '사다리타기',
    icon: GitBranch,
    desc: '참가자 순서를 사다리로 정해요',
    defaultTitle: '사다리타기 결과',
    needsParticipants: true,
  },
  {
    id: 'roulette',
    name: '룰렛 돌리기',
    gameType: '룰렛',
    icon: CircleDot,
    desc: '돌려서 한 명/항목 추첨',
    defaultTitle: '룰렛 추첨',
    needsParticipants: true,
  },
  {
    id: 'jeby',
    name: '제비뽑기',
    gameType: '제비뽑기',
    icon: Bird,
    desc: 'N명 중 당첨자 추첨',
    defaultTitle: '제비뽑기',
    needsParticipants: true,
  },
  {
    id: 'randomNumber',
    name: '랜덤 번호 추첨',
    gameType: '랜덤번호추첨',
    icon: Hash,
    desc: '번호 범위 내에서 추첨',
    defaultTitle: '번호 추첨',
    needsParticipants: false,
  },
  {
    id: 'order',
    name: '순번 정하기',
    gameType: '순번정하기',
    icon: ListOrdered,
    desc: '참가자 순서 랜덤 정렬',
    defaultTitle: '순번 정하기',
    needsParticipants: true,
  },
  {
    id: 'team',
    name: '팀 나누기',
    gameType: '팀나누기',
    icon: Users,
    desc: '참가자를 N개 팀으로 배분',
    defaultTitle: '팀 나누기',
    needsParticipants: true,
  },
  {
    id: 'duty',
    name: '당번 뽑기',
    gameType: '당번뽑기',
    icon: Crown,
    desc: '참가자 중 1명 당번 추첨',
    defaultTitle: '당번 뽑기',
    needsParticipants: true,
  },
  {
    id: 'randomName',
    name: '랜덤 이름 뽑기',
    gameType: '랜덤이름뽑기',
    icon: Tag,
    desc: '명단에서 임의 추출',
    defaultTitle: '랜덤 이름 뽑기',
    needsParticipants: false,
  },
  {
    id: 'randomNumGen',
    name: '랜덤 숫자 생성',
    gameType: '랜덤숫자생성',
    icon: Binary,
    desc: '범위 내 숫자 생성',
    defaultTitle: '랜덤 숫자',
    needsParticipants: false,
  },
  {
    id: 'ox',
    name: 'OX 선택',
    gameType: 'OX선택',
    icon: ToggleLeft,
    desc: 'O 또는 X 랜덤',
    defaultTitle: 'OX 선택',
    needsParticipants: false,
  },
  {
    id: 'coin',
    name: '동전 던지기',
    gameType: '동전던지기',
    icon: Coins,
    desc: '앞/뒤 랜덤',
    defaultTitle: '동전 던지기',
    needsParticipants: false,
  },
  {
    id: 'dice',
    name: '주사위 굴리기',
    gameType: '주사위굴리기',
    icon: Dices,
    desc: '1~6, 다중 주사위 지원',
    defaultTitle: '주사위 굴리기',
    needsParticipants: false,
  },
  {
    id: 'rps',
    name: '가위바위보',
    gameType: '가위바위보',
    icon: Hand,
    desc: 'AI와 1회 대결',
    defaultTitle: '가위바위보',
    needsParticipants: false,
  },
  {
    id: 'luckyBox',
    name: '행운의 박스',
    gameType: '행운의박스',
    icon: Gift,
    desc: '등록 항목 중 랜덤 오픈',
    defaultTitle: '행운의 박스',
    needsParticipants: false,
  },
  {
    id: 'fortune',
    name: '오늘의 운세',
    gameType: '오늘의운세',
    icon: Sparkles,
    desc: '오늘의 운세 랜덤',
    defaultTitle: '오늘의 운세',
    needsParticipants: false,
  },
]

// 한국형 가벼운 운세 풀 (12개)
export const FORTUNE_POOL: string[] = [
  '오늘은 좋은 일이 생길 거예요. 활짝 웃어보세요! 😊',
  '오늘은 집에서 푹 쉬는 게 좋겠어요. ☕',
  '오늘은 누군가에게 먼저 인사해보세요. 🙌',
  '오늘은 예상치 못한 손님이 찾아올 수 있어요. 🎁',
  '오늘은 작은 정리정돈이 큰 행복을 줄 거예요. ✨',
  '오늘은 오랜 친구에게 전화 한 통 어떨까요? 📞',
  '오늘은 맛있는 것을 먹으며 행복을 느껴보세요. 🍲',
  '오늘은 잠깐 산책하며 햇볕을 즐겨보세요. 🌿',
  '오늘은 주변 사람에게 칭찬 한마디 건네보세요. 💛',
  '오늘은 새로운 것을 시도해보기 좋은 날이에요. 🌱',
  '오늘은 작은 여유가 큰 보람이 될 거예요. ☕',
  '오늘은 웃으며 하루를 보내세요. 행운이 따라요. 🍀',
]

// 원형 숫자 (①②③...)
const CIRCLED = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
]

export function circled(n: number): string {
  return CIRCLED[n - 1] ?? `${n}.`
}

// Fisher–Yates 셔플 (새 배열 반환)
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

export function pickRandom<T>(arr: readonly T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length))
}

// N개 팀으로 균등 배분 (또는 남은 인원 순차 배정)
export function splitTeams<T>(arr: readonly T[], teamCount: number): T[][] {
  const teams: T[][] = Array.from({ length: teamCount }, () => [])
  shuffle(arr).forEach((item, i) => {
    teams[i % teamCount].push(item)
  })
  return teams.filter((t) => t.length > 0)
}

// min~max (양끝 포함) 정수 난수
export function randInt(min: number, max: number): number {
  if (max < min) [min, max] = [max, min]
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 사다리타기: 참가자 → 가로줄(rung) 시뮬레이션 → 도착 순서
// 각 rung은 인접한 두 열을 연결. 위에서 아래로 순회하며 참가자 위치를 스왑.
export type LadderRung = { col: number; heightRatio: number }

export function runLadder(
  participants: readonly Participant[]
): { result: Participant[]; rungs: LadderRung[] } {
  const n = participants.length
  if (n <= 1) {
    return { result: [...participants], rungs: [] }
  }
  // 가로줄 개수: 참가자 수 * 1.5 정도. 최소 3개.
  const targetRungCount = Math.max(3, Math.round(n * 1.5))
  const rungs: { col: number; height: number }[] = []
  let h = 0
  let attempts = 0
  while (rungs.length < targetRungCount && attempts < 50) {
    attempts++
    h += 1 + Math.floor(Math.random() * 2)
    const col = Math.floor(Math.random() * (n - 1))
    // 같 열 연속 가로줄 금지 (시각적/논리적 꼬임 방지)
    const last = rungs[rungs.length - 1]
    if (last && last.col === col && h - last.height <= 1) continue
    rungs.push({ col, height: h })
  }
  rungs.sort((a, b) => a.height - b.height)

  // 시각화용 0~1 비율
  const maxH = rungs.length > 0 ? rungs[rungs.length - 1].height : 1
  const vizRungs: LadderRung[] = rungs.map((r, i) => ({
    col: r.col,
    heightRatio: rungs.length > 1 ? i / (rungs.length - 1) : 0.5,
  }))
  void maxH

  // 시뮬레이션: 각 열의 현재 참가자를 추적
  const arr = [...participants]
  for (const r of rungs) {
    const tmp = arr[r.col]
    arr[r.col] = arr[r.col + 1]
    arr[r.col + 1] = tmp
  }
  // arr[i] = 최종적으로 열 i에 도착한 참가자 = i번째 순서
  return { result: arr, rungs: vizRungs }
}

// 가위바위보 로직
export type RpsHand = '가위' | '바위' | '보'
export type RpsOutcome = 'win' | 'lose' | 'draw'

export function rpsAI(): RpsHand {
  const hands: RpsHand[] = ['가위', '바위', '보']
  return hands[Math.floor(Math.random() * 3)]
}

export function rpsJudge(player: RpsHand, ai: RpsHand): RpsOutcome {
  if (player === ai) return 'draw'
  if (
    (player === '가위' && ai === '보') ||
    (player === '바위' && ai === '가위') ||
    (player === '보' && ai === '바위')
  )
    return 'win'
  return 'lose'
}

// POST /api/games/result 로 보낼 페이로드
export type GameResultPayload = {
  gameType: string
  title: string
  resultSummary: string
  winner: string | null
}
