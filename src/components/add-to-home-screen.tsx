'use client'

import { useEffect, useState } from 'react'
import { Check, Share, SquarePlus, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * 바탕화면에 바로가기 만들기.
 *
 * 어르신이 앱처럼 쓰려면 매번 브라우저에서 주소를 찾는 대신
 * 바탕화면 아이콘을 누르는 편이 훨씬 쉽다.
 *
 * 안드로이드/크롬은 브라우저가 설치 창을 띄워준다(beforeinstallprompt).
 * iOS 사파리는 프로그램으로 띄울 수 없어 직접 하는 방법을 그림처럼 안내한다.
 */
export function AddToHomeScreen({ communityName }: { communityName: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // 이미 바로가기로 실행 중이면 버튼을 보여줄 이유가 없다.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) setInstalled(true)

    setIsIos(/iPhone|iPad|iPod/i.test(navigator.userAgent))

    function onBeforeInstall(e: Event) {
      // 브라우저 기본 배너를 막고, 우리가 원하는 시점에 띄운다.
      e.preventDefault()
      setPromptEvent(e as InstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      toast.success('바탕화면에 만들었어요!')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setPromptEvent(null)
      return
    }
    // iOS이거나 브라우저가 설치 창을 주지 않는 경우
    setGuideOpen(true)
  }

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full px-2.5"
        aria-label="바탕화면에 바로가기 만들기"
      >
        <Smartphone className="mr-1 h-4 w-4" />
        <span className="text-xs font-medium">바로가기</span>
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>바탕화면에 바로가기 만들기</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            휴대폰 바탕화면에 <span className="font-semibold text-foreground">{communityName}</span>{' '}
            아이콘을 만들어 두면, 다음부터 한 번만 눌러서 들어올 수 있어요.
          </p>

          {isIos ? (
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  1
                </span>
                <span className="flex items-center gap-1.5 pt-0.5 text-sm">
                  화면 아래쪽 <Share className="inline h-4 w-4" /> 버튼을 누르세요
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  2
                </span>
                <span className="flex items-center gap-1.5 pt-0.5 text-sm">
                  <SquarePlus className="inline h-4 w-4" /> &ldquo;홈 화면에 추가&rdquo;를 고르세요
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  3
                </span>
                <span className="flex items-center gap-1.5 pt-0.5 text-sm">
                  <Check className="inline h-4 w-4" /> 오른쪽 위 &ldquo;추가&rdquo;를 누르면 끝나요
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  1
                </span>
                <span className="pt-0.5 text-sm">
                  브라우저 오른쪽 위 <span className="font-semibold">⋮</span> 버튼을 누르세요
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  2
                </span>
                <span className="pt-0.5 text-sm">
                  &ldquo;홈 화면에 추가&rdquo; 또는 &ldquo;앱 설치&rdquo;를 고르세요
                </span>
              </li>
            </ol>
          )}

          <Button onClick={() => setGuideOpen(false)} size="lg" className="mt-2 rounded-xl">
            알겠어요
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
