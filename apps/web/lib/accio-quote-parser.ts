/**
 * Read a quote out of whatever Accio actually wrote.
 *
 * Accio answers in prose and markdown tables — "$2.33–3.50", "MOQ 10",
 * "$25–35 (Air)", "7–15 Days", "Sample: FREE". Retyping fifteen of those into a
 * form is where sourcing actually stalls, so this pulls the numbers out.
 *
 * Two rules keep it honest:
 *
 *  - **Ranges collapse to the expensive end.** A quote that only works at the
 *    optimistic end of a range does not work. Every collapse is reported as a
 *    warning so the owner can see what was assumed.
 *  - **It never fills a verification field.** Inventory status, resale
 *    authorization and the owner's own attestation are judgements, not data to
 *    scrape. Parsing a quote gets you the economics; the owner still verifies.
 *
 * Anything it cannot find with confidence is left alone rather than guessed.
 */
import type { AccioCandidate } from "./accio-sourcing";

export interface ParsedQuote {
  fields: Partial<AccioCandidate>;
  found: string[];
  warnings: string[];
}

/** Money in a line, tolerating $, commas, en-dashes and "~". */
const MONEY = /\$?\s*(\d[\d,]*(?:\.\d+)?)/g;
const RANGE = /(\d[\d,]*(?:\.\d+)?)\s*[–—\-]\s*(\d[\d,]*(?:\.\d+)?)/;

const num = (raw: string) => Number(String(raw).replace(/,/g, "")) || 0;

/** Every number on the line, in order. */
function numbers(line: string): number[] {
  const out: number[] = [];
  for (const match of line.matchAll(MONEY)) out.push(num(match[1]));
  return out;
}

/**
 * The value a line is quoting, taking the top of any range.
 * Returns null when the line has no number at all.
 */
function valueOf(line: string, label: string, warnings: string[]): number | null {
  const range = line.match(RANGE);
  if (range) {
    const high = Math.max(num(range[1]), num(range[2]));
    warnings.push(`${label}: rango ${range[1]}–${range[2]} interpretado como ${high} (el extremo caro).`);
    return high;
  }
  const all = numbers(line);
  return all.length > 0 ? all[0] : null;
}

const has = (line: string, ...terms: string[]) => terms.some((term) => line.includes(term));

export function parseAccioQuote(text: string): ParsedQuote {
  const fields: Partial<AccioCandidate> = {};
  const found: string[] = [];
  const warnings: string[] = [];
  const raw = String(text ?? "");
  if (!raw.trim()) return { fields, found, warnings };

  // Split on newlines *and* table pipes, so a markdown row becomes cells.
  const lines = raw.split(/\n|\|/).map((line) => line.trim()).filter(Boolean);

  const url = raw.match(/https?:\/\/[^\s)>\]]+/);
  if (url) { fields.supplierProfileUrl = url[0]; found.push("supplierProfileUrl"); }

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (fields.moq === undefined && has(lower, "moq", "minimum order", "pedido mínimo", "pedido minimo")) {
      const value = valueOf(line, "MOQ", warnings);
      if (value !== null && value > 0) { fields.moq = Math.max(1, Math.ceil(value)); found.push("moq"); }
      continue;
    }

    if (fields.shippingCost === undefined && has(lower, "ship", "freight", "envío", "envio", "flete")) {
      const value = valueOf(line, "Flete", warnings);
      if (value !== null) {
        fields.shippingCost = value;
        found.push("shippingCost");
        // Only an explicit statement changes the basis — "Ocean" or "Air" says
        // how it travels, not how it was priced.
        if (has(lower, "per shipment", "whole shipment", "total shipment", "por embarque", "embarque completo")) {
          fields.freightMode = "PER_SHIPMENT";
          found.push("freightMode");
        }
      }
      continue;
    }

    if (fields.samplePriceUsd === undefined && has(lower, "sample", "muestra")) {
      if (has(lower, "free", "gratis", "sin costo")) {
        fields.samplePriceUsd = 0; fields.sampleOrderAvailable = true; found.push("sample");
      } else {
        const value = valueOf(line, "Muestra", warnings);
        if (value !== null) { fields.samplePriceUsd = value; fields.sampleOrderAvailable = value >= 0; found.push("sample"); }
        else if (has(lower, "available", "disponible", "inquiry", "consulta")) { fields.sampleOrderAvailable = true; found.push("sample"); }
      }
      continue;
    }

    if (fields.supplierProcessingDays === undefined && has(lower, "day", "día", "dia", "lead time", "plazo")) {
      const value = valueOf(line, "Plazo", warnings);
      if (value !== null && value > 0) { fields.supplierProcessingDays = Math.ceil(value); found.push("leadTimeDays"); }
      continue;
    }

    if (fields.wholesalePrice === undefined && has(lower, "price", "precio", "unit cost", "costo unitario", "$")) {
      const value = valueOf(line, "Precio unitario", warnings);
      if (value !== null && value > 0) { fields.wholesalePrice = value; found.push("wholesalePrice"); }
    }
  }

  if (/\bEUR\b|€/.test(raw)) { fields.currency = "EUR"; found.push("currency"); }
  else if (/\bCNY\b|\bRMB\b|¥/.test(raw)) { fields.currency = "CNY"; found.push("currency"); }
  else if (/\bNGN\b|₦/.test(raw)) { fields.currency = "NGN"; found.push("currency"); }
  else if (/\bUSD\b|\$/.test(raw)) { fields.currency = "USD"; fields.usdExchangeRate = 1; found.push("currency"); }

  if (fields.currency && fields.currency !== "USD") {
    warnings.push(`Moneda ${fields.currency}: falta el tipo de cambio verificado a USD.`);
  }
  if (fields.wholesalePrice !== undefined && fields.shippingCost !== undefined && fields.shippingCost > fields.wholesalePrice * 2) {
    warnings.push("El flete supera el doble del precio unitario. Pide cotización marítima o consolidada antes de decidir.");
  }
  if (fields.supplierProcessingDays !== undefined && fields.supplierProcessingDays > 25) {
    warnings.push(`Producción de ${fields.supplierProcessingDays} días: con manejo y envío al cliente probablemente supere el límite de 30 días.`);
  }

  return { fields, found, warnings };
}
