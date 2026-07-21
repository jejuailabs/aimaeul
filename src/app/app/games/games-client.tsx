'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Play,
  Loader2,
  Send,
  RefreshCw,
  ChevronDown,
  Scissors,
  Hand as HandIcon,
  Square,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  MessageCircle,
} from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  GAMES,
  FORTUNE_POOL,
  circled,
  shuffle,
  pickRandom,
  pickN,
  splitTeams,
  randInt,
  runLadder,
  rpsAI,
  rpsJudge,
  type GameDef,
  type GameId,
  type Participant,
  type LadderRung,
  type RpsHand,
  type GameResultPayload,
} from './games-logic'
import { ParticipantPicker } from './participant-picker'

type CommunityWithMembers = {
  id: string
  name: string
  communityType: string
  regionName: string
  members: Participant[]
}

export type { CommunityWithMembers }

type Props = {
  communities: CommunityWithMembers[]
  defaultCommunityId: string
}

type GamePanelProps = {
  game: GameDef
  members: Participant[]
  posting: boolean
  onPost: (payload: GameResultPayload) => Promise<void>
}

// ============================================================================
// 메인 GamesClient
// ============================================================================
export function GamesClient({
  communities,
  defaultCommunityId,
  embedded = false,
}: Props & {
  /** 모달 안에서 쓸 때는 AppShell(헤더/하단탭) 없이 내용만 렌더링한다. */
  embedded?: boolean
}) {
  const [communityId, setCommunityId] = useState(defaultCommunityId)
  const [openGame, setOpenGame] = useState<GameId | null>(null)
  const [posting, setPosting] = useState(false)

  const activeCommunity =
    communities.find((c) => c.id === communityId) ?? communities[0]

  const postResult = useCallback(
    async (payload: GameResultPayload): Promise<void> => {
      setPosting(true)
      try {
        const res = await fetch('/api/games/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId,
            gameType: payload.gameType,
            title: payload.title,
            resultSummary: payload.resultSummary,
            winner: payload.winner ?? null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error || '전송에 실패했어요.')
          return
        }
        toast.success('채팅방에 게임 결과를 올렸어요! 🎉', {
          action: {
            label: '채팅 보기',
            onClick: () => {
              window.location.href = `/app/chat/${communityId}`
            },
          },
        })
        setOpenGame(null)
      } catch {
        toast.error('전송에 실패했어요.')
      } finally {
        setPosting(false)
      }
    },
    [communityId]
  )

  const body = (
    <>
      {/* Community selector (only if multiple) */}
      {communities.length > 1 && (
        <div className="border-b border-border/60 bg-card/40 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            <span>결과를 올릴 마을 채팅방</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {communities.map((c) => (
              <button
                key={c.id}
                onClick={() => setCommunityId(c.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  c.id === communityId
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground hover:bg-accent'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Games grid */}
      <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5">
        {GAMES.map((g) => {
          const Icon = g.icon
          return (
            <button
              key={g.id}
              onClick={() => setOpenGame(g.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-center text-[11px] font-medium leading-tight">
                {g.name}
              </span>
            </button>
          )
        })}
      </div>

      <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground">
        결과를 실행하면 선택한 마을 채팅방에 자동으로 올라가요.
      </p>

      {/* Game dialog */}
      <Dialog
        open={openGame !== null}
        onOpenChange={(o) => !o && setOpenGame(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          {openGame &&
            (() => {
              const game = GAMES.find((g) => g.id === openGame)!
              return (
                <GamePanelHost
                  key={openGame}
                  game={game}
                  members={activeCommunity.members}
                  posting={posting}
                  onPost={postResult}
                />
              )
            })()}
        </DialogContent>
      </Dialog>
    </>
  )

  if (embedded) return body
  return <AppShell title="게임">{body}</AppShell>
}

// ============================================================================
// GamePanelHost — game.id 별 패널 분기
// ============================================================================
function GamePanelHost(props: GamePanelProps) {
  switch (props.game.id) {
    case 'ladder':
      return <LadderPanel {...props} />
    case 'roulette':
      return <RoulettePanel {...props} />
    case 'jeby':
      return <JebyPanel {...props} />
    case 'randomNumber':
      return <RandomNumberPanel {...props} />
    case 'order':
      return <OrderPanel {...props} />
    case 'team':
      return <TeamPanel {...props} />
    case 'duty':
      return <DutyPanel {...props} />
    case 'randomName':
      return <RandomNamePanel {...props} />
    case 'randomNumGen':
      return <RandomNumGenPanel {...props} />
    case 'ox':
      return <OxPanel {...props} />
    case 'coin':
      return <CoinPanel {...props} />
    case 'dice':
      return <DicePanel {...props} />
    case 'rps':
      return <RpsPanel {...props} />
    case 'luckyBox':
      return <LuckyBoxPanel {...props} />
    case 'fortune':
      return <FortunePanel {...props} />
    default:
      return null
  }
}

// ============================================================================
// Shared UI helpers
// ============================================================================
function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
      {children}
    </div>
  )
}

function ResultFooter({
  gameType,
  title,
  setTitle,
  resultSummary,
  winner,
  onPost,
  posting,
  disabled,
}: {
  gameType: string
  title: string
  setTitle: (v: string) => void
  resultSummary: string
  winner: string | null
  onPost: (p: GameResultPayload) => Promise<void>
  posting: boolean
  disabled: boolean
}) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="space-y-1.5">
        <Label htmlFor="title-input">결과 제목</Label>
        <Input
          id="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 감자캐기 순번"
        />
      </div>
      <Button
        onClick={() =>
          onPost({
            gameType,
            title: title.trim() || '게임 결과',
            resultSummary,
            winner,
          })
        }
        disabled={disabled || posting}
        className="w-full"
        size="lg"
      >
        {posting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        게임 결과 채팅방에 올리기
      </Button>
    </div>
  )
}

// ============================================================================
// 1. 사다리타기
// ============================================================================
function LadderPanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, 4).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState(game.defaultTitle)
  const [runResult, setRunResult] = useState<{
    result: Participant[]
    rungs: LadderRung[]
  } | null>(null)
  const [running, setRunning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function run() {
    if (chosen.length < 2) {
      toast.error('참가자를 2명 이상 선택해주세요.')
      return
    }
    setRunning(true)
    setRunResult(null)
    await new Promise((r) => setTimeout(r, 1400))
    const res = runLadder(chosen)
    setRunResult(res)
    setRunning(false)
  }

  const resultSummary = runResult
    ? runResult.result.map((p, i) => `${circled(i + 1)} ${p.name}`).join('  ')
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
        />

        <Button onClick={run} disabled={running || chosen.length < 2} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? '사다리 타는 중...' : '사다리 타기'}
        </Button>

        {(running || runResult) && (
          <LadderVisual
            participants={chosen}
            rungs={runResult?.rungs ?? []}
            result={runResult?.result}
            spinning={running}
          />
        )}

        {runResult && (
          <ResultBox>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              결과 순서
            </p>
            <p className="text-sm font-medium leading-relaxed">{resultSummary}</p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!runResult}
        />
      </div>
    </>
  )
}

function LadderVisual({
  participants,
  rungs,
  result,
  spinning,
}: {
  participants: Participant[]
  rungs: LadderRung[]
  result?: Participant[]
  spinning?: boolean
}) {
  const n = Math.max(2, participants.length)
  const colW = 56
  const height = 170
  const width = n * colW
  const top = 28
  const bottom = 130

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-md"
        style={{ minWidth: 200 }}
      >
        {/* participant names at top */}
        {participants.map((p, i) => (
          <text
            key={`top-${i}`}
            x={i * colW + colW / 2}
            y={16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--foreground)"
          >
            {p.name.slice(0, 4)}
          </text>
        ))}
        {/* vertical lines */}
        {Array.from({ length: n }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * colW + colW / 2}
            y1={top}
            x2={i * colW + colW / 2}
            y2={bottom}
            stroke="var(--border)"
            strokeWidth={2}
          />
        ))}
        {/* spinning placeholder rungs */}
        {spinning &&
          Array.from({ length: 5 }).map((_, i) => {
            const col = i % Math.max(1, n - 1)
            const y = top + 20 + i * 18
            return (
              <motion.line
                key={`spin-${i}`}
                x1={col * colW + colW / 2}
                y1={y}
                x2={(col + 1) * colW + colW / 2}
                y2={y}
                stroke="var(--primary)"
                strokeWidth={2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: i * 0.15, duration: 0.3 }}
              />
            )
          })}
        {/* actual rungs */}
        {!spinning &&
          rungs.map((r, i) => (
            <motion.line
              key={`run-${i}`}
              x1={r.col * colW + colW / 2}
              y1={top + r.heightRatio * (bottom - top)}
              x2={(r.col + 1) * colW + colW / 2}
              y2={top + r.heightRatio * (bottom - top)}
              stroke="var(--primary)"
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            />
          ))}
        {/* destination labels */}
        {result &&
          result.map((p, i) => (
            <g key={`bot-${i}`}>
              <circle
                cx={i * colW + colW / 2}
                cy={bottom + 14}
                r={9}
                fill="var(--primary)"
              />
              <text
                x={i * colW + colW / 2}
                y={bottom + 18}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="var(--primary-foreground)"
              >
                {i + 1}
              </text>
              <text
                x={i * colW + colW / 2}
                y={bottom + 32}
                textAnchor="middle"
                fontSize={9}
                fill="var(--foreground)"
              >
                {p.name.slice(0, 4)}
              </text>
            </g>
          ))}
      </svg>
    </div>
  )
}

