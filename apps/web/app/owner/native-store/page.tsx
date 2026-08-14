"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../owner.module.css";

type Settings = { storeName:string; currency:"usd"; supportEmail:string; flatShippingUsd:number; freeShippingThresholdUsd:number; allowedCountries:string[] };
type Readiness = { checks:Array<{id:string;ready:boolean;label:string}>; activeProducts:number };

export default function NativeStoreSettingsPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const headers = useMemo(() => ({ "Content-Type":"application/json", Authorization:`Bearer ${token}` }), [token]);

  useEffect(() => { setToken(localStorage.getItem("commerce_os_token") ?? ""); setOrgId(localStorage.getItem("commerce_os_org") ?? ""); }, []);
  useEffect(() => { if (!token || !orgId) return; void Promise.all([fetch(`/api/orgs/${orgId}/native-store`, { headers, cache:"no-store" }), fetch(`/api/orgs/${orgId}/native-store/readiness`, { headers, cache:"no-store" })]).then(async ([settingsResponse, readinessResponse]) => { const settingsBody = await settingsResponse.json(); const readinessBody = await readinessResponse.json(); if (!settingsResponse.ok) throw new Error(settingsBody.detail ?? "Could not load native store settings."); setSettings(settingsBody); if (readinessResponse.ok) setReadiness(readinessBody); }).catch((error) => setMessage(error instanceof Error ? error.message : String(error))); }, [token, orgId, headers]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/orgs/${orgId}/native-store`, { method:"PATCH", headers, body:JSON.stringify({ storeName:form.get("storeName"), supportEmail:form.get("supportEmail"), flatShippingUsd:Number(form.get("flatShippingUsd")), freeShippingThresholdUsd:Number(form.get("freeShippingThresholdUsd")), allowedCountries:String(form.get("allowedCountries") ?? "US").split(",").map((value) => value.trim()) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.detail ?? "Could not save settings."); setSettings(body); setMessage("Native store settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  }

  return <main className={styles.shell}><nav className={styles.nav}><a className={styles.brand} href="/shop"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog">Catalog</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav><div className={styles.content}>
    <section className={styles.hero}><div className={styles.kicker}>NATIVE COMMERCE</div><h1>Your independent <em>store engine.</em></h1><p>These settings control checkout directly. They continue working when Shopify is disconnected.</p></section>
    {message && <div className={message.includes("saved") ? styles.result : styles.error}>{message}</div>}
    {settings && <section className={styles.section}><form className={`${styles.card} ${styles.form}`} onSubmit={save}>
      <label>Store name<input className={styles.input} name="storeName" defaultValue={settings.storeName} required/></label>
      <label>Support email<input className={styles.input} name="supportEmail" type="email" defaultValue={settings.supportEmail}/></label>
      <label>Flat shipping (USD)<input className={styles.input} name="flatShippingUsd" type="number" min="0" step="0.01" defaultValue={settings.flatShippingUsd}/></label>
      <label>Free shipping at (USD)<input className={styles.input} name="freeShippingThresholdUsd" type="number" min="0" step="0.01" defaultValue={settings.freeShippingThresholdUsd}/></label>
      <label className={styles.full}>Allowed country codes, comma separated<input className={styles.input} name="allowedCountries" defaultValue={settings.allowedCountries.join(", ")} required/></label>
      <div className={styles.full}><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save native store"}</button></div>
    </form></section>}
    {!settings && !message && <div className={styles.empty}>Loading store settings…</div>}
    <section className={`${styles.card} ${styles.migration}`}><div className={styles.kicker}>PAYMENTS</div><h2>Stripe powers card processing.</h2><p>Your application owns the catalog, checkout rules, inventory, order record and fulfillment workflow. Stripe handles regulated payment data. Shopify is optional.</p></section>
    {readiness && <section className={styles.section}><div className={styles.sectionHead}><div><span>LAUNCH READINESS</span><h2>{readiness.checks.filter((check) => check.ready).length}/{readiness.checks.length} sales checks ready.</h2><p>This report reads configuration status without exposing secret values.</p></div></div><div className={styles.productList}>{readiness.checks.map((check) => <article className={styles.card} key={check.id}><div className={styles.kicker}>{check.ready ? "READY" : "ACTION REQUIRED"}</div><h2>{check.ready ? "✓" : "○"} {check.label}</h2></article>)}</div><div className={styles.heroActions}><a className={styles.ghost} href="/owner/catalog">Complete products</a><a className={styles.ghost} href="/policies" target="_blank">Review customer policies ↗</a><a className={styles.primary} href="/shop" target="_blank">Test storefront ↗</a></div></section>}
    <footer className={styles.footer}><span>BOTANICA OCHOSI Native Store</span><a href="/owner">← Back to Owner OS</a></footer>
  </div></main>;
}
