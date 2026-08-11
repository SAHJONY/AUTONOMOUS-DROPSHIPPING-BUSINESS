export type WholesaleBrandMode = "ORIGINAL_BRAND" | "AUTHORIZED_DISTRIBUTOR" | "PRIVATE_LABEL" | "GENERIC";
export type AuthorizationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export function wholesaleBrandReadiness(input: {
  botanicaWholesaleEnabled?: boolean;
  brandMode?: string;
  resaleAuthorizationStatus?: string;
  authorizationReference?: string;
}) {
  const blockers: string[] = [];
  const mode = input.brandMode as WholesaleBrandMode;
  if (!input.botanicaWholesaleEnabled) blockers.push("El mayoreo para botánicas está desactivado.");
  if (!mode) blockers.push("Falta definir el modelo de marca.");
  if (input.resaleAuthorizationStatus !== "VERIFIED") blockers.push("La autorización comercial todavía no está verificada.");
  if (!String(input.authorizationReference ?? "").trim()) blockers.push("Falta la referencia del contrato, carta o evidencia.");
  const mayPresentAsOwn = mode === "PRIVATE_LABEL" || mode === "GENERIC";
  if (!mayPresentAsOwn) blockers.push("Este modelo conserva la marca original; no puede presentarse como fabricación propia.");
  return { ready: blockers.length === 0, mayPresentAsOwn, blockers };
}
