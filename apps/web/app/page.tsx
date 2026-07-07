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

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");

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

  if (!authed) {
    return (
      <main>
        <h1>Claude Commerce OS</h1>
        <p className="subtitle">
          Autonomous AI dropshipping operator — multi-agent, human-approved.
        </p>
        <form className="auth" onSubmit={handleAuth}>
          <div className="row">
            <button
              type="button"
              className={mode === "register" ? "" : "secondary"}
              onClick={() => setMode("register")}
            >
              Register
            </button>
            <button
              type="button"
              className={mode === "login" ? "" : "secondary"}
              onClick={() => setMode("login")}
            >
              Login
            </button>
          </div>
          <input name="email" type="email" placeholder="Email" required />
          <input
            name="password"
            type="password"
            placeholder="Password (8+ characters)"
            minLength={8}
            required
          />
          {mode === "register" && <input name="org" placeholder="Business name" />}
          <button type="submit">{mode === "register" ? "Create account" : "Sign in"}</button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <main>
      <h1>Claude Commerce OS</h1>
      <p className="subtitle">Your AI operating team, reporting for duty.</p>
      {error && <p className="error">{error}</p>}

      {dashboard && (
        <div className="grid">
          <div className="card">
            <div className="value">{dashboard.products_total}</div>
            <div className="label">Products</div>
          </div>
          <div className="card">
            <div className="value">{dashboard.stores_total}</div>
            <div className="label">Stores</div>
          </div>
          <div className="card">
            <div className="value">{dashboard.runs_total}</div>
            <div className="label">Agent runs</div>
          </div>
          <div className="card">
            <div className="value">{dashboard.pending_approvals}</div>
            <div className="label">Pending approvals</div>
          </div>
          <div className="card">
            <div className="value">{dashboard.total_tokens_used.toLocaleString()}</div>
            <div className="label">Tokens used</div>
          </div>
        </div>
      )}

      <h2>Run an agent</h2>
      <div className="row">
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ maxWidth: 220 }}>
          {agents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task, e.g. 'Review the business and write today's report'"
          style={{ flex: 1, minWidth: 260 }}
        />
        <button onClick={runAgent} disabled={busy || !task.trim()}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        {agents.find((a) => a.name === selectedAgent)?.description}
      </p>

      {pending.length > 0 && (
        <>
          <h2>Approvals needed</h2>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Action</th>
                <th>Details</th>
                <th>Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td>{a.agent_name}</td>
                  <td>{a.action}</td>
                  <td>
                    <code>{JSON.stringify(a.payload)}</code>
                  </td>
                  <td>
                    <span className="status pending">{a.risk_level}</span>
                  </td>
                  <td className="row">
                    <button onClick={() => decide(a.id, "approve")}>Approve</button>
                    <button className="secondary" onClick={() => decide(a.id, "reject")}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Recent runs</h2>
      {runs.length === 0 ? (
        <p className="muted">No agent runs yet. Dispatch one above.</p>
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
                <td>{r.agent_name}</td>
                <td>{r.task.slice(0, 80)}</td>
                <td>
                  <span className={`status ${r.status}`}>{r.status}</span>
                </td>
                <td className="muted">{(r.output || r.error).slice(0, 160)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