// ============================================================================
// 2. 룰렛 돌리기
// ============================================================================
const ROULETTE_COLORS = [
  '#FEE500',
  '#FF6B6B',
  '#4ECDC4',
  '#FFA07A',
  '#C9B1FF',
  '#FFD93D',
  '#6BCB77',
  '#FF9F1C',
  '#7FD8BE',
  '#E8A0BF',
]

function buildConicGradient(items: string[]): string {
  if (items.length === 0) return ''
  const seg = 360 / items.length
  const stops: string[] = []
  for (let i = 0; i < items.length; i++) {
    const color = ROULETTE_COLORS[i % ROULETTE_COLORS.length]
    stops.push(`${color} ${i * seg}deg ${(i + 1) * seg}deg`)
  }
  return `conic-gradient(${stops.join(', ')})`
}

function RoulettePanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, Math.min(6, members.length)).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState(game.defaultTitle)
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<Participant | null>(null)
  const [spinning, setSpinning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function spin() {
    if (chosen.length < 2) {
      toast.error('항목을 2개 이상 선택해주세요.')
      return
    }
    setSpinning(true)
    setWinner(null)
    const items = chosen
    const segAngle = 360 / items.length
    const winnerIdx = Math.floor(Math.random() * items.length)
    // 5바퀴 + 우승자 세그먼트 중심이 상단(0도)에 오도록 역방향 회전
    const base = rotation - (rotation % 360)
    const target =
      base + 360 * 5 + (360 - (winnerIdx + 0.5) * segAngle)
    setRotation(target)
    await new Promise((r) => setTimeout(r, 1800))
    setWinner(items[winnerIdx])
    setSpinning(false)
  }

  const items = chosen
  const resultSummary = winner
    ? `당첨: ${winner.name} 🎉`
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
          minHint={2}
        />

        {/* wheel */}
        <div className="flex justify-center">
          <div className="relative h-44 w-44">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
              <ChevronDown className="h-7 w-7 text-foreground" fill="currentColor" />
            </div>
            <motion.div
              className="h-44 w-44 rounded-full border-4 border-foreground/80 shadow-lg"
              style={{
                background:
                  items.length > 0
                    ? buildConicGradient(items.map((p) => p.name))
                    : 'var(--muted)',
              }}
              animate={{ rotate: rotation }}
              transition={{ duration: 1.8, ease: [0.17, 0.67, 0.32, 1] }}
            />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        </div>

        <Button
          onClick={spin}
          disabled={spinning || chosen.length < 2}
          className="w-full"
        >
          {spinning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {spinning ? '돌리는 중...' : '룰렛 돌리기'}
        </Button>

        {winner && (
          <ResultBox>
            <p className="text-center text-sm">
              <span className="text-muted-foreground">당첨</span>{' '}
              <span className="text-base font-bold">{winner.name}</span> 🎉
            </p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={winner?.name ?? null}
          onPost={onPost}
          posting={posting}
          disabled={!winner}
        />
      </div>
    </>
  )
}

// ============================================================================
// 3. 제비뽑기 (N명 중 당첨자)
// ============================================================================
function JebyPanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, 5).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState(game.defaultTitle)
  const [winnerCount, setWinnerCount] = useState('1')
  const [winners, setWinners] = useState<Participant[] | null>(null)
  const [running, setRunning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function run() {
    if (chosen.length < 1) {
      toast.error('참가자를 선택해주세요.')
      return
    }
    setRunning(true)
    setWinners(null)
    await new Promise((r) => setTimeout(r, 800))
    const n = Math.min(parseInt(winnerCount, 10) || 1, chosen.length)
    setWinners(pickN(chosen, n))
    setRunning(false)
  }

  const resultSummary = winners
    ? winners.map((w, i) => `${circled(i + 1)} ${w.name}`).join('  ')
    : ''
  const winnerName =
    winners && winners.length === 1 ? winners[0].name : null

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
          minHint={1}
        />

        <div className="space-y-1.5">
          <Label>당첨자 수</Label>
          <Select value={winnerCount} onValueChange={setWinnerCount}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.max(5, chosen.length) }).map((_, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {i + 1}명
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={run}
          disabled={running || chosen.length < 1}
          className="w-full"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          제비뽑기
        </Button>

        {winners && (
          <ResultBox>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              당첨자 ({winners.length}명)
            </p>
            <p className="text-sm font-medium leading-relaxed">{resultSummary}</p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={winnerName}
          onPost={onPost}
          posting={posting}
          disabled={!winners}
        />
      </div>
    </>
  )
}

// ============================================================================
// 4. 랜덤 번호 추첨 (범위)
// ============================================================================
function RandomNumberPanel({ game, onPost, posting }: GamePanelProps) {
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('100')
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<number | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    const lo = parseInt(min, 10)
    const hi = parseInt(max, 10)
    if (Number.isNaN(lo) || Number.isNaN(hi)) {
      toast.error('숫자를 입력해주세요.')
      return
    }
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 800))
    setResult(randInt(lo, hi))
    setRunning(false)
  }

  const resultSummary = result !== null ? `뽑힌 번호: ${result}` : ''
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>최소값</Label>
            <Input
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>최대값</Label>
            <Input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          추첨하기
        </Button>

        {result !== null && (
          <ResultBox>
            <p className="text-center text-xs text-muted-foreground">뽑힌 번호</p>
            <motion.p
              className="text-center text-4xl font-black text-foreground"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {result}
            </motion.p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={result === null}
        />
      </div>
    </>
  )
}

