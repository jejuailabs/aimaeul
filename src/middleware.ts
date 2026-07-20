export { default } from 'next-auth/middleware'

export const config = {
  // Protect member-only routes. Public routes (/, /village/*, /login, /onboarding, /api/v1/*)
  // are intentionally NOT protected so guests and crawlers can read public villages.
  matcher: ['/app/:path*'],
}
