'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { communityTypeMeta } from '@/lib/village'

type Community = {
  id: string
  name: string
  communityType: string
  regionName: string
}

export function SearchBar({ communities }: { communities: Community[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? communities.filter(
        (c) =>
          c.name.includes(query) ||
          c.regionName.includes(query) ||
          c.communityType.includes(query)
      )
    : []

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="마을 이름 검색"
          className="w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-48"
        />
        <button onClick={() => { setOpen(false); setQuery('') }}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {query.trim() && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card shadow-lg sm:w-80">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">검색 결과가 없어요</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.map((c) => {
                const meta = communityTypeMeta(c.communityType)
                return (
                  <li key={c.id}>
                    <Link
                      href={`/village/${c.id}`}
                      onClick={() => { setOpen(false); setQuery('') }}
                      className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <span>{meta.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{c.regionName}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
