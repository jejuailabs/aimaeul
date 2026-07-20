'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { LogIn, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { toast } from 'sonner'

const DEMO_ACCOUNTS = [
  { email: 'younghee@maul.kr', name: '김영희', label: '김영희 (봉성리 부녀회장)' },
  { email: 'minho@maul.kr', name: '정민호', label: '정민호 (홍천 청년회)' },
  { email: 'gildong@maul.kr', name: '홍길동 할아버지', label: '홍길동 할아버지 (하동 노인회)' },
]

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/app/chat'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim()) {
      toast.error('이메일과 이름을 모두 입력해주세요.')
      return
    }
    setLoading(true)
    const res = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      name: name.trim(),
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      toast.error('로그인에 실패했어요. 다시 시도해주세요.')
      return
    }
    toast.success(`${name.trim()}님 환영해요!`)
    router.push(callbackUrl)
    router.refresh()
  }

  async function quickLogin(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setLoading(true)
    const res = await signIn('credentials', {
      email: acc.email,
      name: acc.name,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      toast.error('로그인 실패')
      return
    }
    toast.success(`${acc.name}님으로 로그인했어요.`)
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/10 to-background">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold text-muted-foreground">
          ← 마을 지도로
        </Link>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-3xl font-black text-primary-foreground shadow-lg">
            마
          </div>
          <h1 className="text-2xl font-black">우리마을</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            마을 공동체 플랫폼에 로그인하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoComplete="name"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@maul.kr"
              autoComplete="email"
              className="rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl"
            size="lg"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {loading ? '로그인 중...' : 'Google로 시작하기'}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            실제 서비스에서는 Google 로그인을 사용합니다.
            <br />데모에서는 이름·이메일로 간편 로그인해요.
          </p>
        </form>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> 데모 계정으로 빠른 시작
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => quickLogin(acc)}
                disabled={loading}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <span className="font-medium">{acc.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
