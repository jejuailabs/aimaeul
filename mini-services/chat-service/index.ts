// 마을 공동체 실시간 채팅 서비스 (socket.io, port 3003)
// - 같은 SQLite DB(prisma)를 Next.js 앱과 공유
// - 클라이언트는 io("/?XTransformPort=3003") 로 연결 (Caddy 가 path "/" 로 포워드)
// - 채팅 메시지는 이 서비스가 DB에 write 한 뒤 해당 커뮤니티 room 에 broadcast
//   → 회원 채팅방(/app/chat/[id]) 과 마을 홈페이지 Live Chat(/village/[id]) 가 동일 이벤트 수신
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const PORT = 3003

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // 내부 브로드캐스트 엔드포인트 (Next.js API route → socket service)
  // POST /internal/broadcast  { communityId, message }
  // DB write 없이 room 에만 브로드캐스트 (API 가 이미 DB 에 썼음)
  if (req.method === 'POST' && req.url === '/internal/broadcast') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { communityId, message } = JSON.parse(body)
      if (communityId && message) {
        io.to(communityId).emit('chat:message', message)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'missing communityId/message' }))
      return
    } catch (e) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: 'invalid json' }))
      return
    }
  }
  res.writeHead(404)
  res.end('not found')
})
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// communityId -> Set<socketId> (온라인 카운트용)
const roomPresence = new Map<string, Set<string>>()

function bumpPresence(communityId: string, socketId: string, add: boolean) {
  if (!communityId) return
  let set = roomPresence.get(communityId)
  if (!set) {
    set = new Set()
    roomPresence.set(communityId, set)
  }
  if (add) set.add(socketId)
  else set.delete(socketId)
  if (set.size === 0) roomPresence.delete(communityId)
  io.to(communityId).emit('presence:update', { communityId, online: set.size })
}

io.on('connection', (socket) => {
  console.log(`[chat] connected ${socket.id}`)

  socket.on('room:join', ({ communityId }: { communityId: string }) => {
    if (!communityId) return
    socket.data.communityId = communityId
    socket.join(communityId)
    bumpPresence(communityId, socket.id, true)
  })

  socket.on('room:leave', ({ communityId }: { communityId: string }) => {
    socket.leave(communityId)
    bumpPresence(communityId, socket.id, false)
  })

  // 클라이언트가 메시지 전송 → DB write → room broadcast
  socket.on(
    'chat:send',
    async (payload: {
      communityId: string
      authorId: string
      authorName: string
      authorPhotoURL?: string | null
      type?: string
      text?: string | null
      photoId?: string | null
      emojiUrl?: string | null
      gameResultPayload?: any | null
    }) => {
      try {
        const msg = await db.message.create({
          data: {
            communityId: payload.communityId,
            authorId: payload.authorId,
            authorName: payload.authorName,
            authorPhotoURL: payload.authorPhotoURL ?? null,
            type: payload.type ?? 'text',
            text: payload.text ?? null,
            photoId: payload.photoId ?? null,
            emojiUrl: payload.emojiUrl ?? null,
            gameResultPayload: payload.gameResultPayload
              ? JSON.stringify(payload.gameResultPayload)
              : 'null',
          },
        })
        io.to(payload.communityId).emit('chat:message', {
          ...msg,
          gameResultPayload: msg.gameResultPayload && msg.gameResultPayload !== 'null'
            ? JSON.parse(msg.gameResultPayload)
            : null,
        })
      } catch (err) {
        console.error('[chat] chat:send error', err)
        socket.emit('chat:error', { message: '전송 실패' })
      }
    }
  )

  // 타이핑 인디케이터
  socket.on(
    'chat:typing',
    ({ communityId, authorName }: { communityId: string; authorName: string }) => {
      socket.to(communityId).emit('chat:typing', { authorName })
    }
  )

  socket.on('disconnect', () => {
    const cid = socket.data.communityId
    if (cid) bumpPresence(cid, socket.id, false)
    console.log(`[chat] disconnected ${socket.id}`)
  })

  socket.on('error', (err) => console.error(`[chat] socket error`, err))
})

httpServer.listen(PORT, () => {
  console.log(`[chat-service] socket.io listening on port ${PORT}`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
