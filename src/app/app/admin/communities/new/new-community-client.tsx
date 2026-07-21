'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocationPicker } from '@/components/location-picker'
import { SIDO_LIST, SIGUNGU_BY_SIDO, COMMUNITY_TYPES } from '@/lib/regions'
import { toast } from 'sonner'

type Created = { id: string; name: string; inviteCode: string }

export function NewCommunityClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [communityType, setCommunityType] = useState('')
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [eupmyeondong, setEupmyeondong] = useState('')
  const [description, setDescription] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  const sigunguOptions = useMemo(() => (sido ? SIGUNGU_BY_SIDO[sido] ?? [] : []), [sido])

  const [geocoding, setGeocoding] = useState(false)
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null)

  /**
   * 입력한 주소로 지도 위치를 자동으로 잡아준다.
   * 지도를 손으로 찾아 찍게 하면 어렵고, 엉뚱한 곳을 찍기 쉽다.
   * 사용자가 지도를 직접 눌러 고친 뒤에는 덮어쓰지 않는다.
   */
  useEffect(() => {
    if (!sido || !sigungu) return
    const query = [sido, sigungu, eupmyeondong].filter(Boolean).join(' ')

    let cancelled = false
    // 타이핑 중에 매번 조회하지 않도록 잠깐 기다린다.
    const timer = setTimeout(async () => {
      setGeocoding(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const d = await res.json().catch(() => ({}))
        const hit = d.results?.[0]
        if (cancelled || !hit) return
        setCoords({ lat: hit.lat, lng: hit.lng })
        setGeocodedLabel(hit.label)
      } finally {
        if (!cancelled) setGeocoding(false)
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sido, sigungu, eupmyeondong])

  const canSubmit =
    name.trim() && communityType && sido && sigungu && coords && !saving

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          communityType,
          sido,
          sigungu,
          eupmyeondong: eupmyeondong.trim(),
          description: description.trim(),
          lat: coords!.lat,
          lng: coords!.lng,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '마을 생성에 실패했어요.')
        return
      }
      setCreated({ id: data.id, name: data.name, inviteCode: data.inviteCode })
      toast.success('마을을 만들었어요!')
    } catch {
      toast.error('마을 생성 중 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  async function copyInvite() {
    if (!created) return
    const link = `${window.location.origin}/join/${created.inviteCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('초대 링크를 복사했어요.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했어요.')
    }
  }

  if (created) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
          <p className="text-lg font-bold">{created.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">마을이 만들어졌어요.</p>

          <div className="mt-4 rounded-xl bg-card p-3">
            <p className="text-xs text-muted-foreground">초대코드</p>
            <p className="mt-0.5 text-xl font-black tracking-widest">{created.inviteCode}</p>
          </div>

          <div className="mt-3 flex gap-2">
            <Button onClick={copyInvite} variant="outline" className="flex-1 rounded-xl">
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              초대 링크 복사
            </Button>
            <Button
              onClick={() => router.push(`/app/chat/${created.id}`)}
              className="flex-1 rounded-xl"
            >
              채팅방 열기
            </Button>
          </div>

          <button
            onClick={() => {
              setCreated(null)
              setName('')
              setCommunityType('')
              setSido('')
              setSigungu('')
              setEupmyeondong('')
              setDescription('')
              setCoords(null)
            }}
            className="mt-4 text-xs text-muted-foreground underline"
          >
            마을 하나 더 만들기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <div>
        <label className="mb-1 block text-sm font-semibold">마을(모임) 이름</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 봉성리 부녀회"
          className="rounded-xl"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">모임 종류</label>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setCommunityType(t === communityType ? '' : t)}
              className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                t === communityType
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">시 / 도</label>
        <select
          value={sido}
          onChange={(e) => {
            setSido(e.target.value)
            setSigungu('')
          }}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">선택하세요</option>
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {sido && (
        <div>
          <label className="mb-1 block text-sm font-semibold">시 / 군 / 구</label>
          <select
            value={sigungu}
            onChange={(e) => setSigungu(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">선택하세요</option>
            {sigunguOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold">
          읍 / 면 / 동 <span className="font-normal text-muted-foreground">(선택)</span>
        </label>
        <Input
          value={eupmyeondong}
          onChange={(e) => setEupmyeondong(e.target.value)}
          placeholder="예: 석보면"
          className="rounded-xl"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">
          소개 <span className="font-normal text-muted-foreground">(선택)</span>
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 함께 모여 마을을 가꿔가요!"
          className="rounded-xl"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">마을 위치</label>
        <p className="mb-2 text-xs text-muted-foreground">
          {geocoding
            ? '주소로 위치를 찾는 중…'
            : geocodedLabel
              ? `주소로 자동 지정했어요 — ${geocodedLabel.split(',').slice(0, 3).join(', ')}`
              : '읍·면·동까지 입력하면 지도가 자동으로 이동해요. 필요하면 지도를 눌러 조정하세요.'}
        </p>
        <LocationPicker
          value={coords}
          onChange={(v) => {
            // 직접 찍으면 자동 지정 안내는 지운다.
            setGeocodedLabel(null)
            setCoords(v)
          }}
        />
      </div>

      <Button onClick={submit} disabled={!canSubmit} size="lg" className="w-full rounded-xl">
        {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        마을 만들기
      </Button>
    </div>
  )
}
