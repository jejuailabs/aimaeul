'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

/**
 * 인증 도메인을 앱과 같은 출처로 맞춘다.
 *
 * 기본값(<project>.firebaseapp.com)은 앱 도메인과 출처가 달라서,
 * signInWithRedirect가 남기는 인증 상태가 서드파티 저장소에 저장된다.
 * 모바일 브라우저(Safari ITP, Chrome 서드파티 쿠키 차단)는 이를 막거나
 * 분리하므로 돌아왔을 때 자격증명을 읽지 못하고 다시 로그인 화면이 뜬다.
 *
 * next.config.ts의 /__/auth/** 리라이트가 실제 핸들러를 Firebase로
 * 프록시하므로, 같은 출처를 쓰면서도 정상 동작한다.
 */
function resolveAuthDomain() {
  if (typeof window !== 'undefined') return window.location.host
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const firestore = getFirestore(app)
export const storage = getStorage(app)
export default app
