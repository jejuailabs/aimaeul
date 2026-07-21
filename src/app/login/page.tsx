'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/app/chat'
  const { user, communities, loading, signInWithGoogle } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      if (communities.length > 0) {
        router.push(callbackUrl)
      } else {
        router.push('/onboarding')
      }
    }
  }, [loading, user, communities, callbackUrl, router])

  async function handleGoogleLogin() {
    setSigningIn(true)
    try {
      // 세션 쿠키 생성은 auth-context의 onAuthStateChanged에서 처리한다.
      // 모바일(리다이렉트)에서는 이 아래 코드가 실행되지 않기 때문이다.
      await signInWithGoogle()
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        toast.error('로그인에 실패했어요. 다시 시도해주세요.')
      }
    } finally {
      setSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
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

        <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <Button
            onClick={handleGoogleLogin}
            disabled={signingIn}
            className="w-full rounded-xl"
            size="lg"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {signingIn ? '로그인 중...' : 'Google로 시작하기'}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Google 계정으로 간편하게 로그인하세요.
            <br />별도 회원가입 없이 바로 시작할 수 있어요.
          </p>
        </div>
      </main>
    </div>
  )
}
