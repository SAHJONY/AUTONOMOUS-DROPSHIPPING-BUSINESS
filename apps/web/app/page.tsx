"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Manual from "./components/Manual";
import Forecast, { type ForecastData } from "./components/Forecast";

const API = "/api";

type Dashboard = {
  products_total: number;
  products_by_status: Record<string, number>;
  runs_total: number;
  runs_by_status: Record<string, number>;
  pending_approvals: number;
  stores_total: number;
  total_tokens_used: number;
  memory_entries: number;
  revenue_estimate: number;
  engine: string;
  engine_online: boolean;
  autopilot: boolean;
  autonomy_pct: number;
};
type AgentInfo = { name: string; description: string; tools: string[]; high_risk_tools: string[] };
type AgentRun = {
  id: string; agent_name: string; task: string; status: string; output: string; error: string;
  simulated: boolean; created_at: string;
};
type Approval = {
  id: string; agent_name: string; action: string; payload: Record<string, unknown>;
  risk_level: string; status: string; result: string;
};
type MemoryEntry = { id: string; agent_name: string; key: string; content: string; created_at: string };
type Product = {
  id: string; title: string; description: string; status: string; source: string;
  supplier_url: string; cost: number; price: number; score?: number; verdict?: string;
  storefront_url?: string; created_at: string;
};
type ShopifyStatus = { connected: boolean; shop: string | null };
type StoreItem = { id: string; name: string; platform: string; url: string; status: string; created_at: string };
type Me = { id: string; email: string; is_owner: boolean };
type AdminOverview = {
  owner: string; orgs_total: number; users_total: number;
  totals: { products: number; runs: number; approvals: number; stores: number; tokens: number; revenue: number };
};

const FEATURES = [
  { icon: "◇", title: "Autonomous CEO", body: "The SAHJONY CEO reviews the business, coordinates seven specialists, and files a structured report — revenue, top products, next actions." },
  { icon: "◈", title: "Product Intelligence", body: "Every opportunity is scored deterministically — demand, competition, margin, trend, risk. Only 85+ reaches the launch queue." },
  { icon: "⬡", title: "Human Command", body: "Refunds, ad budgets, store creation, killing products — high-risk actions halt for your approval. Nothing irreversible happens without you." },
  { icon: "❖", title: "Total Recall", body: "Agents write every learning, quote, and report to business memory and recall it in future runs. The operation compounds." },
];

const ROSTER = [
  { name: "CEO", desc: "Coordinates the fleet, reviews the business, writes daily reports.", ceo: true },
  { name: "Product Hunter", desc: "Discovers and scores product opportunities. Only 85+ ships." },
  { name: "Supplier", desc: "Sources across CJ, AliExpress, Spocket, Zendrop; tracks landed cost." },
  { name: "Store Builder", desc: "Builds storefronts and writes high-converting listings." },
  { name: "Marketing", desc: "Designs ad angles, hooks, and creative briefs." },
  { name: "Advertising", desc: "Manages ad budgets and ROAS; budget changes need approval." },
  { name: "Finance", desc: "Computes unit economics and tracks profitability." },
  { name: "Support", desc: "Drafts empathetic replies; refunds need approval." },
];

