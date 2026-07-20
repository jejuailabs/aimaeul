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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || '익명',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        }
        setUser(authUser)

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
          const comms = await fetchUserCommunities(firebaseUser.uid)
          setCommunities(comms)
          const savedTheme = userSnap.data().themePreference
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
      await signInWithRedirect(auth, googleProvider)
    } else {
      await signInWithPopup(auth, googleProvider)
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
