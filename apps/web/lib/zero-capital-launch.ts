import { calculateSupplierDealIntelligence, type SupplierDealInput } from "./supplier-deal-intelligence";

export const ZERO_CAPITAL_DEFAULTS = { paymentPercent: 3.5, paymentFixedUsd: 0.3, taxHoldPercent: 10, refundHoldPercent: 5, maximumDeliveryDays: 30, maximumSupplierCommitmentUsd: 100 } as const;

export type ZeroCapitalCandidate = SupplierDealInput & { inventoryStatus?: string; inventoryVerifiedAt?: string; resaleAuthorizationStatus?: string; authorizationReference?: string };
const money = (value: number) => Math.round(value * 100) / 100;

/** Conservative order-funded launch gate; advisory and never publishes or spends. */
export function assessZeroCapitalCandidate(input: ZeroCapitalCandidate) {
  const deal = calculateSupplierDealIntelligence(input);
  const paymentFeesUsd = money(deal.retailPriceUsd * ZERO_CAPITAL_DEFAULTS.paymentPercent / 100 + ZERO_CAPITAL_DEFAULTS.paymentFixedUsd);
  const taxHoldUsd = money(deal.retailPriceUsd * ZERO_CAPITAL_DEFAULTS.taxHoldPercent / 100);
  const refundHoldUsd = money(deal.retailPriceUsd * ZERO_CAPITAL_DEFAULTS.refundHoldPercent / 100);
  const availableForPurchaseUsd = money(deal.retailPriceUsd - paymentFeesUsd - taxHoldUsd - refundHoldUsd);
  const cashAfterPurchaseUsd = money(availableForPurchaseUsd - deal.supplierMinimumInvestmentUsd);
  const blockers: string[] = [];
  if (!deal.fxReady || deal.landedUnitCostUsd <= 0) blockers.push("Costo puesto en almacén o conversión USD sin verificar.");
  if (deal.supplierOrderQuantity !== 1) blockers.push(`El MOQ del proveedor exige comprar ${deal.supplierOrderQuantity} unidades antes de una sola venta.`);
  if (deal.supplierMinimumInvestmentUsd > ZERO_CAPITAL_DEFAULTS.maximumSupplierCommitmentUsd) blockers.push(`La compra al proveedor excede el límite operativo de $${ZERO_CAPITAL_DEFAULTS.maximumSupplierCommitmentUsd.toFixed(2)} por pedido.`);
  if (input.inventoryStatus !== "IN_STOCK" || !String(input.inventoryVerifiedAt ?? "").trim()) blockers.push("Inventario actual sin verificación fechada.");
  if (input.resaleAuthorizationStatus !== "VERIFIED" || !String(input.authorizationReference ?? "").trim()) blockers.push("Autorización de reventa sin evidencia verificada.");
  if (deal.totalDays <= 0 || deal.totalDays > ZERO_CAPITAL_DEFAULTS.maximumDeliveryDays) blockers.push("El plazo total no está confirmado dentro de 30 días.");
  if (cashAfterPurchaseUsd < 0) blockers.push(`El cobro deja un déficit de $${Math.abs(cashAfterPurchaseUsd).toFixed(2)} después de costos y reservas.`);
  return { eligible: blockers.length === 0, blockers, retailPriceUsd: deal.retailPriceUsd, supplierMinimumInvestmentUsd: deal.supplierMinimumInvestmentUsd, paymentFeesUsd, taxHoldUsd, refundHoldUsd, availableForPurchaseUsd, cashAfterPurchaseUsd, totalDays: deal.totalDays };
}

export const ZERO_CAPITAL_CUSTOMER_NOTICE_ES = "PREVENTA: este artículo se solicita al proveedor después de confirmar tu pago. La fecha estimada de envío se mostrará antes de pagar. Si surge una demora, podrás aceptar la nueva fecha o cancelar y recibir el reembolso completo conforme corresponda.";
export const ZERO_CAPITAL_OWNER_RULES = [
  "Cobrar el pedido completo antes de emitir la orden al proveedor.",
  "Separar la retención fiscal y la reserva de reembolso; no tratarlas como ganancia.",
  "Comprar solamente después de verificar inventario, costo, autorización y fecha de envío.",
  "No aceptar un pedido cuyo cobro neto no cubra el MOQ completo y todos los costos.",
  "No comprometer más de $100 en una sola orden de proveedor; cualquier importe superior requiere revisión y aprobación del propietario.",
  "Ante una demora, obtener consentimiento para la nueva fecha o emitir el reembolso completo.",
  "Reinvertir la utilidad disponible; no usar fondos comprometidos de otros pedidos."
] as const;
