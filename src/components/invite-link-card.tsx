'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * 마을 초대 링크 공유 카드.
 *
 * 스마트폰이 익숙하지 않은 어르신 회원은 초대코드를 타이핑하기 어렵다.
 * 회장님이 이 링크를 메신저로 보내면, 회원은 링크를 누르고 구글 로그인만 하면
 * 곧바로 채팅방(카카오톡과 동일한 화면)으로 들어온다.
 */
export function InviteLinkCard({
  inviteCode,
  communityName,
}: {
  inviteCode: string
  communityName: string
}) {
  const [copied, setCopied] = useState(false)

  // 배포 도메인이 환경마다 달라 브라우저의 현재 origin을 사용한다.
  const link =
    typeof window === 'undefined' ? '' : `${window.location.origin}/join/${inviteCode}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('초대 링크를 복사했어요. 메신저에 붙여넣어 보내세요.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했어요. 링크를 길게 눌러 복사해주세요.')
    }
  }

  async function share() {
    const text = `[${communityName}] 우리 마을 채팅방에 초대합니다.\n아래 링크를 누르면 바로 들어올 수 있어요.\n${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: communityName, text, url: link })
        return
      } catch {
        // 사용자가 공유를 취소한 경우 등 — 복사로 대체하지 않고 조용히 종료
        return
      }
    }
    copy()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">마을 초대하기</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        링크를 보내면 어르신도 코드 입력 없이 누르기만 하면 들어와요.
      </p>

      <div className="mb-2 truncate rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {link || `/join/${inviteCode}`}
      </div>

      <div className="flex gap-2">
        <Button onClick={share} className="flex-1 rounded-xl" size="lg">
          <Share2 className="mr-1.5 h-4 w-4" /> 링크 보내기
        </Button>
        <Button onClick={copy} variant="outline" className="rounded-xl" size="lg">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="sr-only">링크 복사</span>
        </Button>
      </div>
    </div>
  )
}