// ============================================================================
// 5. 순번 정하기
// ============================================================================
function OrderPanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, 4).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState('감자캐기 순번')
  const [result, setResult] = useState<Participant[] | null>(null)
  const [running, setRunning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function run() {
    if (chosen.length < 2) {
      toast.error('참가자를 2명 이상 선택해주세요.')
      return
    }
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 700))
    setResult(shuffle(chosen))
    setRunning(false)
  }

  const resultSummary = result
    ? result.map((p, i) => `${circled(i + 1)} ${p.name}`).join('  ')
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
        />

        <Button onClick={run} disabled={running || chosen.length < 2} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          순번 정하기
        </Button>

        {result && (
          <ResultBox>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              순번 결과
            </p>
            <p className="text-sm font-medium leading-relaxed">{resultSummary}</p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 6. 팀 나누기
// ============================================================================
function TeamPanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, 6).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState(game.defaultTitle)
  const [teamCount, setTeamCount] = useState('2')
  const [teams, setTeams] = useState<Participant[][] | null>(null)
  const [running, setRunning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function run() {
    if (chosen.length < 2) {
      toast.error('참가자를 2명 이상 선택해주세요.')
      return
    }
    setRunning(true)
    setTeams(null)
    await new Promise((r) => setTimeout(r, 700))
    const tc = Math.min(parseInt(teamCount, 10) || 2, chosen.length)
    setTeams(splitTeams(chosen, tc))
    setRunning(false)
  }

  const resultSummary = teams
    ? teams
        .map(
          (t, i) =>
            `${i + 1}팀: ${t.map((p) => p.name).join(', ')}`
        )
        .join(' / ')
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
        />

        <div className="space-y-1.5">
          <Label>팀 수</Label>
          <Select value={teamCount} onValueChange={setTeamCount}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}팀
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={run} disabled={running || chosen.length < 2} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          팀 나누기
        </Button>

        {teams && (
          <ResultBox>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              팀 배정 결과
            </p>
            <div className="space-y-1.5">
              {teams.map((t, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold">{i + 1}팀</span>{' '}
                  <span className="text-muted-foreground">
                    {t.map((p) => p.name).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!teams}
        />
      </div>
    </>
  )
}

// ============================================================================
// 7. 당번 뽑기
// ============================================================================
function DutyPanel({ game, members, onPost, posting }: GamePanelProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    members.slice(0, 5).map((m) => m.id)
  )
  const [extras, setExtras] = useState<Participant[]>([])
  const [title, setTitle] = useState('오늘 청소 당번')
  const [winner, setWinner] = useState<Participant | null>(null)
  const [running, setRunning] = useState(false)

  const all = useMemo(() => [...members, ...extras], [members, extras])
  const chosen = useMemo(
    () => all.filter((p) => selected.includes(p.id)),
    [all, selected]
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])
  const addExtra = useCallback((name: string) => {
    const id = `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setExtras((prev) => [...prev, { id, name }])
  }, [])
  const removeExtra = useCallback((id: string) => {
    setExtras((prev) => prev.filter((p) => p.id !== id))
    setSelected((prev) => prev.filter((x) => x !== id))
  }, [])

  async function run() {
    if (chosen.length < 1) {
      toast.error('참가자를 선택해주세요.')
      return
    }
    setRunning(true)
    setWinner(null)
    await new Promise((r) => setTimeout(r, 900))
    setWinner(pickRandom(chosen))
    setRunning(false)
  }

  const resultSummary = winner
    ? `당번: ${winner.name} 님 🎉`
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <ParticipantPicker
          members={members}
          extras={extras}
          selected={selected}
          onToggle={toggle}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
          minHint={1}
        />

        <Button onClick={run} disabled={running || chosen.length < 1} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          당번 뽑기
        </Button>

        {winner && (
          <ResultBox>
            <motion.p
              className="text-center text-sm"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <span className="text-muted-foreground">오늘의 당번은</span>
              <br />
              <span className="text-xl font-black">{winner.name}</span> 님 🎉
            </motion.p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={winner?.name ?? null}
          onPost={onPost}
          posting={posting}
          disabled={!winner}
        />
      </div>
    </>
  )
}

// ============================================================================
// 8. 랜덤 이름 뽑기 (텍스트 목록에서)
// ============================================================================
function RandomNamePanel({ game, onPost, posting }: GamePanelProps) {
  const [text, setText] = useState('김영희\n이순자\n박미숙\n강영자')
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    const names = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length < 1) {
      toast.error('이름을 1개 이상 입력해주세요.')
      return
    }
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 700))
    setResult(pickRandom(names))
    setRunning(false)
  }

  const resultSummary = result ? `뽑힌 이름: ${result}` : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>이름 목록 (한 줄에 한 명 또는 쉼표)</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="김영희&#10;이순자&#10;박미숙"
          />
        </div>

        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          뽑기
        </Button>

        {result && (
          <ResultBox>
            <motion.p
              className="text-center text-xl font-black"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {result}
            </motion.p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={result}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 9. 랜덤 숫자 생성 (범위 내 N개)
// ============================================================================
function RandomNumGenPanel({ game, onPost, posting }: GamePanelProps) {
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('45')
  const [count, setCount] = useState('6')
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<number[] | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    const lo = parseInt(min, 10)
    const hi = parseInt(max, 10)
    const n = Math.min(parseInt(count, 10) || 1, 20)
    if (Number.isNaN(lo) || Number.isNaN(hi)) {
      toast.error('숫자 범위를 확인해주세요.')
      return
    }
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 800))
    const pool: number[] = []
    for (let v = lo; v <= hi; v++) pool.push(v)
    // 중복 허용 안 함(범위 충분할 때). 범위가 부족하면 중복 허용.
    const useUnique = pool.length >= n
    const out: number[] = []
    if (useUnique) {
      out.push(...pickN(pool, n))
    } else {
      for (let i = 0; i < n; i++) out.push(randInt(lo, hi))
    }
    setResult(out)
    setRunning(false)
  }

  const resultSummary = result ? result.join(', ') : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>최소</Label>
            <Input
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>최대</Label>
            <Input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>개수</Label>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          생성하기
        </Button>

        {result && (
          <ResultBox>
            <div className="flex flex-wrap justify-center gap-1.5">
              {result.map((n, i) => (
                <motion.span
                  key={`${i}-${n}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                >
                  {n}
                </motion.span>
              ))}
            </div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 10. OX 선택
// ============================================================================
function OxPanel({ game, onPost, posting }: GamePanelProps) {
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<'O' | 'X' | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 700))
    setResult(Math.random() < 0.5 ? 'O' : 'X')
    setRunning(false)
  }

  const resultSummary = result ? `결과: ${result}` : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Button onClick={run} disabled={running} className="w-full" size="lg">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          뽑기
        </Button>

        {result && (
          <ResultBox>
            <motion.div
              className="text-center text-7xl font-black"
              initial={{ rotateY: 0, opacity: 0 }}
              animate={{ rotateY: 360, opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                color: result === 'O' ? 'var(--primary)' : 'var(--destructive)',
              }}
            >
              {result}
            </motion.div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 11. 동전 던지기
// ============================================================================
function CoinPanel({ game, onPost, posting }: GamePanelProps) {
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<'앞' | '뒤' | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 800))
    setResult(Math.random() < 0.5 ? '앞' : '뒤')
    setRunning(false)
  }

  const resultSummary = result ? `결과: ${result}면` : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Button onClick={run} disabled={running} className="w-full" size="lg">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          동전 던지기
        </Button>

        {result && (
          <ResultBox>
            <motion.div
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-black text-primary-foreground shadow-lg"
              initial={{ rotateY: 0, scale: 0.6 }}
              animate={{ rotateY: 720, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              {result}
            </motion.div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 12. 주사위 굴리기
// ============================================================================
const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]

function DicePanel({ game, onPost, posting }: GamePanelProps) {
  const [count, setCount] = useState('1')
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<number[] | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 6)
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 800))
    const out: number[] = []
    for (let i = 0; i < n; i++) out.push(randInt(1, 6))
    setResult(out)
    setRunning(false)
  }

  const resultSummary = result
    ? result.length === 1
      ? `결과: ${result[0]}`
      : `결과: ${result.join(', ')} (합 ${result.reduce((a, b) => a + b, 0)})`
    : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>주사위 개수</Label>
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}개
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          굴리기
        </Button>

        {result && (
          <ResultBox>
            <div className="flex flex-wrap justify-center gap-2">
              {result.map((v, i) => {
                const Icon = DICE_ICONS[v - 1]
                return (
                  <motion.div
                    key={`${i}-${v}`}
                    initial={{ rotate: 0, opacity: 0 }}
                    animate={{ rotate: 360, opacity: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-foreground/20 bg-card text-foreground"
                  >
                    <Icon className="h-9 w-9" />
                  </motion.div>
                )
              })}
            </div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 13. 가위바위보
// ============================================================================
function RpsPanel({ game, onPost, posting }: GamePanelProps) {
  const [title, setTitle] = useState(game.defaultTitle)
  const [player, setPlayer] = useState<RpsHand | null>(null)
  const [ai, setAi] = useState<RpsHand | null>(null)
  const [outcome, setOutcome] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [running, setRunning] = useState(false)

  async function play(hand: RpsHand) {
    setRunning(true)
    setPlayer(null)
    setAi(null)
    setOutcome(null)
    await new Promise((r) => setTimeout(r, 600))
    const aiHand = rpsAI()
    const o = rpsJudge(hand, aiHand)
    setPlayer(hand)
    setAi(aiHand)
    setOutcome(o)
    setRunning(false)
  }

  const outcomeText =
    outcome === 'win' ? '승리! 🎉' : outcome === 'lose' ? '패배 😅' : '무승부 🤝'
  const resultSummary =
    player && ai && outcome
      ? `나: ${player} / AI: ${ai} → ${outcomeText}`
      : ''

  const HAND_OPTIONS: { hand: RpsHand; icon: typeof Scissors; label: string }[] = [
    { hand: '가위', icon: Scissors, label: '가위' },
    { hand: '바위', icon: HandIcon, label: '바위' },
    { hand: '보', icon: Square, label: '보' },
  ]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {HAND_OPTIONS.map(({ hand, icon: Icon, label }) => (
            <Button
              key={hand}
              variant="outline"
              onClick={() => play(hand)}
              disabled={running}
              className="flex flex-col items-center gap-1 py-4"
            >
              <Icon className="h-7 w-7" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>

        {(player || running) && (
          <ResultBox>
            <div className="flex items-center justify-around text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">나</p>
                <p className="text-lg font-bold">{player ?? '...'}</p>
              </div>
              <div className="text-xl text-muted-foreground">vs</div>
              <div>
                <p className="text-xs text-muted-foreground">AI</p>
                <p className="text-lg font-bold">{ai ?? '...'}</p>
              </div>
            </div>
            {outcome && (
              <motion.p
                className="mt-2 text-center text-base font-black"
                style={{
                  color:
                    outcome === 'win'
                      ? 'var(--primary)'
                      : outcome === 'lose'
                        ? 'var(--destructive)'
                        : 'var(--muted-foreground)',
                }}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {outcomeText}
              </motion.p>
            )}
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!outcome}
        />
      </div>
    </>
  )
}

// ============================================================================
// 14. 행운의 박스
// ============================================================================
function LuckyBoxPanel({ game, onPost, posting }: GamePanelProps) {
  const [text, setText] = useState('카페 쿠폰\n편의점 간식\n손편지\n없음')
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    const items = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (items.length < 1) {
      toast.error('항목을 1개 이상 입력해주세요.')
      return
    }
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 900))
    setResult(pickRandom(items))
    setRunning(false)
  }

  const resultSummary = result ? `행운의 박스: ${result} 🎁` : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>박스 항목 (한 줄에 하나)</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="카페 쿠폰&#10;간식&#10;편의점 쿠폰"
          />
        </div>

        <Button onClick={run} disabled={running} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          박스 열기 🎁
        </Button>

        {result && (
          <ResultBox>
            <motion.div
              className="text-center"
              initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <p className="text-xs text-muted-foreground">행운의 박스 결과</p>
              <p className="mt-1 text-xl font-black">{result}</p>
            </motion.div>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={result}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}

// ============================================================================
// 15. 오늘의 운세
// ============================================================================
function FortunePanel({ game, onPost, posting }: GamePanelProps) {
  const [title, setTitle] = useState(game.defaultTitle)
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 900))
    setResult(pickRandom(FORTUNE_POOL))
    setRunning(false)
  }

  const resultSummary = result ?? ''

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <game.icon className="h-5 w-5 text-primary" /> {game.name}
        </DialogTitle>
        <DialogDescription>{game.desc}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Button onClick={run} disabled={running} className="w-full" size="lg">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          오늘의 운세 뽑기
        </Button>

        {result && (
          <ResultBox>
            <motion.p
              className="text-center text-base font-medium leading-relaxed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {result}
            </motion.p>
          </ResultBox>
        )}

        <ResultFooter
          gameType={game.gameType}
          title={title}
          setTitle={setTitle}
          resultSummary={resultSummary}
          winner={null}
          onPost={onPost}
          posting={posting}
          disabled={!result}
        />
      </div>
    </>
  )
}
