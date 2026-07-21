'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * 전역 화면 전환 표시기.
 *
 * App Router에는 라우터 이벤트가 없어서 링크마다 상태를 붙여야 했는데,
 * 그러면 새 링크를 만들 때마다 빠뜨리게 된다. 여기서는 document에
 * 캡처 단계 클릭 리스너를 하나만 걸어 "모든 내부 링크"를 잡는다.
 *
 * 서버가 응답하는 데 1~2초가 걸려도 누른 즉시 상단 바와 커서가 바뀌므로
 * 눌렸는지 몰라 다시 누르는 일이 없어진다.
 */
export function NavProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const startedAtRef = useRef(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 링크 클릭을 캡처 단계에서 가로채 즉시 표시를 켠다.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // 새 탭/다운로드/수정키 클릭은 화면 전환이 아니다.
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const el = (e.target as Element | null)?.closest?.('a')
      if (!el) return

      const anchor = el as HTMLAnchorElement
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      // 현재 화면과 완전히 같은 주소면 전환이 일어나지 않는다.
      const current = window.location.pathname + window.location.search
      const next = url.pathname + url.search
      if (next === current) return

      startedAtRef.current = Date.now()
      setActive(true)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // 주소가 실제로 바뀌면 전환이 끝난 것으로 본다.
  useEffect(() => {
    if (!active) return
    // 너무 빨리 사라지면 깜빡임으로 보이므로 최소 노출 시간을 준다.
    const elapsed = Date.now() - startedAtRef.current
    const remain = Math.max(0, 250 - elapsed)
    hideTimerRef.current = setTimeout(() => setActive(false), remain)
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // pathname/searchParams가 바뀐 시점에만 종료 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // 뒤로/앞으로 가기도 전환이다.
  useEffect(() => {
    function onPopState() {
      startedAtRef.current = Date.now()
      setActive(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // 전환이 비정상적으로 길어지면(오류 등) 표시가 남지 않도록 해제한다.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(false), 15000)
    return () => clearTimeout(t)
  }, [active])

  // 누르는 동안 커서로도 알린다.
  useEffect(() => {
    document.documentElement.classList.toggle('nav-busy', active)
    return () => document.documentElement.classList.remove('nav-busy')
  }, [active])

  if (!active) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1"
      role="status"
      aria-live="polite"
      aria-label="화면을 불러오는 중"
    >
      <div className="nav-progress__bar h-full bg-primary" />
    </div>
  )
}
