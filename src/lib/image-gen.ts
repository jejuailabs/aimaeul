import { GoogleAuth } from 'google-auth-library'

/**
 * 마을 배너·마스코트 AI 생성.
 *
 * 이미 쓰고 있는 Firebase 서비스 계정으로 Vertex AI Imagen을 호출한다.
 * 새 API 키를 발급받을 필요가 없다.
 *
 * 단, Google Cloud 콘솔에서 Vertex AI API(aiplatform.googleapis.com)를
 * 켜고 결제를 연결해야 동작한다. 꺼져 있으면 403이 오므로,
 * 사용자에게 무엇을 해야 하는지 그대로 알려준다.
 */

const LOCATION = 'us-central1'
const MODEL = 'imagen-3.0-fast-generate-001'

export type ImageKind = 'banner' | 'mascot'

export type GenerateResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; needsSetup?: boolean }

function buildPrompt(
  kind: ImageKind,
  community: { name: string; communityType: string; regionName: string },
  userPrompt?: string
) {
  const place = `${community.regionName} ${community.name}`
  if (userPrompt?.trim()) {
    return kind === 'banner'
      ? `${userPrompt.trim()}. Warm, inviting illustration for a Korean rural village community banner. No text, no letters.`
      : `${userPrompt.trim()}. Cute friendly mascot character, simple flat illustration, centered on plain background. No text, no letters.`
  }

  if (kind === 'banner') {
    return (
      `A warm, peaceful illustration of a Korean rural village landscape representing ${place}. ` +
      `Soft daylight, fields and traditional village houses, gentle colors. ` +
      `Wide banner composition. No text, no letters, no watermark.`
    )
  }

  // 공동체 성격에 맞는 마스코트
  const character: Record<string, string> = {
    부녀회: 'a friendly smiling Korean grandmother character wearing an apron',
    청년회: 'a cheerful young Korean farmer character with a straw hat',
    노인회: 'a kind elderly Korean man character with a warm smile',
    동호회: 'a cheerful cartoon character holding a small flag',
  }
  const base = character[community.communityType] ?? 'a friendly village character'
  return (
    `Cute mascot character for a Korean village community: ${base}. ` +
    `Simple flat vector illustration, rounded shapes, warm yellow accent color, ` +
    `centered on a plain light background, full body. No text, no letters, no watermark.`
  )
}

export async function generateCommunityImage(
  kind: ImageKind,
  community: { name: string; communityType: string; regionName: string },
  userPrompt?: string
): Promise<GenerateResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    return { ok: false, error: '서버 설정이 완료되지 않았어요.' }
  }

  try {
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      projectId,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()

    const url =
      `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
      `/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: buildPrompt(kind, community, userPrompt) }],
        parameters: {
          sampleCount: 1,
          aspectRatio: kind === 'banner' ? '16:9' : '1:1',
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[image-gen] Vertex AI 오류:', res.status, text.slice(0, 300))

      if (res.status === 403 && text.includes('has not been used in project')) {
        return {
          ok: false,
          needsSetup: true,
          error:
            'AI 그림 생성이 아직 켜져 있지 않아요. Google Cloud 콘솔에서 Vertex AI API를 켜면 바로 쓸 수 있어요.',
        }
      }
      return { ok: false, error: 'AI 그림을 만들지 못했어요. 잠시 후 다시 시도해주세요.' }
    }

    const data = await res.json()
    const b64 = data.predictions?.[0]?.bytesBase64Encoded
    if (!b64) {
      return { ok: false, error: 'AI가 그림을 만들지 못했어요. 설명을 바꿔 다시 시도해보세요.' }
    }

    return { ok: true, buffer: Buffer.from(b64, 'base64') }
  } catch (e) {
    console.error('[image-gen] 실패:', e)
    return { ok: false, error: 'AI 그림 생성 중 오류가 발생했어요.' }
  }
}
