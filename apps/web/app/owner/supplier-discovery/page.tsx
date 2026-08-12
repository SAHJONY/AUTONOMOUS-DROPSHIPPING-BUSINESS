"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../owner.module.css";

type Candidate = { host: string; title?: string; url?: string; description?: string; tier?: string; score?: number; signals?: string[]; found_at?: string };
type Mcp = { configured: boolean; missing: string[]; path: string; tools: string[]; orgBinding?: "explicit" | "auto" };
type Snapshot = { provider: string; hunting_now?: string; daily_budget: number; budget_remaining_today: number; total: number; by_tier: Record<string, number>; candidates: Candidate[]; notice: string; mcp?: Mcp };
type RunResult = { provider: string; tier_hunted: string; queries_spent: number; budget_remaining_today: number; found: number; known_hosts_skipped: number; stopped?: string; assortment: { coverage_percent: number; p1_missing: number; total: number }; notice: string };

const TIERS = ["MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RESELLER"] as const;
const TIER_LABEL: Record<string, string> = {
  MANUFACTURER: "Fabricante", DISTRIBUTOR: "Distribuidor", WHOLESALER: "Mayorista", RESELLER: "Revendedor", UNKNOWN: "Sin clasificar",
};

const STOPPED_REASON: Record<string, string> = {
  no_provider: "No hay proveedor de búsqueda configurado. Conecta Accio Work por MCP o define una clave de búsqueda.",
  budget_spent: "Se agotó el presupuesto de búsquedas de hoy. Vuelve mañana o sube SUPPLIER_DISCOVERY_DAILY_BUDGET.",
  disabled: "La búsqueda automática está desactivada por configuración.",
};

