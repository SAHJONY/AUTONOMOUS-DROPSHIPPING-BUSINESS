"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../owner.module.css";

type Me = { id: string; email: string; is_owner: boolean };
type Org = { id: string; name?: string; role?: string };

export default function OwnerLoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("commerce_os_token");
    if (!token) return;

    void fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) return;
        const me = (await res.json()) as Me;
        if (me.is_owner) window.location.replace("/owner");
      })
      .catch(() => {});
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await login.json().catch(() => ({}));
      if (!login.ok || !loginBody.access_token) {
        throw new Error(loginBody.detail ?? "Owner sign-in failed.");
      }

      const token = String(loginBody.access_token);
      const authHeaders = { Authorization: `Bearer ${token}` };
      const [meResponse, orgsResponse] = await Promise.all([
        fetch("/api/auth/me", { headers: authHeaders }),
        fetch("/api/orgs", { headers: authHeaders }),
      ]);

      const me = (await meResponse.json().catch(() => ({}))) as Partial<Me>;
      if (!meResponse.ok || me.is_owner !== true) {
        throw new Error("This account does not have BOTANICA Owner OS access.");
      }

      const orgs = (await orgsResponse.json().catch(() => [])) as Org[];
      if (!orgsResponse.ok || !orgs[0]?.id) {
        throw new Error("No owner organization is available for this account.");
      }

      localStorage.setItem("commerce_os_token", token);
      localStorage.setItem("commerce_os_org", orgs[0].id);
      window.location.replace("/owner");
    } catch (err) {
      localStorage.removeItem("commerce_os_token");
      localStorage.removeItem("commerce_os_org");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a className={styles.brand} href="/shop">
          <span className={styles.mark}>O</span>
          <span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span>
        </a>
        <div className={styles.navLinks}>
          <a className={styles.ghost} href="/shop">Storefront</a>
        </div>
      </nav>

      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.kicker}>SECURE OWNER ACCESS</div>
          <h1>Owner <em>sign in.</em></h1>
          <p>Authenticate directly into BOTANICA OCHOSI Owner OS. This login uses the existing commerce authentication backend and grants access only after the account is verified as the platform owner.</p>
        </section>

        <section className={styles.section}>
          <form onSubmit={signIn} className={`${styles.card} ${styles.form}`} style={{ maxWidth: 620, margin: "0 auto" }}>
            <label className={styles.full}>
              Owner email
              <input className={styles.input} name="email" type="email" autoComplete="username" required autoFocus placeholder="Owner email" />
            </label>
            <label className={styles.full}>
              Password
              <input className={styles.input} name="password" type="password" autoComplete="current-password" minLength={8} required placeholder="Password" />
            </label>
            {error && <div className={`${styles.error} ${styles.full}`}><strong>Unable to sign in</strong><div>{error}</div></div>}
            <div className={styles.full}>
              <button className={styles.primary} disabled={busy} type="submit">{busy ? "Verifying owner…" : "Enter Owner OS"}</button>
            </div>
          </form>
        </section>

        <footer className={styles.footer}><span>BOTANICA OCHOSI · Secure Owner Access</span><a href="/shop">← Back to storefront</a></footer>
      </div>
    </main>
  );
}
