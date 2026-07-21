'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

/**
 * authDomain은 반드시 Firebase가 발급한 도메인을 쓴다.
 *
 * 앱 도메인(aimaeul.vercel.app)으로 바꾸면 Google OAuth에 전달되는
 * redirect_uri가 https://aimaeul.vercel.app/__/auth/handler 가 되는데,
 * OAuth 클라이언트에는 firebaseapp.com 핸들러만 등록되어 있어
 * "400 redirect_uri_mismatch"로 로그인이 완전히 막힌다.
 *
 * 대신 로그인은 팝업 방식을 우선 사용한다(auth-context 참고).
 * 팝업은 서드파티 저장소에 의존하지 않아 모바일에서도 안전하다.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
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