export default function SupplierDiscoveryPage() {
  const [token, setToken] = useState(""), [orgId, setOrgId] = useState("");
  const [ready, setReady] = useState(false), [authorized, setAuthorized] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tier, setTier] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (authToken: string, organization: string, wanted: string) => {
    const query = wanted ? `?tier=${wanted}` : "";
    const response = await fetch(`/api/orgs/${organization}/supplier-discovery${query}`, { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Acceso Owner requerido." : "No se pudo abrir el registro de proveedores.");
    setSnapshot(await response.json() as Snapshot);
  }, []);

  useEffect(() => {
    const authToken = localStorage.getItem("commerce_os_token") ?? "";
    const organization = localStorage.getItem("commerce_os_org") ?? "";
    setToken(authToken); setOrgId(organization);
    if (!authToken || !organization) { setReady(true); return; }
    load(authToken, organization, "").then(() => setAuthorized(true)).catch((e: Error) => setMessage(e.message)).finally(() => setReady(true));
  }, [load]);

  /** The button. Runs the same sweep the autonomous tick runs, right now. */
  const findSuppliers = async () => {
    if (!token || !orgId || running) return;
    setRunning(true);
    setMessage("Buscando proveedores… esto consume presupuesto de búsqueda.");
    try {
      const response = await fetch(`/api/orgs/${orgId}/supplier-discovery`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as RunResult & { detail?: string };
      if (!response.ok) throw new Error(result.detail ?? "No se pudo ejecutar la búsqueda.");
      const stopped = result.stopped ? ` ${STOPPED_REASON[result.stopped] ?? ""}` : "";
      setMessage(
        `Búsqueda de ${TIER_LABEL[result.tier_hunted] ?? result.tier_hunted}: ${result.found} proveedores nuevos, ` +
        `${result.known_hosts_skipped} ya conocidos. Consultas usadas: ${result.queries_spent}. ` +
        `Presupuesto restante hoy: ${result.budget_remaining_today}. ` +
        `Cobertura de la cesta: ${result.assortment.coverage_percent}% (faltan ${result.assortment.p1_missing} SKU P1).${stopped}`,
      );
      await load(token, orgId, tier);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo ejecutar la búsqueda.");
    } finally {
      setRunning(false);
    }
  };

  const filterBy = async (wanted: string) => {
    setTier(wanted);
    if (token && orgId) await load(token, orgId, wanted).catch((e: Error) => setMessage(e.message));
  };

  if (!ready) return <main className={styles.shell}><div className={styles.content}><div className={styles.result}>Verificando acceso Owner…</div></div></main>;
  if (!authorized) return <main className={styles.shell}><div className={styles.content}><div className={styles.error}><strong>Acceso privado requerido.</strong><p>{message || "Inicia sesión como propietario."}</p><a className={styles.primary} href="/owner/login">Iniciar sesión</a></div></div></main>;

  const noProvider = snapshot?.provider === "none";
  const endpoint = typeof window === "undefined" ? "/api/mcp" : `${window.location.origin}${snapshot?.mcp?.path ?? "/api/mcp"}`;

  return <main className={styles.shell}>
    <nav className={styles.nav}><a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/accio-sourcing">Cotizaciones</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav>
    <div className={styles.content}>
      <section className={styles.hero}>
        <div className={styles.kicker}>BÚSQUEDA DE PROVEEDORES · OWNER</div>
        <h1>Encontrar <em>proveedores.</em></h1>
        <p>Ejecuta ahora el mismo barrido que corre solo cada media hora: calcula qué le falta al catálogo, busca fabricantes, distribuidores, mayoristas y revendedores para esos SKU, y archiva lo que encuentra. No compra nada ni contacta a nadie.</p>
      </section>

      <section className={styles.section}><div className={styles.card}>
        <button className={styles.primary} onClick={findSuppliers} disabled={running || noProvider}>
          {running ? "Buscando…" : "✦ Buscar proveedores ahora"}
        </button>
        <p className={styles.metricNote}>
          Presupuesto de búsquedas hoy: <strong>{snapshot?.budget_remaining_today ?? 0}</strong> de {snapshot?.daily_budget ?? 0}.
          {snapshot?.hunting_now && <> Turno actual: <strong>{TIER_LABEL[snapshot.hunting_now] ?? snapshot.hunting_now}</strong>.</>}
        </p>
        {noProvider && <div className={styles.error}>
          <strong>Sin proveedor de búsqueda.</strong>
          <p>La búsqueda automática está apagada. Conecta Accio Work por MCP (panel de abajo) para buscar desde tu escritorio sin costo por consulta, o define <code>BRAVE_SEARCH_API_KEY</code> para búsqueda automática de pago.</p>
        </div>}
      </div></section>

      <section className={styles.section}><div className={styles.card}>
        <h2>Accio Work por MCP</h2>
        <p>Accio Work busca desde tu escritorio y archiva aquí lo que encuentra, sin costo por consulta. Es la alternativa gratuita a una clave de búsqueda de pago.</p>
        {snapshot?.mcp?.configured
          ? <div className={styles.result}><strong>Servidor MCP activo.</strong> Añade esta dirección en Accio Work → MCP y usa el token que configuraste en Vercel.</div>
          : <div className={styles.error}><strong>Servidor MCP sin configurar.</strong> Falta una sola variable en Vercel: <code>{(snapshot?.mcp?.missing ?? ["MCP_ACCESS_TOKEN"]).join(", ")}</code>. Genérala con <code>./ops/generate-secrets.sh</code>, guárdala en Vercel y vuelve a desplegar.</div>}
        <p className={styles.metricNote}>Endpoint: <code>{endpoint}</code></p>
        <p className={styles.metricNote}>
          Organización: <code>{orgId || "—"}</code>{" "}
          {snapshot?.mcp?.orgBinding === "explicit"
            ? "(fijada con MCP_ORG_ID)"
            : "(detectada automáticamente; solo necesitas MCP_ORG_ID si algún día tienes más de una organización)"}
        </p>
        {snapshot?.mcp?.tools?.length ? <p className={styles.metricNote}>Herramientas expuestas: {snapshot.mcp.tools.join(", ")} — ninguna mueve dinero.</p> : null}
      </div></section>

      {message && <div className={styles.result}>{message}</div>}

      <section className={styles.metricGrid}>
        <article className={styles.card}><div className={styles.metricLabel}>Proveedores en registro</div><div className={styles.metricValue}>{snapshot?.total ?? 0}</div><div className={styles.metricNote}>sin verificar</div></article>
        {TIERS.map(t => <article key={t} className={styles.card}><div className={styles.metricLabel}>{TIER_LABEL[t]}</div><div className={styles.metricValue}>{snapshot?.by_tier?.[t] ?? 0}</div><div className={styles.metricNote}>candidatos</div></article>)}
      </section>

      <section className={styles.section}><div className={styles.card}>
        <div className={styles.navLinks}>
          <button className={tier === "" ? styles.primary : styles.ghost} onClick={() => filterBy("")}>Todos</button>
          {TIERS.map(t => <button key={t} className={tier === t ? styles.primary : styles.ghost} onClick={() => filterBy(t)}>{TIER_LABEL[t]}</button>)}
        </div>
      </div></section>

      <section className={styles.section}><div className={styles.card}>
        <h2>Candidatos</h2>
        {(snapshot?.candidates?.length ?? 0) === 0
          ? <p>Todavía no hay proveedores archivados para este filtro. Pulsa «Buscar proveedores ahora».</p>
          : <ul>{snapshot!.candidates.map(c => <li key={c.host}>
              <strong>{c.title || c.host}</strong> — {TIER_LABEL[String(c.tier ?? "UNKNOWN")]} · {c.score ?? 0}/100
              <br /><a href={c.url ?? `https://${c.host}`} target="_blank" rel="noreferrer noopener">{c.host}</a>
              {c.description && <><br /><small>{c.description}</small></>}
              {c.signals?.length ? <><br /><small>Señales: {c.signals.join(", ")}</small></> : null}
            </li>)}</ul>}
      </div></section>

      <div className={styles.error}>{snapshot?.notice}</div>
    </div>
  </main>;
}
