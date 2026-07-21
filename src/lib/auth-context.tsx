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
        // 서버 세션 쿠키를 setUser보다 "먼저" 만든다.
        //
        // 로그인 화면은 user가 생기는 즉시 /app/chat으로 이동시키는데,
        // 그때 __session 쿠키가 없으면 미들웨어가 /login으로 되돌려
        // 로그인 → 튕김 → 로그인이 반복된다.
        // 쿠키를 먼저 세운 뒤에 사용자 상태를 노출해야 이 경쟁이 사라진다.
        try {
          const idToken = await firebaseUser.getIdToken()
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          })
          if (!res.ok) {
            console.error('[auth] 세션 쿠키 생성 실패:', res.status)
          }
        } catch (e) {
          console.error('[auth] 세션 쿠키 요청 오류:', e)
        }

        // 역할은 users 문서에만 있으므로, 우선 기본값으로 노출한 뒤 조회 결과로 갱신한다.
        setUser({ ...baseUser, role: 'user', adminCommunities: [] })

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

  /**
   * 모바일에서도 팝업을 먼저 쓴다.
   *
   * 리다이렉트 방식은 브라우저의 서드파티 저장소 정책에 취약해
   * 모바일에서 "로그인했는데 다시 로그인 화면"이 반복되는 원인이 됐다.
   * 팝업은 사용자 제스처에서 열리면 모바일 브라우저에서도 잘 동작하고,
   * 인증 결과를 postMessage로 받으므로 저장소 차단의 영향을 받지 않는다.
   * 팝업이 정말 불가능한 환경에서만 리다이렉트로 내려간다.
   */
  async function signInWithGoogle() {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      const code = e?.code ?? ''
      // 사용자가 직접 닫은 경우는 실패로 취급하지 않는다.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/user-cancelled') {
        throw e
      }
      console.warn('[auth] 팝업 로그인 실패, 리다이렉트로 전환:', code)
      await signInWithRedirect(auth, googleProvider)
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
