'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSocket } from '@/lib/socket'

type ChatMessage = {
  id: string
  communityId: string
  authorId: string
  authorName: string
  authorPhotoURL?: string | null
  type: string
  text?: string | null
  photoId?: string | null
  emojiUrl?: string | null
  gameResultPayload?: any | null
  createdAt: string
}

type SendPayload = {
  type?: string
  text?: string | null
  photoId?: string | null
  emojiUrl?: string | null
  gameResultPayload?: any | null
}

/**
 * Real-time chat hook. Joins a community room, keeps the latest N messages,
 * and exposes a `send` helper that writes through the socket service (DB + broadcast).
 */
export function useChatSocket(
  communityId: string | null | undefined,
  initial: ChatMessage[] = [],
  max = 200
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial)
  const [online, setOnline] = useState<number>(0)
  const [typingFrom, setTypingFrom] = useState<string | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!communityId) return
    const socket = getSocket()
    const onConnect = () => {
      socket.emit('room:join', { communityId })
    }
    if (socket.connected) onConnect()
    else socket.on('connect', onConnect)

    const onMessage = (msg: ChatMessage) => {
      if (msg.communityId !== communityId) return
      setMessages((prev) => {
        const next = [...prev, msg]
        return next.length > max ? next.slice(next.length - max) : next
      })
      setTypingFrom(null)
    }
    const onPresence = (p: { communityId: string; online: number }) => {
      if (p.communityId === communityId) setOnline(p.online)
    }
    const onTyping = ({ authorName }: { authorName: string }) => {
      setTypingFrom(authorName)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTypingFrom(null), 2500)
    }

    socket.on('chat:message', onMessage)
    socket.on('presence:update', onPresence)
    socket.on('chat:typing', onTyping)

    return () => {
      socket.off('connect', onConnect)
      socket.off('chat:message', onMessage)
      socket.off('presence:update', onPresence)
      socket.off('chat:typing', onTyping)
      socket.emit('room:leave', { communityId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, max])

  const send = useCallback(
    (payload: {
      authorId: string
      authorName: string
      authorPhotoURL?: string | null
    } & SendPayload) => {
      if (!communityId) return
      const socket = getSocket()
      socket.emit('chat:send', { communityId, ...payload })
    },
    [communityId]
  )

  const notifyTyping = useCallback(
    (authorName: string) => {
      if (!communityId) return
      const socket = getSocket()
      socket.emit('chat:typing', { communityId, authorName })
    },
    [communityId]
  )

  return { messages, setMessages, online, typingFrom, send, notifyTyping }
}

export type { ChatMessage }
