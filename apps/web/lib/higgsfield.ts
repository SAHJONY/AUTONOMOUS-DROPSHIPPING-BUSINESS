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

/**
 * Request-shape variants across Higgsfield's known API surfaces. We try each in
 * order and use whichever one the account accepts (auto-detect), so it works
 * without hard-coding one endpoint. Env overrides (HIGGSFIELD_API_URL/T2I_PATH)
 * are tried first.
 */
interface Variant {
  base: string;
  path: string;
  auth: "key" | "bearer";
  body: (prompt: string, aspect: string) => unknown;
  statusPath: (id: string) => string;
}

function buildVariants(): Variant[] {
  const keyBody = (prompt: string) => ({
    params: {
      prompt,
      width_and_height: "1536x2048",
      quality: "1080p",
      batch_size: 1,
      enhance_prompt: true,
    },
  });
  const inputBody = (prompt: string, aspect: string) => ({ input: { prompt, aspect_ratio: aspect } });
  const genBody = (prompt: string) => ({
    task: "text-to-image",
    model: "soul",
    prompt,
    width: 1536,
    height: 2048,
  });
  const reqStatus = (id: string) => `/requests/${id}/status`;
  const genStatus = (id: string) => `/v1/generations/${id}`;

  const list: Variant[] = [];
  // Env-configured first, if set.
  if (process.env.HIGGSFIELD_API_URL || process.env.HIGGSFIELD_T2I_PATH) {
    list.push({ base: BASE, path: T2I_PATH, auth: "key", body: keyBody as never, statusPath: reqStatus });
    list.push({ base: BASE, path: T2I_PATH, auth: "key", body: inputBody, statusPath: reqStatus });
  }
  list.push(
    { base: "https://platform.higgsfield.ai", path: "/v1/text2image/soul", auth: "key", body: keyBody as never, statusPath: reqStatus },
    { base: "https://platform.higgsfield.ai", path: "/v1/text2image/soul", auth: "key", body: inputBody, statusPath: reqStatus },
    { base: "https://platform.higgsfield.ai", path: "/v1/image2image/soul", auth: "key", body: inputBody, statusPath: reqStatus },
    { base: "https://api.higgsfield.ai", path: "/v1/generations", auth: "bearer", body: genBody as never, statusPath: genStatus },
  );
  return list;
}

async function pollForUrl(
  base: string,
  authHeader: string,
  statusPath: (id: string) => string,
  id: string,
): Promise<string | undefined> {
  for (let i = 0; i < 12; i++) {
    await sleep(3000);
    const st = await fetch(`${base}${statusPath(id)}`, {
      headers: { Authorization: authHeader },
    });
    if (!st.ok) continue;
    const d = await st.json().catch(() => ({}));
    const url = extractUrl(d);
    if (url) return url;
    const status = (d as any).status;
    if (status === "failed" || status === "nsfw") return undefined;
  }
  return undefined;
}

export async function generateImage(
  c: HiggsfieldCreds,
  prompt: string,
  aspect = "3:4",
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const errors: string[] = [];
  for (const v of buildVariants()) {
    const authHeader = v.auth === "key" && c.key_id ? `Key ${c.key_id}:${c.key_secret}` : `Bearer ${c.key_secret}`;
    try {
      const res = await fetch(`${v.base}${v.path}`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(v.body(prompt, aspect)),
      });
      if (!res.ok) {
        const t = await res.text();
        errors.push(`${v.base}${v.path} → ${res.status}: ${t.slice(0, 100)}`);
        continue;
      }
      const first = await res.json().catch(() => ({}));
      const immediate = extractUrl(first);
      if (immediate) return { ok: true, url: immediate };
      const anyFirst = first as any;
      const id = anyFirst.request_id ?? anyFirst.id ?? anyFirst.generation_id;
      if (!id) {
        errors.push(`${v.base}${v.path} → 200 but no id/url`);
        continue;
      }
      const url = await pollForUrl(v.base, authHeader, v.statusPath, id);
      if (url) return { ok: true, url };
      errors.push(`${v.base}${v.path} → timed out/failed`);
    } catch (e) {
      errors.push(`${v.base}${v.path} → ${(e as Error).message}`);
    }
  }
  return { ok: false, error: `All Higgsfield endpoints failed. ${errors.join(" | ").slice(0, 400)}` };
}