const QUICK_TASKS: Record<string, string[]> = {
  ceo: [
    "Review the business and write today's report",
    "Audit the product pipeline and recommend the next launch",
    "Identify our biggest risk this week and a mitigation",
  ],
  product_hunter: [
    "Find and score 3 trending product opportunities",
    "Score a portable neck fan: demand 82, competition 60, margin 70, trend 88, risk 20",
  ],
  finance: [
    "Compute unit economics for price 39.99, cost 9.50, ad cost 8",
    "Build a 12-month financial forecast from our current catalog and unit economics",
  ],
  advertising: ["Propose a TikTok ad budget for our best product and explain the ROAS math"],
  support: ["Draft a reply to a customer whose order is 5 days late"],
};

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"hero" | "register" | "login">("hero");
  const [booting, setBooting] = useState(true);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [admin, setAdmin] = useState<AdminOverview | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("ceo");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [shopify, setShopify] = useState<ShopifyStatus>({ connected: false, shop: null });
  const [shopDomain, setShopDomain] = useState("");
  const [shopClientId, setShopClientId] = useState("");
  const [shopClientSecret, setShopClientSecret] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);

  const authed = token !== null && orgId !== null;

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Request failed (${res.status})`);
      }
      return res.json();
    },
    [token],
  );

  /* restore session */
  useEffect(() => {
    const saved = localStorage.getItem("commerce_os_token");
    if (saved) setToken(saved);
    setBooting(false);
  }, []);

  /* when token appears, resolve org + me */
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [orgs, meResp] = await Promise.all([
          fetch(`${API}/orgs`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        ]);
        setMe(meResp);
        setOrgId((prev) => prev ?? orgs[0]?.id ?? null);
      } catch {
        signOut();
      }
    })();
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token || !orgId) return;
    try {
      const [dash, agentList, runList, approvalList, mem, prods, strs, shop] = await Promise.all([
        api(`/orgs/${orgId}/dashboard`),
        api(`/agents`),
        api(`/orgs/${orgId}/runs`),
        api(`/orgs/${orgId}/approvals`),
        api(`/orgs/${orgId}/memory`),
        api(`/orgs/${orgId}/products`),
        api(`/orgs/${orgId}/stores`),
        api(`/orgs/${orgId}/integrations/shopify`),
      ]);
      setDashboard(dash);
      setAgents(agentList);
      setRuns(runList);
      setApprovals(approvalList);
      setMemory(mem);
      setProducts(prods);
      setStores(strs);
      setShopify(shop);
      if (me?.is_owner) {
        api(`/admin/overview`).then(setAdmin).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, token, orgId, me]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const mode = view === "register" ? "register" : "login";
    try {
      const body =
        mode === "register"
          ? { email, password, organization_name: (form.get("org") as string) || "My Business" }
          : { email, password };
      const res = await fetch(`${API}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Authentication failed");
      }
      const { access_token } = await res.json();
      localStorage.setItem("commerce_os_token", access_token);
      setToken(access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function signOut() {
    localStorage.removeItem("commerce_os_token");
    setToken(null);
    setOrgId(null);
    setMe(null);
    setDashboard(null);
    setRuns([]);
    setApprovals([]);
    setMemory([]);
    setProducts([]);
    setStores([]);
    setAdmin(null);
    setShowManual(false);
    setShowForecast(false);
    setForecast(null);
    setShopify({ connected: false, shop: null });
    setView("hero");
  }

  async function runAgent(overrideTask?: string) {
    const t = (overrideTask ?? task).trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      await api(`/orgs/${orgId}/agents/${selectedAgent}/run`, {
        method: "POST",
        body: JSON.stringify({ task: t }),
      });
      setTask("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function connectShopify() {
    if (!shopDomain.trim() || !shopClientId.trim() || !shopClientSecret.trim()) return;
    setError("");
    setBusy(true);
    try {
      await api(`/orgs/${orgId}/integrations/shopify`, {
        method: "POST",
        body: JSON.stringify({
          shop: shopDomain,
          client_id: shopClientId,
          client_secret: shopClientSecret,
        }),
      });
      setShopDomain("");
      setShopClientId("");
      setShopClientSecret("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnectShopify() {
    setError("");
    try {
      await api(`/orgs/${orgId}/integrations/shopify`, {
        method: "POST",
        body: JSON.stringify({ disconnect: true }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function publishProduct(productId: string) {
    setError("");
    setPublishing(productId);
    try {
      await api(`/orgs/${orgId}/products/${productId}/publish`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(null);
    }
  }

  async function saveStoreLink(storeId: string) {
    const url = (linkDraft[storeId] ?? "").trim();
    if (!url) return;
    setError("");
    try {
      await api(`/orgs/${orgId}/stores/${storeId}`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setLinkDraft((d) => {
        const next = { ...d };
        delete next[storeId];
        return next;
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function openForecast() {
    setError("");
    try {
      const data = await api(`/orgs/${orgId}/forecast`);
      setForecast(data);
      setShowManual(false);
      setShowForecast(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleAutopilot() {
    if (!dashboard) return;
    setError("");
    try {
      await api(`/orgs/${orgId}/settings`, {
        method: "POST",
        body: JSON.stringify({ autopilot: !dashboard.autopilot }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    setError("");
    try {
      await api(`/orgs/${orgId}/approvals/${approvalId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const pending = useMemo(() => approvals.filter((a) => a.status === "pending"), [approvals]);
  const currentAgent = agents.find((a) => a.name === selectedAgent);
  const quicks = QUICK_TASKS[selectedAgent] ?? [];

  if (booting) return <div style={{ minHeight: "100vh" }} />;

  /* ---------------- Signed out ---------------- */
  if (!authed) {
    if (view === "hero") {
      return (
        <>
          <nav className="nav">
            <div className="wordmark"><span className="dot" /> SAHJONY <span>Commerce</span></div>
            <div className="nav-right">
              <span className="hide-sm">sahjony.com</span>
              <button onClick={() => setView("login")}>Sign in</button>
            </div>
          </nav>

          <div className="hero">
            <div className="aurora" />
            <div className="hero-horizon" />
            <div className="eyebrow">The Autonomous Commerce Operator</div>
            <h1 className="display">Commerce, run by a <span className="gradient-text">mind</span>.</h1>
            <p className="lede">
              The SAHJONY autonomous CEO and seven specialists discover products, validate demand, and
              run your stores around the clock. You approve only what matters — from an ultra-premium command deck.
            </p>
            <div className="hero-ctas">
              <button className="btn btn-primary" onClick={() => setView("register")}>Start Operating</button>
              <button className="btn btn-ghost" onClick={() => setView("login")}>Sign In</button>
            </div>
            <div className="hero-badges">
              <span><b>7</b> Specialist agents</span>
              <span><b>85+</b> Launch score gate</span>
              <span><b>24/7</b> Autonomous cycle</span>
              <span><b>100%</b> Human-gated risk</span>
            </div>
          </div>

          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <div className="fi">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="roster">
            <h2>One brain. Eight hands.</h2>
            <p className="sub">The CEO agent orchestrates a fleet of specialists — each with real tools, real data, and hard guardrails on anything irreversible.</p>
            <div className="roster-grid">
              {ROSTER.map((r) => (
                <div className={`roster-card ${r.ceo ? "ceo" : ""}`} key={r.name}>
                  <div className="rc-name">{r.name}</div>
                  <div className="rc-desc">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="footer">SAHJONY Commerce — Autonomy with a human hand on the wheel · sahjony.com</div>
        </>
      );
    }

    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="eyebrow">SAHJONY Commerce</div>
          <h1>{view === "register" ? "Create your operation" : "Welcome back"}</h1>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleAuth}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" required autoFocus placeholder="you@company.com" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" minLength={8} required placeholder="At least 8 characters" />
            </div>
            {view === "register" && (
              <div className="field">
                <label htmlFor="org">Business name</label>
                <input id="org" name="org" placeholder="My Business" />
              </div>
            )}
            <button className="btn btn-accent" type="submit" style={{ width: "100%" }}>
              {view === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>
          <p className="owner-hint">
            Owner access is automatic for <code>sahjonycapitalllc@outlook.com</code> — full, unrestricted control of every operation.
          </p>
          <p className="auth-switch">
            {view === "register" ? (
              <>Already operating? <button onClick={() => setView("login")}>Sign in</button></>
            ) : (
              <>New here? <button onClick={() => setView("register")}>Create an account</button></>
            )}
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Signed in: command deck ---------------- */
  return (
    <>
      <nav className="nav">
        <div className="wordmark"><span className="dot" /> SAHJONY <span>Commerce</span></div>
        <div className="nav-right">
          {dashboard && (
            <span className={`pill-live ${dashboard.engine_online ? "" : "sim"}`}>
              <span className="live-dot" />
              {dashboard.engine_online ? "Engine · Online" : "Engine · Standby"}
            </span>
          )}
          <span className="hide-sm">{pending.length > 0 ? `${pending.length} approvals waiting` : "All clear"}</span>
          <button onClick={openForecast}>Forecast</button>
          <button onClick={() => { setShowManual((v) => !v); setShowForecast(false); }}>{showManual ? "Deck" : "Manual"}</button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </nav>

      {showManual && <Manual onBack={() => setShowManual(false)} />}
      {showForecast && forecast && <Forecast data={forecast} onBack={() => setShowForecast(false)} />}
      <main className="app" style={showManual || showForecast ? { display: "none" } : undefined}>
        {error && <p className="error">{error}</p>}

        <div className="welcome">
          <div className="eyebrow">Command Deck</div>
          <h1>Good day{me?.is_owner ? ", Owner" : ""}.</h1>
          <p>
            Your autonomous operation is {dashboard?.engine_online ? "online" : "on standby"}. Dispatch an agent,
            review pending decisions, and watch the fleet compound.
          </p>
        </div>

        {dashboard && (
          <div className={`auto-bar ${dashboard.autopilot ? "" : "off"}`}>
            <div className="ab-left">
              <div className="ab-pct">{dashboard.autonomy_pct}%</div>
              <div>
                <b>{dashboard.autopilot ? "Autopilot engaged — 98% autonomous" : "Manual mode"}</b>
                <p>
                  {dashboard.autopilot
                    ? "The engine runs the business around the clock and auto-approves routine actions within safe limits. Only large ad budgets or refunds reach you."
                    : "Every high-risk action waits for your approval. Engage Autopilot to run at 98% autonomy."}
                </p>
              </div>
            </div>
            <button
              className={`btn ${dashboard.autopilot ? "btn-ghost" : "btn-accent"} btn-small`}
              onClick={toggleAutopilot}
            >
              {dashboard.autopilot ? "Switch to Manual" : "Engage Autopilot"}
            </button>
          </div>
        )}

        {me?.is_owner && admin && (
          <div className="god-banner">
            <span className="crown">👑</span>
            <div>
              <b>Owner god-mode active — {admin.owner}</b>
              <p>
                Platform-wide: {admin.orgs_total} orgs · {admin.users_total} users · {admin.totals.products} products ·
                {" "}{admin.totals.runs} agent runs · {admin.totals.approvals} pending · {admin.totals.tokens.toLocaleString()} tokens.
                You have full, unrestricted access to every operation.
              </p>
            </div>
          </div>
        )}

        {dashboard && (
          <section>
            <div className="metrics">
              <div className="metric"><div className="value accent">${dashboard.revenue_estimate.toLocaleString()}</div><div className="label">Est. Margin Pool</div></div>
              <div className="metric"><div className="value">{dashboard.products_total}</div><div className="label">Products</div></div>
              <div className="metric"><div className="value">{dashboard.stores_total}</div><div className="label">Stores</div></div>
              <div className="metric"><div className="value">{dashboard.runs_total}</div><div className="label">Agent Runs</div></div>
              <div className="metric"><div className="value">{dashboard.pending_approvals}</div><div className="label">Approvals</div></div>
              <div className="metric"><div className="value">{dashboard.total_tokens_used.toLocaleString()}</div><div className="label">Tokens</div></div>
            </div>
          </section>
        )}

        <section>
          <div className="section-head"><h2>Command</h2><span className="hint">Dispatch an agent</span></div>
          <div className="console-wrap">
            <div className="console">
              <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>{a.name.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>
              <input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAgent()}
                placeholder="Review the business and write today's report"
              />
              <button className="btn btn-accent" onClick={() => runAgent()} disabled={busy || !task.trim()}>
                {busy ? <span className="spinner" /> : "Run"}
              </button>
            </div>
            {currentAgent && (
              <p className="agent-desc">
                {currentAgent.description}
                {currentAgent.high_risk_tools.length > 0 && (
                  <> Requires approval for: {currentAgent.high_risk_tools.join(", ")}.</>
                )}
              </p>
            )}
            {quicks.length > 0 && (
              <div className="quick-tasks">
                {quicks.map((q) => (
                  <button className="chip" key={q} onClick={() => runAgent(q)} disabled={busy}>{q}</button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>The Fleet</h2><span className="hint">Tap to select</span></div>
          <div className="agent-grid">
            {agents.map((a) => (
              <div
                key={a.name}
                className={`agent-tile ${a.name === selectedAgent ? "active" : ""}`}
                onClick={() => setSelectedAgent(a.name)}
              >
                <div className="at-name">{a.name.replace(/_/g, " ")}</div>
                <div className="at-desc">{a.description}</div>
                {a.high_risk_tools.length > 0 && <div className="at-risk">⚠ {a.high_risk_tools.length} gated action(s)</div>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>Approvals</h2><span className="hint">High-risk actions halt here</span></div>
          {pending.length === 0 ? (
            <div className="card"><p className="empty">Nothing awaiting your decision.</p></div>
          ) : (
            pending.map((a) => (
              <div className="approval" key={a.id}>
                <div className="approval-info">
                  <h4>{a.action.replace(/_/g, " ")} <span className={`status ${a.risk_level}`}>{a.risk_level} risk</span></h4>
                  <p>Requested by the {a.agent_name.replace(/_/g, " ")} agent — <code>{JSON.stringify(a.payload)}</code></p>
                </div>
                <div className="approval-actions">
                  <button className="btn btn-accent btn-small" onClick={() => decide(a.id, "approve")}>Approve</button>
                  <button className="btn btn-ghost btn-small" onClick={() => decide(a.id, "reject")}>Reject</button>
                </div>
              </div>
            ))
          )}
        </section>

        <section>
          <div className="section-head"><h2>Catalog</h2><span className="hint">{products.length} product(s) — click to view</span></div>
          <div className="card">
            {products.length === 0 ? (
              <p className="empty">No products yet. Ask the Product Hunter to find and score some.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Product</th><th>Status</th><th>Score</th><th>Cost</th><th>Price</th><th>Source</th><th>Storefront</th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td><span className={`status ${p.status}`}>{p.status.replace(/_/g, " ")}</span></td>
                      <td>{p.score ?? "—"}</td>
                      <td>${Number(p.cost).toFixed(2)}</td>
                      <td>${Number(p.price).toFixed(2)}</td>
                      <td>
                        {p.supplier_url ? (
                          <a className="link-a" href={p.supplier_url} target="_blank" rel="noreferrer">View →</a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {p.storefront_url ? (
                          <a className="link-a" href={p.storefront_url} target="_blank" rel="noreferrer">Live →</a>
                        ) : shopify.connected ? (
                          <button
                            className="btn btn-accent btn-small"
                            onClick={() => publishProduct(p.id)}
                            disabled={publishing === p.id}
                          >
                            {publishing === p.id ? <span className="spinner" /> : "Publish"}
                          </button>
                        ) : (
                          <span className="muted">connect Shopify</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Shopify Connection</h2>
            <span className="hint">{shopify.connected ? `Connected · ${shopify.shop}` : "Publish products live"}</span>
          </div>
          <div className="console-wrap">
            {shopify.connected ? (
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span className="pill-live"><span className="live-dot" /> {shopify.shop} connected</span>
                <span className="agent-desc" style={{ margin: 0 }}>
                  The engine can now publish products to your store. Use “Publish” in the Catalog, or ask the Store Builder to publish autonomously.
                </span>
                <button className="btn btn-ghost btn-small" onClick={disconnectShopify}>Disconnect</button>
              </div>
            ) : (
              <>
                <div className="console">
                  <input
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="your-store.myshopify.com"
                  />
                  <input
                    value={shopClientId}
                    onChange={(e) => setShopClientId(e.target.value)}
                    placeholder="Client ID"
                  />
                  <input
                    value={shopClientSecret}
                    onChange={(e) => setShopClientSecret(e.target.value)}
                    placeholder="Client Secret"
                    type="password"
                  />
                  <button
                    className="btn btn-accent"
                    onClick={connectShopify}
                    disabled={busy || !shopDomain.trim() || !shopClientId.trim() || !shopClientSecret.trim()}
                  >
                    {busy ? <span className="spinner" /> : "Connect"}
                  </button>
                </div>
                <p className="agent-desc">
                  In Shopify → <b>Settings → Apps and sales channels → Develop apps</b> (Dev Dashboard) → create an app,
                  add the <code>write_products</code> scope and release it, then copy the app&apos;s <b>Client ID</b> and
                  <b> Client Secret</b> and paste them here. Credentials are stored securely; the platform mints
                  short-lived tokens automatically.
                </p>
              </>
            )}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>Stores</h2><span className="hint">{stores.length} store(s) — click to open</span></div>
          <div className="card">
            {stores.length === 0 ? (
              <p className="empty">No stores yet. Ask the Store Builder to create one (needs your approval).</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Store</th><th>Platform</th><th>Status</th><th>Link</th></tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.platform}</td>
                      <td><span className={`status ${s.status}`}>{s.status}</span></td>
                      <td>
                        {!s.url || linkDraft[s.id] !== undefined ? (
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              value={linkDraft[s.id] ?? ""}
                              onChange={(e) => setLinkDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && saveStoreLink(s.id)}
                              placeholder="your-store.myshopify.com"
                              style={{ width: 220, padding: "8px 10px", fontSize: "0.82rem" }}
                            />
                            <button className="btn btn-accent btn-small" onClick={() => saveStoreLink(s.id)}>Link</button>
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                            <a className="link-a" href={s.url} target="_blank" rel="noreferrer">Open →</a>
                            <button className="copy-btn" onClick={() => setLinkDraft((d) => ({ ...d, [s.id]: s.url }))}>Edit</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>Operations Log</h2><span className="hint">Latest 20 runs</span></div>
          <div className="card">
            {runs.length === 0 ? (
              <p className="empty">No agent runs yet. Dispatch one from the command console.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Agent</th><th>Task</th><th>Status</th><th>Output</th></tr>
                </thead>
                <tbody>
                  {runs.slice(0, 20).map((r) => (
                    <tr key={r.id}>
                      <td>{r.agent_name.replace(/_/g, " ")}</td>
                      <td>{r.task.slice(0, 70)}</td>
                      <td><span className={`status ${r.status}`}>{r.status.replace(/_/g, " ")}</span></td>
                      <td>{(r.output || r.error).slice(0, 140)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>Business Memory</h2><span className="hint">What the fleet has learned</span></div>
          {memory.length === 0 ? (
            <div className="card"><p className="empty">Memory is empty. Agents write learnings and reports here.</p></div>
          ) : (
            memory.slice(0, 12).map((m) => (
              <div className="mem-item" key={m.id}>
                <div className="mk">{m.key} · {m.agent_name || "system"}</div>
                <div className="mc">{m.content.slice(0, 600)}</div>
                <div className="mm">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </section>
      </main>
      <div className="footer">SAHJONY Commerce — Autonomy with a human hand on the wheel · sahjony.com</div>
    </>
  );
}
