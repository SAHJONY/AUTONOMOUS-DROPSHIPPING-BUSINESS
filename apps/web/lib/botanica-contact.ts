const GMAIL_ACCOUNT = "botanicaochosi";

function department(address: string) {
  return `${GMAIL_ACCOUNT}+${address}@gmail.com`;
}

/** Branded department routes delivered by Gmail to one owner-controlled inbox. */
export const BOTANICA_CONTACT_EMAILS = {
  general: department("contacto"),
  orders: department("pedidos"),
  support: department("soporte"),
  privacy: department("privacidad"),
  wholesale: department("mayoristas"),
  suppliers: department("proveedores"),
} as const;
