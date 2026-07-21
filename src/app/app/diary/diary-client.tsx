'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Lock,
  Mic,
  MicOff,
  NotebookPen,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type DiaryEntry = {
  id: string
  date: string
  text: string
  mood: string | null
  photoPaths: string[]
  /** 음성 인식이 안 되는 기기에서 남긴 목소리 녹음. */
  audioPath?: string | null
  createdAt: string | null
}

/** 일기 첨부 파일은 본인 확인을 거치는 이 경로로만 불러온다. */
function diaryFileUrl(path: string) {
  return `/api/diary/photo?path=${encodeURIComponent(path)}`
}

const MOODS = ['😊', '😌', '🥰', '😅', '😢', '😠', '🤒', '💪'] as const

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatKoreanDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${y}년 ${m}월 ${d}일 ${days[dt.getDay()]}요일`
}

export function DiaryClient() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [writeOpen, setWriteOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/diary')
      const d = await res.json().catch(() => ({}))
      setEntries(d.entries || [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function remove(id: string) {
    const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('삭제하지 못했어요.')
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    toast.success('일기를 지웠어요.')
  }

  return (
    <div className="relative px-3 py-3">
      {/* 비공개 안내 — 어르신이 안심하고 쓸 수 있게 명시한다 */}
      <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        내 일기는 나만 볼 수 있어요. 마을 사람들에게 보이지 않아요.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'calendar' ? (
        <CalendarView entries={entries} onPickDate={() => setView('list')} />
      ) : entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <NotebookPen className="mx-auto mb-2 h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm font-medium">아직 쓴 일기가 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            오늘 있었던 일을 한 줄만 남겨보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {entries.map((e) => (
            <DiaryCard key={e.id} entry={e} onDelete={() => remove(e.id)} />
          ))}
        </div>
      )}

      {/* 우측 하단: 달력 보기 토글 */}
      <button
        onClick={() => setView((v) => (v === 'list' ? 'calendar' : 'list'))}
        className="fixed bottom-40 right-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-lg transition-transform active:scale-95"
      >
        <CalendarDays className="h-4 w-4" />
        {view === 'list' ? '달력으로 보기' : '목록으로 보기'}
      </button>

      {/* 새 일기 쓰기 */}
      <button
        onClick={() => setWriteOpen(true)}
        aria-label="일기 쓰기"
        className="fixed bottom-56 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <WriteDialog
        open={writeOpen}
        onOpenChange={setWriteOpen}
        onSaved={(entry) => {
          setEntries((prev) => [entry, ...prev])
          setView('list')
        }}
      />
    </div>
  )
}

/** 다이어리 느낌의 카드 — 날짜/기분/사진/글을 한 장에 담는다. */
function DiaryCard({ entry, onDelete }: { entry: DiaryEntry; onDelete: () => void }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {/* 종이 상단의 날짜 띠 */}
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-border bg-primary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {entry.mood && <span className="text-xl leading-none">{entry.mood}</span>}
          <span className="text-sm font-bold">{formatKoreanDate(entry.date)}</span>
        </div>
        <button
          onClick={onDelete}
          aria-label="일기 삭제"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {entry.photoPaths.length > 0 && (
        <div
          className={cn(
            'grid gap-0.5 bg-muted',
            entry.photoPaths.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {entry.photoPaths.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p}
              src={diaryFileUrl(p)}
              alt="일기 사진"
              loading="lazy"
              className={cn(
                'w-full object-cover',
                entry.photoPaths.length === 1 ? 'max-h-80' : 'h-40'
              )}
            />
          ))}
        </div>
      )}

      {entry.text && (
        <p className="whitespace-pre-line break-words px-4 py-3.5 text-[15px] leading-relaxed">
          {entry.text}
        </p>
      )}

      {entry.audioPath && (
        <div className="px-4 pb-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mic className="h-3.5 w-3.5" /> 내 목소리
          </p>
          <audio src={diaryFileUrl(entry.audioPath)} controls className="w-full" />
        </div>
      )}
    </article>
  )
}

/** 달력 보기 — 일기가 있는 날에 점을 찍어 한눈에 보이게 한다. */
function CalendarView({
  entries,
  onPickDate,
}: {
  entries: DiaryEntry[]
  onPickDate: (date: string) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const byDate = new Map<string, DiaryEntry[]>()
  for (const e of entries) {
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }

  const first = new Date(cursor.year, cursor.month, 1)
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const leading = first.getDay()
  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthKey = (day: number) =>
    `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const move = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const [selected, setSelected] = useState<string | null>(null)
  const selectedEntries = selected ? (byDate.get(selected) ?? []) : []

  return (
    <div className="pb-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => move(-1)} aria-label="이전 달" className="rounded-full p-2 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-bold">
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button onClick={() => move(1)} aria-label="다음 달" className="rounded-full p-2 hover:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-3">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <span key={`e${i}`} />
            const key = monthKey(day)
            const has = byDate.has(key)
            const isToday = key === todayStr()
            return (
              <button
                key={key}
                onClick={() => setSelected(has ? key : null)}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors',
                  has ? 'font-bold hover:bg-primary/15' : 'text-muted-foreground',
                  isToday && 'ring-2 ring-primary',
                  selected === key && 'bg-primary text-primary-foreground'
                )}
              >
                {day}
                {has && (
                  <span
                    className={cn(
                      'mt-0.5 h-1.5 w-1.5 rounded-full',
                      selected === key ? 'bg-primary-foreground' : 'bg-primary'
                    )}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selected && selectedEntries.length > 0 && (
        <div className="mt-4 space-y-4">
          {selectedEntries.map((e) => (
            <DiaryCard key={e.id} entry={e} onDelete={() => onPickDate(e.date)} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 일기 작성 — 말하기(음성→글), 사진, 기분을 함께 담는다. */
function WriteDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (entry: DiaryEntry) => void
}) {
  const [text, setText] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 음성 인식이 안 되는 기기(특히 iOS)에서는 목소리를 그대로 녹음해 남긴다.
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    setSpeechSupported(!!SR)
  }, [])

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        // 마이크 표시등이 계속 켜져 있지 않도록 트랙을 정리한다.
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      toast.error('마이크를 사용할 수 없어요. 권한을 확인해주세요.')
    }
  }

  function clearRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setAudioBlob(null)
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      toast.error('이 기기에서는 말하기를 쓸 수 없어요. 글로 입력해주세요.')
      return
    }

    const rec = new SR()
    rec.lang = 'ko-KR'
    rec.continuous = true
    rec.interimResults = false

    rec.onresult = (e: any) => {
      // 확정된 문장만 이어붙인다.
      let added = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) added += e.results[i][0].transcript
      }
      if (added) setText((prev) => (prev ? `${prev} ${added}` : added))
    }
    rec.onerror = (e: any) => {
      setListening(false)
      if (e.error === 'not-allowed') {
        toast.error('마이크 사용을 허용해주세요.')
      } else if (e.error !== 'aborted') {
        toast.error('말하기를 인식하지 못했어요.')
      }
    }
    rec.onend = () => setListening(false)

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function pickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length + picked.length > 4) {
      toast.error('사진은 최대 4장까지 넣을 수 있어요.')
      return
    }
    setFiles((prev) => [...prev, ...picked])
    setPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))])
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i])
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  function reset() {
    previews.forEach(URL.revokeObjectURL)
    clearRecording()
    setText('')
    setMood(null)
    setDate(todayStr())
    setFiles([])
    setPreviews([])
  }

  async function save() {
    if (!text.trim() && files.length === 0 && !audioBlob) {
      toast.error('내용이나 사진을 넣어주세요.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('text', text.trim())
      fd.append('date', date)
      if (mood) fd.append('mood', mood)
      for (const f of files) fd.append('photos', f)
      if (audioBlob) {
        const ext = (audioBlob.type.split('/')[1] || 'webm').split(';')[0]
        fd.append('audio', audioBlob, `voice.${ext}`)
      }

      const res = await fetch('/api/diary', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || '저장하지 못했어요.')
        return
      }
      onSaved({
        id: d.id,
        date: d.date,
        text: d.text,
        mood: d.mood,
        photoPaths: d.photoPaths ?? [],
        audioPath: d.audioPath ?? null,
        createdAt: new Date().toISOString(),
      })
      toast.success('일기를 저장했어요.')
      reset()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !saving) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>오늘의 일기</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">오늘 기분</label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(mood === m ? null : m)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-colors',
                    mood === m ? 'border-primary bg-primary/15' : 'border-border'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium">내용</label>
              {speechSupported && (
                <Button
                  type="button"
                  onClick={toggleMic}
                  variant={listening ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                >
                  {listening ? (
                    <>
                      <MicOff className="mr-1 h-4 w-4" /> 그만 말하기
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1 h-4 w-4" /> 말로 쓰기
                    </>
                  )}
                </Button>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={
                speechSupported
                  ? '글로 쓰거나 "말로 쓰기"를 눌러 이야기하세요.'
                  : '오늘 있었던 일을 적어보세요.'
              }
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px] leading-relaxed"
            />
            {listening && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                듣고 있어요. 편하게 말씀하세요.
              </p>
            )}
          </div>

          {/* 목소리 녹음 — 음성 인식이 안 되는 기기에서도 말로 남길 수 있다 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              목소리로 남기기{' '}
              <span className="font-normal text-muted-foreground">(선택)</span>
            </label>

            {!speechSupported && (
              <p className="mb-1.5 text-xs text-muted-foreground">
                이 기기는 말을 글로 바꾸는 기능을 지원하지 않아요. 목소리를 그대로 담아둘 수 있어요.
              </p>
            )}

            {audioUrl ? (
              <div className="flex items-center gap-2">
                <audio src={audioUrl} controls className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearRecording}
                  aria-label="녹음 지우기"
                  className="shrink-0 rounded-full text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={toggleRecord}
                variant={recording ? 'default' : 'outline'}
                size="lg"
                className="w-full rounded-xl"
              >
                {recording ? (
                  <>
                    <span className="mr-2 h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
                    녹음 중… 눌러서 끝내기
                  </>
                ) : (
                  <>
                    <Mic className="mr-1.5 h-4 w-4" /> 목소리 녹음하기
                  </>
                )}
              </Button>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              사진 <span className="font-normal text-muted-foreground">(최대 4장)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={pickPhotos}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
            >
              <ImagePlus className="h-4 w-4" /> 사진 넣기 ({files.length}/4)
            </button>

            {previews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="사진 빼기"
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button onClick={save} size="lg" className="rounded-xl" disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            저장하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
