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
