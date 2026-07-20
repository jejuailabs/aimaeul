'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-context'
import { doc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { setTheme, theme } = useTheme()
  const { user } = useAuth()

  function handleSetTheme(t: string) {
    setTheme(t)
    if (user) {
      updateDoc(doc(firestore, 'users', user.uid), { themePreference: t }).catch(() => {})
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className="rounded-full border-border/60 bg-background/80 backdrop-blur"
          aria-label="테마 변경"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          {!compact && <span className="ml-1.5 text-xs">테마</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSetTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> 밝게
          {theme === 'light' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> 어둡게
          {theme === 'dark' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> 시스템
          {theme === 'system' && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
