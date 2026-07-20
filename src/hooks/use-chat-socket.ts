'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  limitToLast,
  onSnapshot,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

type ChatMessage = {
  id: string
  communityId: string
  authorUid: string
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

export function useChatSocket(
  communityId: string | null | undefined,
  initial: ChatMessage[] = [],
  max = 200
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial)
  const [online] = useState<number>(0)
  const [typingFrom] = useState<string | null>(null)

  useEffect(() => {
    if (!communityId) return

    const messagesRef = collection(
      firestore,
      'communities',
      communityId,
      'messages'
    )
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limitToLast(max))

    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          id: doc.id,
          communityId,
          authorUid: d.authorUid ?? '',
          authorName: d.authorName ?? '',
          authorPhotoURL: d.authorPhotoURL ?? null,
          type: d.type ?? 'text',
          text: d.text ?? null,
          photoId: d.photoId ?? null,
          emojiUrl: d.emojiUrl ?? null,
          gameResultPayload: d.gameResultPayload ?? null,
          createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }
      })
      setMessages(msgs)
    })

    return () => unsub()
  }, [communityId, max])

  const send = useCallback(
    async (payload: {
      authorUid: string
      authorName: string
      authorPhotoURL?: string | null
    } & SendPayload) => {
      if (!communityId) return

      const optimisticId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        communityId,
        authorUid: payload.authorUid,
        authorName: payload.authorName,
        authorPhotoURL: payload.authorPhotoURL ?? null,
        type: payload.type ?? 'text',
        text: payload.text ?? null,
        photoId: payload.photoId ?? null,
        emojiUrl: payload.emojiUrl ?? null,
        gameResultPayload: payload.gameResultPayload ?? null,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticMsg])

      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityId,
            type: payload.type ?? 'text',
            text: payload.text ?? null,
            photoId: payload.photoId ?? null,
            emojiUrl: payload.emojiUrl ?? null,
            gameResultPayload: payload.gameResultPayload ?? null,
          }),
        })
        if (!res.ok) {
          setMessages((prev) => prev.map((m) =>
            m.id === optimisticId ? { ...m, id: `failed_${optimisticId}` } : m
          ))
        }
      } catch (err) {
        console.error('[useChatSocket] send error', err)
        setMessages((prev) => prev.map((m) =>
          m.id === optimisticId ? { ...m, id: `failed_${optimisticId}` } : m
        ))
      }
    },
    [communityId]
  )

  const notifyTyping = useCallback(
    (_authorName: string) => {
      // typing indicator not implemented with Firestore
    },
    []
  )

  return { messages, setMessages, online, typingFrom, send, notifyTyping }
}

export type { ChatMessage }
