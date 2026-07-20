'use client'

import { useState } from 'react'
import { MapPin, Camera, Clock, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKoreanDate, formatKoreanTime } from '@/lib/village'

export type ExifData = {
  takenAt?: Date | string | null
  lat?: number | null
  lng?: number | null
  device?: string | null
  lens?: string | null
  location?: string | null
}

/**
 * EXIF overlay (04 문서). 반투명 그라데이션 위에 📍📷🗓🕒 아이콘+텍스트.
 * 정보 없는 항목은 조용히 생략.
 */
export function ExifOverlay({
  exif,
  className,
  variant = 'bottom',
}: {
  exif: ExifData
  className?: string
  variant?: 'bottom' | 'inline'
}) {
  const items: { icon: React.ReactNode; text: string }[] = []
  if (exif.location) {
    items.push({ icon: <MapPin className="h-3.5 w-3.5" />, text: exif.location })
  } else if (exif.lat != null && exif.lng != null) {
    items.push({
      icon: <MapPin className="h-3.5 w-3.5" />,
      text: `${exif.lat.toFixed(3)}, ${exif.lng.toFixed(3)}`,
    })
  }
  if (exif.device) {
    items.push({ icon: <Smartphone className="h-3.5 w-3.5" />, text: exif.device })
  }
  if (exif.takenAt) {
    const d = new Date(exif.takenAt)
    items.push({ icon: <span className="text-xs">🗓</span>, text: formatKoreanDate(d) })
    items.push({ icon: <Clock className="h-3.5 w-3.5" />, text: formatKoreanTime(d) })
  }

  if (items.length === 0) return null

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', className)}>
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-muted-foreground">
            {it.icon}
            {it.text}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 text-white',
        className
      )}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {it.icon}
            {it.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 사진 + EXIF 오버레이 + 클릭 시 확대 라이트박스 */
export function PhotoWithExif({
  src,
  alt,
  exif,
  uploaderName,
  className,
  rounded = true,
}: {
  src: string
  alt: string
  exif: ExifData
  uploaderName?: string
  className?: string
  rounded?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative block w-full overflow-hidden bg-muted',
          rounded && 'rounded-2xl',
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <ExifOverlay exif={exif} />
        {uploaderName && (
          <div className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur">
            {uploaderName}
          </div>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 text-center text-white">
              {uploaderName && <p className="text-sm font-medium">{uploaderName}</p>}
              <ExifOverlay exif={exif} variant="inline" className="mt-1 justify-center text-white/80" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
