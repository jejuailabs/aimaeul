'use client'

import { useState } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

/**
 * 헤더에 놓는 초대 링크 아이콘.
 *
 * 예전에는 마을홈 본문에 큰 카드로 있어 자리를 많이 차지했다.
 * 자주 쓰는 기능은 아니므로 아이콘 하나로 줄이고, 눌렀을 때만 펼친다.
 */
export function InviteLinkButton({
  inviteCode,
  communityName,
}: {
  inviteCode: string
  communityName: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const link =
    typeof window === 'undefined' ? '' : `${window.location.origin}/join/${inviteCode}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('초대 링크를 복사했어요.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했어요. 링크를 길게 눌러 복사해주세요.')
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        // 주소만 넘긴다. text를 함께 주면 공유 시트의 "복사"가 문구까지 복사한다.
        await navigator.share({ title: communityName, url: link })
        return
      } catch {
        return
      }
    }
    copy()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full"
        aria-label="마을 초대 링크"
        onClick={() => setOpen(true)}
      >
        <Link2 className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>마을 초대하기</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            링크를 보내면 어르신도 코드 입력 없이 누르기만 하면 들어와요.
          </p>

          <div className="truncate rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {link || `/join/${inviteCode}`}
          </div>

          <div className="flex gap-2">
            <Button onClick={share} size="lg" className="flex-1 rounded-xl">
              <Share2 className="mr-1.5 h-4 w-4" /> 링크 보내기
            </Button>
            <Button onClick={copy} size="lg" variant="outline" className="rounded-xl">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">링크 복사</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
