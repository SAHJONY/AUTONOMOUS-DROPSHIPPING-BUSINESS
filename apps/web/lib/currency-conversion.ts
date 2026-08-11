export function convertToUsd(amount: number, currency: string, usdPerUnit?: number) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (currency.trim().toUpperCase() === "USD") return Math.round(safeAmount * 100) / 100;
  const rate = Math.max(0, Number(usdPerUnit) || 0);
  return Math.round(safeAmount * rate * 100) / 100;
}
