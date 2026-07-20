import { cn } from '@/lib/utils'
import { communityTypeMeta } from '@/lib/village'

export function CommunityBadge({
  type,
  size = 'md',
  className,
}: {
  type: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const meta = communityTypeMeta(type)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      style={{
        backgroundColor: meta.color + '33',
        color: '#1a1a17',
      }}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}
