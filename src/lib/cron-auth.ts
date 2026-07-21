import { NextResponse } from 'next/server'

/**
 * 크론 엔드포인트 인증.
 *
 * 이 주소들은 Claude API를 호출해 실제 비용을 발생시키므로,
 * 인증이 확인되지 않으면 무조건 막는다(fail closed).
 *
 * Vercel Cron은 CRON_SECRET 환경변수가 설정돼 있으면
 * `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 호출한다.
 *
 * @returns 차단해야 하면 응답, 통과면 null
 */
export function verifyCronRequest(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // 개발 중에는 로컬에서 직접 호출해 볼 수 있게 열어둔다.
    if (process.env.NODE_ENV !== 'production') return null

    console.error(
      '[cron] CRON_SECRET이 설정되지 않아 요청을 거부했습니다. ' +
        'Vercel 환경변수에 CRON_SECRET을 추가해야 자동 생성이 동작합니다.'
    )
    return NextResponse.json(
      { error: 'CRON_SECRET이 설정되지 않았습니다.' },
      { status: 503 }
    )
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
