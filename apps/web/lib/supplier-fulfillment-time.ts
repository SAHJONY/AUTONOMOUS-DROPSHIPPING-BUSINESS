export type SupplierFulfillmentTime = {
  supplierProcessingDays?: number;
  importTransitDays?: number;
  handlingDays?: number;
  customerShippingDays?: number;
};

const days = (value?: number) => Math.max(0, Math.ceil(Number(value) || 0));

export function calculateSupplierFulfillmentDays(input: SupplierFulfillmentTime) {
  return days(input.supplierProcessingDays) + days(input.importTransitDays) + days(input.handlingDays) + days(input.customerShippingDays);
}

export function calculateEstimatedDeliveryDate(input: SupplierFulfillmentTime, from = new Date()) {
  const result = new Date(from);
  result.setDate(result.getDate() + calculateSupplierFulfillmentDays(input));
  return result;
}
