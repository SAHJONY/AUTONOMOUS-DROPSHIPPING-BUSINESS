"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Dashboard = {
  products_total: number;
  products_by_status: Record<string, number>;
  runs_total: number;
  runs_by_status: Record<string, number>;
  pending_approvals: number;
  stores_total: number;
  total_tokens_used: number;
};

type AgentInfo = {
  name: string;
  description: string;
  tools: string[];
  high_risk_tools: string[];
};

type AgentRun = {
  id: string;
  agent_name: string;
  task: string;
  status: string;
  output: string;
  error: string;
  created_at: string;
};

type Approval = {
  id: string;
  agent_name: string;
  action: string;
  payload: Record<string, unknown>;
  risk_level: string;
  status: string;
  result: string;
};

const FEATURES = [
  {
    title: "CEO Agent",
    body: "Reviews the business snapshot, coordinates seven specialist agents, and files a structured daily report — revenue, top products, next actions.",
  },
  {
    title: "Product Intelligence",
    body: "Every opportunity is scored deterministically — demand, competition, margin, trend, risk. Only 85+ reaches the launch queue.",
  },
  {
    title: "Human Command",
    body: "Refunds, ad budgets, store creation, killing products — high-risk actions halt for your approval. Nothing irreversible happens without you.",
  },
  {
    title: "Total Recall",
    body: "Agents write every learning, quote, and report to business memory and recall it in future runs. The operation compounds.",
  },
];

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"hero" | "register" | "login">("hero");

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("ceo");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);

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

  const refresh = useCallback(async () => {
    if (!token || !orgId) return;
    try {
      const [dash, agentList, runList, approvalList] = await Promise.all([
        api(`/orgs/${orgId}/dashboard`),
        api(`/agents`),
        api(`/orgs/${orgId}/runs`),
        api(`/orgs/${orgId}/approvals`),
      ]);
      setDashboard(dash);
      setAgents(agentList);
      setRuns(runList);
      setApprovals(approvalList);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, token, orgId]);

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
      const orgs = await fetch(`${API}/orgs`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((r) => r.json());
      setToken(access_token);
      setOrgId(orgs[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function signOut() {
    setToken(null);
    setOrgId(null);
    setDashboard(null);
    setRuns([]);
    setApprovals([]);
    setView("hero");
  }

  async function runAgent() {
    if (!task.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/orgs/${orgId}/agents/${selectedAgent}/run`, {
        method: "POST",
        body: JSON.stringify({ task }),
      });
      setTask("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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

  /* ---------- Signed out: hero + auth ---------- */

  if (!authed) {
    if (view === "hero") {
      return (
        <>
          <nav className="nav">
            <div className="wordmark">
              Commerce <span>OS</span>
            </div>
            <div className="nav-right">
              <button onClick={() => setView("login")}>Sign in</button>
            </div>
          </nav>
          <div className="hero">
            <div className="hero-backdrop" />
            <div className="hero-glow" />
            <div className="hero-horizon" />
            <div className="eyebrow">The Autonomous Commerce Operator</div>
            <h1 className="display">Commerce, on Autopilot</h1>
            <p className="lede">
              A Claude CEO agent and seven specialists discover products, validate demand, and
              run your stores around the clock. You approve only what matters.
            </p>
            <div className="hero-ctas">
              <button className="btn btn-primary" onClick={() => setView("register")}>
                Start Operating
              </button>
              <button className="btn btn-ghost" onClick={() => setView("login")}>
                Sign In
              </button>
            </div>
          </div>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
          <div className="footer">Claude Commerce OS — Autonomy with a human hand on the wheel</div>
        </>
      );
    }

    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="eyebrow">Commerce OS</div>
          <h1>{view === "register" ? "Create Account" : "Sign In"}</h1>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleAuth}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" minLength={8} required />
            </div>
            {view === "register" && (
              <div className="field">
                <label htmlFor="org">Business name</label>
                <input id="org" name="org" placeholder="My Business" />
              </div>
            )}
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
              {view === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>
          <p className="auth-switch" style={{ marginTop: 28 }}>
            {view === "register" ? (
              <>
                Already operating?{" "}
                <button onClick={() => setView("login")}>Sign in</button>
              </>
            ) : (
              <>
                New here?{" "}
                <button onClick={() => setView("register")}>Create an account</button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Signed in: command deck ---------- */

  const pending = approvals.filter((a) => a.status === "pending");
  const currentAgent = agents.find((a) => a.name === selectedAgent);

  return (
    <>
      <nav className="nav">
        <div className="wordmark">
          Commerce <span>OS</span>
        </div>
        <div className="nav-right">
          <span>{pending.length > 0 ? `${pending.length} approvals waiting` : "All clear"}</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <main className="app">
        {error && <p className="error">{error}</p>}

        {dashboard && (
          <section>
            <div className="metrics">
              <div className="metric">
                <div className="value">{dashboard.products_total}</div>
                <div className="label">Products</div>
              </div>
              <div className="metric">
                <div className="value">{dashboard.stores_total}</div>
                <div className="label">Stores</div>
              </div>
              <div className="metric">
                <div className="value">{dashboard.runs_total}</div>
                <div className="label">Agent Runs</div>
              </div>
              <div className="metric">
                <div className="value">{dashboard.pending_approvals}</div>
                <div className="label">Approvals</div>
              </div>
              <div className="metric">
                <div className="value">{dashboard.total_tokens_used.toLocaleString()}</div>
                <div className="label">Tokens</div>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="section-head">
            <h2>Command</h2>
            <span className="hint">Dispatch an agent</span>
          </div>
          <div className="console">
            <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAgent()}
              placeholder="Review the business and write today's report"
            />
            <button className="btn btn-primary" onClick={runAgent} disabled={busy || !task.trim()}>
              {busy ? "Running" : "Run"}
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
        </section>

        <section>
          <div className="section-head">
            <h2>Approvals</h2>
            <span className="hint">High-risk actions halt here</span>
          </div>
          {pending.length === 0 ? (
            <p className="empty">Nothing awaiting your decision.</p>
          ) : (
            pending.map((a) => (
              <div className="approval" key={a.id}>
                <div className="approval-info">
                  <h4>
                    {a.action.replace(/_/g, " ")}{" "}
                    <span className={`status ${a.risk_level}`}>{a.risk_level} risk</span>
                  </h4>
                  <p>
                    Requested by the {a.agent_name.replace(/_/g, " ")} agent —{" "}
                    <code>{JSON.stringify(a.payload)}</code>
                  </p>
                </div>
                <div className="approval-actions">
                  <button className="btn btn-primary btn-small" onClick={() => decide(a.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => decide(a.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>Operations Log</h2>
            <span className="hint">Latest 20 runs</span>
          </div>
          {runs.length === 0 ? (
            <p className="empty">No agent runs yet. Dispatch one from the command console.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td>{r.agent_name.replace(/_/g, " ")}</td>
                    <td>{r.task.slice(0, 70)}</td>
                    <td>
                      <span className={`status ${r.status}`}>{r.status.replace(/_/g, " ")}</span>
                    </td>
                    <td>{(r.output || r.error).slice(0, 140)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      <div className="footer">Claude Commerce OS — Autonomy with a human hand on the wheel</div>
    </>
  );
}
