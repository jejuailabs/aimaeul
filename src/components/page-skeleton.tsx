/**
 * 화면 전환 즉시 보여줄 로딩 뼈대.
 *
 * loading.tsx가 없으면 Next.js는 서버 데이터를 모두 받을 때까지 화면을 바꾸지 않아
 * "버튼이 안 눌린 것 같은" 무반응 구간이 생긴다. 이 컴포넌트로 즉시 전환시킨다.
 */
export function PageSkeleton({
  header = true,
  rows = 3,
}: {
  header?: boolean
  rows?: number
}) {
  return (
    <div className="animate-pulse">
      {header && (
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-8 w-20 rounded-full bg-muted" />
        </div>
      )}
      <div className="space-y-3 px-4 py-4">
        <div className="h-6 w-2/5 rounded bg-muted" />
        <div className="h-4 w-3/5 rounded bg-muted/70" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-border p-3">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">불러오는 중…</span>
    </div>
  )
}
