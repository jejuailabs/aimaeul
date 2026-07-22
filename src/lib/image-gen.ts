/**
 * 마을 배너·마스코트 AI 생성.
 *
 * OpenAI 이미지 생성 API를 쓴다(.env.local의 OPENAI_* 설정).
 * 모델·품질은 환경변수로 바꿀 수 있다.
 */

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations'

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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      needsSetup: true,
      error: 'AI 그림 생성 키가 설정되지 않았어요. OPENAI_API_KEY를 추가해주세요.',
    }
  }

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
  const quality = process.env.OPENAI_IMAGE_QUALITY || 'medium'
  // 배너는 가로로 넓게, 마스코트는 정사각으로.
  const size = kind === 'banner' ? '1536x1024' : '1024x1024'

  try {
    const res = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(kind, community, userPrompt),
        size,
        quality,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[image-gen] OpenAI 오류:', res.status, text.slice(0, 300))

      if (res.status === 401) {
        return {
          ok: false,
          needsSetup: true,
          error: 'AI 그림 생성 키가 올바르지 않아요. OPENAI_API_KEY를 확인해주세요.',
        }
      }
      if (res.status === 429) {
        return { ok: false, error: 'AI 그림 생성 요청이 많아요. 잠시 후 다시 시도해주세요.' }
      }
      // 조직 미인증 등으로 gpt-image 계열이 막힌 경우
      if (text.includes('must be verified') || text.includes('not have access')) {
        return {
          ok: false,
          needsSetup: true,
          error:
            'AI 그림 생성 모델에 접근 권한이 없어요. OpenAI 계정에서 조직 인증이 필요할 수 있어요.',
        }
      }
      return { ok: false, error: 'AI 그림을 만들지 못했어요. 잠시 후 다시 시도해주세요.' }
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return { ok: false, error: 'AI가 그림을 만들지 못했어요. 설명을 바꿔 다시 시도해보세요.' }
    }

    return { ok: true, buffer: Buffer.from(b64, 'base64') }
  } catch (e) {
    console.error('[image-gen] 실패:', e)
    return { ok: false, error: 'AI 그림 생성 중 오류가 발생했어요.' }
  }
}
