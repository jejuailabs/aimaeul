'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, firestore } from '@/lib/firebase'

type AuthUser = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
  /** 전역 역할. 슈퍼관리자는 모든 마을의 가입 신청을 승인할 수 있다. */
  role: 'superadmin' | 'user'
  /** 회장으로 지정된 공동체 id 목록. */
  adminCommunities: string[]
}

type CommunityRef = {
  id: string
  name: string
  communityType: string
  regionName: string
}

type AuthContextType = {
  user: AuthUser | null
  communities: CommunityRef[]
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshCommunities: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  communities: [],
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshCommunities: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

async function fetchUserCommunities(uid: string): Promise<CommunityRef[]> {
  const userDoc = await getDoc(doc(firestore, 'users', uid))
  if (!userDoc.exists()) return []
  const communityIds: string[] = userDoc.data().communityIds || []
  if (communityIds.length === 0) return []

  const results: CommunityRef[] = []
  for (const cid of communityIds) {
    const cDoc = await getDoc(doc(firestore, 'communities', cid))
    if (cDoc.exists()) {
      const d = cDoc.data()
      results.push({
        id: cid,
        name: d.name,
        communityType: d.communityType,
        regionName: d.regionName,
      })
    }
  }
  return results
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [communities, setCommunities] = useState<CommunityRef[]>([])
  const [loading, setLoading] = useState(true)

  // 모바일 리다이렉트 로그인의 실패 사유를 조용히 삼키지 않도록 확인한다.
  useEffect(() => {
    getRedirectResult(auth).catch((e) => {
      console.error('[auth] 리다이렉트 로그인 실패:', e?.code, e?.message)
    })
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const baseUser = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || '익명',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        }
        // 역할은 users 문서에만 있으므로, 우선 기본값으로 노출한 뒤 조회 결과로 갱신한다.
        setUser({ ...baseUser, role: 'user', adminCommunities: [] })

        // 서버 세션 쿠키를 여기서 만든다.
        //
        // 모바일은 signInWithRedirect라 로그인 버튼 핸들러가 중간에 끊긴다
        // (브라우저가 구글로 이동). 그래서 핸들러에서 쿠키를 만들면 모바일은
        // 영영 쿠키가 생기지 않고, 미들웨어가 /login으로 되돌려 무한 반복된다.
        // 인증 상태가 복구되는 이 지점에서 만들어야 팝업/리다이렉트 모두 안전하다.
        try {
          const idToken = await firebaseUser.getIdToken()
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          })
        } catch {
          // 쿠키 생성 실패 시에도 클라이언트 상태는 유지하고, 보호된 경로 접근 시
          // 미들웨어가 다시 로그인으로 안내한다.
        }

        const userRef = doc(firestore, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '익명',
            photoURL: firebaseUser.photoURL || null,
            email: firebaseUser.email || null,
            communityIds: [],
            themePreference: 'system',
            createdAt: serverTimestamp(),
          })
          setCommunities([])
        } else {
          const data = userSnap.data()
          setUser({
            ...baseUser,
            role: data.role === 'superadmin' ? 'superadmin' : 'user',
            adminCommunities: data.adminCommunities || [],
          })
          const comms = await fetchUserCommunities(firebaseUser.uid)
          setCommunities(comms)
          const savedTheme = data.themePreference
          if (savedTheme && typeof window !== 'undefined') {
            const { useTheme } = await import('next-themes')
            document.documentElement.setAttribute('data-theme', savedTheme === 'system' ? '' : savedTheme)
            localStorage.setItem('theme', savedTheme)
          }
        }
      } else {
        setUser(null)
        setCommunities([])
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  async function signInWithGoogle() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      // 리다이렉트는 여기서 반환되지 않는다. 브라우저가 구글로 이동하고,
      // 돌아온 뒤 onAuthStateChanged가 세션 쿠키까지 만든다.
      await signInWithRedirect(auth, googleProvider)
      return
    }

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      // 데스크톱이라도 팝업이 차단되면 리다이렉트로 넘어간다.
      const code = e?.code ?? ''
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      throw e
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  async function refreshCommunities() {
    if (!user) return
    const comms = await fetchUserCommunities(user.uid)
    setCommunities(comms)
  }

  return (
    <AuthContext.Provider
      value={{ user, communities, loading, signInWithGoogle, signOut, refreshCommunities }}
    >
      {children}
    </AuthContext.Provider>
  )
}
