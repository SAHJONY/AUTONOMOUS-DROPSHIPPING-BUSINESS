/**
 * Higgsfield connector — generates cinematic product imagery (and video) from
 * a text prompt. Auth and base URL are configurable via env because Higgsfield
 * exposes more than one API surface; defaults target the official platform.
 *
 *   Auth:  Authorization: Key KEY_ID:KEY_SECRET   (single-token accounts: leave
 *          key_id blank and it's sent as a Bearer token)
 */
const BASE = process.env.HIGGSFIELD_API_URL ?? "https://platform.higgsfield.ai";
const T2I_PATH = process.env.HIGGSFIELD_T2I_PATH ?? "/v1/text2image/soul";

export interface HiggsfieldCreds {
  key_id: string;
  key_secret: string;
  connected_at: string;
}

function authValue(c: HiggsfieldCreds): string {
  return c.key_id ? `Key ${c.key_id}:${c.key_secret}` : `Bearer ${c.key_secret}`;
}

async function hf(c: HiggsfieldCreds, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authValue(c),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Pull an image/video URL out of any of Higgsfield's common response shapes. */
function extractUrl(o: unknown): string | undefined {
  const d = o as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return undefined;
  const anyD = d as any;
  return (
    anyD.images?.[0]?.url ??
    anyD.results?.[0]?.url ??
    anyD.output?.url ??
    (typeof anyD.output === "string" ? anyD.output : undefined) ??
    anyD.result?.url ??
    anyD.image?.url ??
    anyD.url ??
    anyD.data?.[0]?.url ??
    undefined
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ultra-premium art direction — the "design skill" applied to generation.
 * Produces a cinematic, Tesla-grade commercial product shot.
 */
export function cinematicPrompt(title: string, description?: string): string {
  const detail = description ? `${description.slice(0, 160)}. ` : "";
  return (
    `Ultra-premium cinematic product photograph of ${title}. ${detail}` +
    `Hero centered composition, dramatic rim lighting and soft key light, deep matte-black studio ` +
    `background with subtle volumetric haze, glossy reflections on a dark surface, shallow depth of ` +
    `field, hyper-detailed textures, 8k commercial advertising photography, minimalist luxury ` +
    `Tesla-grade aesthetic, elegant and aspirational.`
  );
}

export async function generateImage(
  c: HiggsfieldCreds,
  prompt: string,
  aspect = "3:4",
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const submit = await hf(c, T2I_PATH, {
      method: "POST",
      body: JSON.stringify({
        params: { prompt, aspect_ratio: aspect, enhance_prompt: true, quality: "1080p" },
        input: { prompt, aspect_ratio: aspect },
      }),
    });
    if (!submit.ok) {
      const t = await submit.text();
      return { ok: false, error: `Higgsfield ${submit.status}: ${t.slice(0, 160)}` };
    }
    const first = await submit.json().catch(() => ({}));
    const immediate = extractUrl(first);
    if (immediate) return { ok: true, url: immediate };

    const anyFirst = first as any;
    const id = anyFirst.request_id ?? anyFirst.id ?? anyFirst.generation_id;
    if (!id) return { ok: false, error: "Higgsfield returned no request id." };

    for (let i = 0; i < 14; i++) {
      await sleep(3000);
      const st = await hf(c, `/requests/${id}/status`, { method: "GET" });
      if (!st.ok) continue;
      const d = await st.json().catch(() => ({}));
      const url = extractUrl(d);
      if (url) return { ok: true, url };
      const status = (d as any).status;
      if (status === "failed" || status === "nsfw") return { ok: false, error: `Higgsfield ${status}` };
    }
    return { ok: false, error: "Higgsfield generation timed out." };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
