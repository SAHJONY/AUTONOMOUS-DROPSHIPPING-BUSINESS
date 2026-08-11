"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../owner.module.css";
import { buildSupplierCommunication, SUPPLIER_COMMUNICATION_KINDS, type SupplierCommunicationKind, type SupplierCommunicationLanguage } from "@/lib/supplier-communications";

type Org = { id: string; name?: string; role?: string };
type Me = { id: string; email: string; is_owner: boolean };
type TelegramStatus = {
  configured: boolean;
  token_configured: boolean;
  channel_configured: boolean;
  channel: string | null;
  detail: string;
};
type EmailMessage = { id:string; direction:"outbound"|"inbound"; from:string; to:string[]; subject:string; text:string; created_at:string };
type EmailStatus = { configured:boolean; receiving_configured:boolean; from:string; reply_to:string; messages:EmailMessage[] };

export default function OwnerCommunicationsPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [message, setMessage] = useState("BOTANICA OCHOSI · Comunicación oficial online\n\nVisita https://www.botanicaochosi.com");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [supplierName,setSupplierName]=useState("");
  const [templateKind,setTemplateKind]=useState<SupplierCommunicationKind>("WHOLESALE_ACCOUNT");
  const [templateLanguage,setTemplateLanguage]=useState<SupplierCommunicationLanguage>("es");
  const [copyNotice,setCopyNotice]=useState("");
  const [emailStatus,setEmailStatus]=useState<EmailStatus|null>(null);
  const [emailTo,setEmailTo]=useState("");
  const [emailConfirmation,setEmailConfirmation]=useState("");
  const [deletingEmailId,setDeletingEmailId]=useState("");
  const supplierTemplate=useMemo(()=>buildSupplierCommunication(templateKind,templateLanguage,supplierName||undefined),[supplierName,templateKind,templateLanguage]);

  useEffect(() => {
    setToken(localStorage.getItem("commerce_os_token") ?? "");
    setOrgId(localStorage.getItem("commerce_os_org") ?? "");
  }, []);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [meRes, orgRes] = await Promise.all([
        fetch("/api/auth/me", { headers }),
        fetch("/api/orgs", { headers }),
      ]);
      const owner = await meRes.json() as Me;
      const orgs = await orgRes.json() as Org[];
      if (!meRes.ok || !owner.is_owner) throw new Error("Owner access is required.");
      if (!orgRes.ok) throw new Error("Unable to resolve owner organization.");
      const selected = orgs.find((org) => org.id === orgId) ?? orgs[0];
      if (!selected?.id) throw new Error("No owner organization is available.");
      setMe(owner); setOrgId(selected.id); localStorage.setItem("commerce_os_org", selected.id);
      const telegramRes = await fetch(`/api/orgs/${selected.id}/communications/telegram`, { headers, cache: "no-store" });
      const telegram = await telegramRes.json() as TelegramStatus & { detail?: string };
      if (!telegramRes.ok) throw new Error(telegram.detail ?? "Unable to load Telegram status.");
      setStatus(telegram);
      const emailRes = await fetch(`/api/orgs/${selected.id}/communications/email`, { headers, cache:"no-store" });
      if (emailRes.ok) setEmailStatus(await emailRes.json() as EmailStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [headers, orgId, token]);

  useEffect(() => { void load(); }, [load]);

  async function publish() {
    if (!orgId || confirmation !== "POST TO TELEGRAM") return;
    setSending(true); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/orgs/${orgId}/communications/telegram`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, confirmation }),
      });
      const body = await res.json().catch(() => ({})) as { detail?: string; message_id?: number };
      if (!res.ok) throw new Error(body.detail ?? `Telegram publish failed (${res.status}).`);
      setNotice(`Published to Telegram${body.message_id ? ` · message ${body.message_id}` : ""}.`);
      setConfirmation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function sendEmail() {
    if (!orgId || emailConfirmation !== "SEND EMAIL") return;
    setSending(true); setError(""); setNotice("");
    try {
      const res=await fetch(`/api/orgs/${orgId}/communications/email`,{method:"POST",headers,body:JSON.stringify({to:emailTo,subject:supplierTemplate.subject,text:supplierTemplate.body,confirmation:emailConfirmation})});
      const body=await res.json().catch(()=>({})) as {detail?:string};
      if(!res.ok) throw new Error(body.detail??`Email delivery failed (${res.status}).`);
      setNotice(`Email sent by BOTANICA OCHOSI to ${emailTo}.`); setEmailConfirmation("");
      const refresh=await fetch(`/api/orgs/${orgId}/communications/email`,{headers,cache:"no-store"});
      if(refresh.ok)setEmailStatus(await refresh.json() as EmailStatus);
    } catch(e){setError(e instanceof Error?e.message:String(e));} finally{setSending(false);}
  }

  async function deleteEmail(item: EmailMessage) {
    if (!orgId || !window.confirm(`¿Eliminar permanentemente del historial este email?\n\n${item.subject}`)) return;
    setDeletingEmailId(item.id); setError(""); setNotice("");
    try {
      const res=await fetch(`/api/orgs/${orgId}/communications/email`,{method:"DELETE",headers,body:JSON.stringify({message_id:item.id,confirmation:"DELETE EMAIL"})});
      const body=await res.json().catch(()=>({})) as {detail?:string};
      if(!res.ok) throw new Error(body.detail??`No se pudo eliminar el email (${res.status}).`);
      setEmailStatus(current=>current?{...current,messages:current.messages.filter(message=>message.id!==item.id)}:current);
      setNotice("Email eliminado del historial de BOTANICA OCHOSI.");
    } catch(e){setError(e instanceof Error?e.message:String(e));} finally{setDeletingEmailId("");}
  }

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/shop">Storefront</a><a className={styles.primary} href="/owner">Owner OS</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}>
        <div className={styles.kicker}>OWNER COMMUNICATIONS · ONLINE ONLY</div>
        <h1>Telegram <em>Channel.</em></h1>
        <p>Publish approved BOTANICA OCHOSI announcements from a server-only bot integration. The bot token never reaches the browser and every post requires owner authentication plus explicit confirmation.</p>
      </section>

      {!token && !loading && <div className={styles.error}><strong>Inicio de sesión Owner requerido.</strong><div>El estado de Telegram no puede verificarse sin una sesión Owner. Esto no significa que los secretos estén ausentes.</div><a className={styles.primary} href="/owner/login" style={{marginTop:12}}>Iniciar sesión Owner</a></div>}
      {error && <div className={styles.error}><strong>Telegram requires attention</strong><div>{error}</div></div>}
      {notice && <div className={styles.card}><strong>{notice}</strong></div>}

      <section className={styles.metricGrid}>
        <div className={styles.card}><div className={styles.metricLabel}>Telegram</div><div className={styles.metricValue}>{status ? (status.configured ? "READY" : "OFF") : "UNKNOWN"}</div><div className={styles.metricNote}>{status?.detail ?? (loading ? "Verificando runtime…" : "Inicia sesión como Owner para verificar.")}</div></div>
        <div className={styles.card}><div className={styles.metricLabel}>Bot secret</div><div className={styles.metricValue}>{status ? (status.token_configured ? "SET" : "MISSING") : "UNKNOWN"}</div><div className={styles.metricNote}>Solo servidor; el valor secreto nunca se devuelve al navegador.</div></div>
        <div className={styles.card}><div className={styles.metricLabel}>Channel</div><div className={styles.metricValue}>{status ? (status.channel_configured ? "SET" : "MISSING") : "UNKNOWN"}</div><div className={styles.metricNote}>{status?.channel ?? (status ? "Configura TELEGRAM_CHANNEL_ID o TELEGRAM_CHANNEL_USERNAME." : "Estado protegido por autenticación Owner.")}</div></div>
      </section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>PAQUETE COMERCIAL · PROVEEDORES</span><h2>Comunicación lista para negociar.</h2><p>Envía y recibe como BOTANICA OCHOSI. Cada envío requiere confirmación explícita del propietario.</p></div></div><div className={styles.card}><div className={styles.form}><input className={styles.input} placeholder="Nombre del proveedor" value={supplierName} onChange={e=>setSupplierName(e.target.value)}/><select className={styles.input} value={templateKind} onChange={e=>setTemplateKind(e.target.value as SupplierCommunicationKind)}>{SUPPLIER_COMMUNICATION_KINDS.map(kind=><option key={kind.value} value={kind.value}>{kind.label}</option>)}</select><select className={styles.input} value={templateLanguage} onChange={e=>setTemplateLanguage(e.target.value as SupplierCommunicationLanguage)}><option value="es">Español · principal</option><option value="en">English · international</option></select><input className={`${styles.input} ${styles.full}`} readOnly aria-label="Asunto" value={supplierTemplate.subject}/><textarea className={`${styles.textarea} ${styles.full}`} rows={18} readOnly value={supplierTemplate.body}/><input className={styles.input} type="email" placeholder="proveedor@empresa.com" value={emailTo} onChange={e=>setEmailTo(e.target.value)}/><input className={styles.input} placeholder="Escribe SEND EMAIL" value={emailConfirmation} onChange={e=>setEmailConfirmation(e.target.value)}/><div className={`${styles.rowActions} ${styles.full}`}><button className={styles.primary} disabled={!emailStatus?.configured||sending||emailConfirmation!=="SEND EMAIL"||!emailTo} onClick={()=>void sendEmail()}>{sending?"Enviando…":"Enviar como BOTANICA OCHOSI"}</button><button className={styles.ghost} onClick={()=>void navigator.clipboard.writeText(`Asunto: ${supplierTemplate.subject}\n\n${supplierTemplate.body}`).then(()=>setCopyNotice("Mensaje copiado."))}>Copiar mensaje</button></div></div>{copyNotice&&<div className={styles.result}>{copyNotice}</div>}<p>Salida: {emailStatus?.from??"sin configurar"} · Respuestas: {emailStatus?.reply_to??"sin configurar"} · Recepción {emailStatus?.receiving_configured?"activa":"pendiente"}.</p></div></section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>EMAIL · HISTORIAL</span><h2>Mensajes enviados y recibidos.</h2></div></div><div className={styles.actionGrid}>{emailStatus?.messages.length?emailStatus.messages.map(item=><article className={styles.card} key={item.id}><div className={styles.kicker}>{item.direction==="inbound"?"RECIBIDO":"ENVIADO"} · {new Date(item.created_at).toLocaleString()}</div><h2>{item.subject}</h2><p><strong>De:</strong> {item.from}<br/><strong>Para:</strong> {item.to.join(", ")}</p><details><summary>Ver mensaje</summary><pre style={{whiteSpace:"pre-wrap"}}>{item.text}</pre></details><div className={styles.rowActions} style={{marginTop:16}}><button className={styles.ghost} disabled={Boolean(deletingEmailId)} onClick={()=>void deleteEmail(item)}>{deletingEmailId===item.id?"Eliminando…":"Eliminar email"}</button></div></article>):<div className={styles.card}>No hay mensajes registrados todavía.</div>}</div></section>

      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.kicker}>OWNER-APPROVED POST</div>
          <h2>Publish an official update</h2>
          <p>Automatic campaign posting remains disabled. Compose the message, then type the exact confirmation before publishing.</p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} maxLength={4096} style={{width:"100%",boxSizing:"border-box",padding:16,borderRadius:16,background:"#0d1d12",color:"#f5f0df",border:"1px solid rgba(214,171,84,.38)",marginBottom:12}} />
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Type POST TO TELEGRAM" style={{width:"100%",boxSizing:"border-box",minHeight:48,padding:"0 15px",borderRadius:999,background:"#0d1d12",color:"#f5f0df",border:"1px solid rgba(214,171,84,.38)",marginBottom:12}} />
          <button className={styles.primary} disabled={!status?.configured || sending || confirmation !== "POST TO TELEGRAM" || !message.trim()} onClick={() => void publish()}>{sending ? "Publishing…" : "Publish to Telegram"}</button>
        </div>
      </section>

      <footer className={styles.footer}><span>Owner: {me?.email ?? "authentication pending"}</span><span>BOTANICA OCHOSI · online communications</span></footer>
    </div>
  </main>;
}
