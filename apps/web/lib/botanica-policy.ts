export const BOTANICA_PRODUCT_ANCHORS = [
  "botanica",
  "botánica",
  "ochosi",
  "orisha",
  "santeria",
  "santería",
  "lukumi",
  "lucumi",
  "lucumí",
  "ifa",
  "ifá",
  "eleke",
  "cascarilla",
  "spiritual religious",
  "religious supply",
] as const;

export const BOTANICA_SOURCING_QUERIES = [
  "santeria religious candle",
  "orisha religious statue",
  "lukumi eleke necklace",
  "cascarilla spiritual religious",
  "santeria incense religious",
  "orisha devotional candle",
  "lukumi religious supplies",
  "santeria spiritual bath religious",
] as const;

export const BOTANICA_AGENT_DIRECTIVE = `BOTANICA OCHOSI DOMAIN POLICY:\n- You operate only for BOTANICA OCHOSI, a Cuban Botanica ecommerce business. Do not source, recommend, save, publish, advertise, or optimize unrelated generic dropshipping products.\n- Product discovery must be explicitly relevant to Botanica/Lucumi/Orisha/Santeria religious merchandise or directly supporting store operations. Gadgets, generic beauty, pet, fashion, home-tech, fitness, and unrelated impulse products are out of scope.\n- Never present religious claims as universal doctrine. Distinguish commerce facts from cultural/religious context and avoid claiming priestly authority.\n- Never invent supplier availability, inventory, price, margin, ritual meaning, or cultural provenance. Use connected data and label uncertainty.\n- Preserve owner approval for high-risk actions and fail closed when catalog or supplier relevance cannot be established.`;

export function botanicaRelevantText(value: string): boolean {
  const text = value.toLowerCase();
  return BOTANICA_PRODUCT_ANCHORS.some((term) => text.includes(term));
}

export function assertBotanicaSourcingQuery(query: string): { ok: true } | { ok: false; error: string } {
  if (!botanicaRelevantText(query)) {
    return {
      ok: false,
      error:
        "BOTANICA OCHOSI sourcing is fail-closed. Queries must explicitly target Botanica/Lucumi/Orisha/Santeria religious merchandise; generic dropshipping categories are blocked.",
    };
  }
  return { ok: true };
}
