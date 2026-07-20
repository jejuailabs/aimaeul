import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'

// Demo + adaptive auth. Spec calls for Google 로그인 via Firebase Auth,
// adapted here to NextAuth Credentials (email + name) for the local environment.
// In production this would be GoogleProvider — the rest of the app only depends
// on `session.user.id` / `.name`, so swapping providers later is trivial.
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: '마을 로그인',
      credentials: {
        email: { label: '이메일', type: 'email' },
        name: { label: '이름', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const name = credentials?.name?.trim()
        if (!email || !name) return null
        const user = await db.user.upsert({
          where: { email },
          create: { email, name },
          update: { name },
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.photoURL,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.picture = (user as any).image ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.uid as string
      }
      return session
    },
  },
  pages: { signIn: '/login' },
}
