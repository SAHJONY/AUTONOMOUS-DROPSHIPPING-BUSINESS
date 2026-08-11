export const DEFAULT_SUPPLIER_MARKUP_PERCENT = 35;

export function calculateSupplierRetailPrice(input: {
  wholesalePrice: number;
  shippingCost?: number;
  handlingCost?: number;
  markupPercent?: number;
}) {
  const wholesale = Math.max(0, Number(input.wholesalePrice) || 0);
  const shipping = Math.max(0, Number(input.shippingCost) || 0);
  const handling = Math.max(0, Number(input.handlingCost) || 0);
  const markup = Math.max(0, Number(input.markupPercent ?? DEFAULT_SUPPLIER_MARKUP_PERCENT) || 0);
  return Math.round((wholesale * (1 + markup / 100) + shipping + handling) * 100) / 100;
}
