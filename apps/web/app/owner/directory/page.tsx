"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../owner.module.css";
import { BOTANICA_SUPPLIERS } from "@/lib/botanica-supplier-registry";

type DirectoryEntry = {
  id: string;
  name: string;
  organization: string;
  category: string;
  phone: string;
  email: string;
  website: string;
  location: string;
  notes: string;
  favorite: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "botanica_owner_personal_directory_v1";
const emptyEntry = (): DirectoryEntry => ({ id:"", name:"", organization:"", category:"Proveedor", phone:"", email:"", website:"", location:"", notes:"", favorite:false, updatedAt:"" });

export default function OwnerDirectoryPage() {
  const [entries,setEntries]=useState<DirectoryEntry[]>([]);
  const [draft,setDraft]=useState<DirectoryEntry>(emptyEntry());
  const [query,setQuery]=useState("");
  const [ready,setReady]=useState(false);
  const [hasSession,setHasSession]=useState(false);

  useEffect(()=>{
    setHasSession(Boolean(localStorage.getItem("commerce_os_token")));
    try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]") as DirectoryEntry[]; setEntries(Array.isArray(saved)?saved:[]); } catch { setEntries([]); }
    setReady(true);
  },[]);

  const persist=(next:DirectoryEntry[])=>{setEntries(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));};
  const visible=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase("es");
    return [...entries].filter(entry=>!term||[entry.name,entry.organization,entry.category,entry.phone,entry.email,entry.location,entry.notes].some(value=>value.toLocaleLowerCase("es").includes(term))).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name,"es"));
  },[entries,query]);

  const save=(event:React.FormEvent)=>{
    event.preventDefault();
    if(!draft.name.trim()&&!draft.organization.trim()) return;
    const record={...draft,id:draft.id||crypto.randomUUID(),name:draft.name.trim(),organization:draft.organization.trim(),updatedAt:new Date().toISOString()};
    persist(draft.id?entries.map(entry=>entry.id===draft.id?record:entry):[record,...entries]);
    setDraft(emptyEntry());
  };
  const remove=(id:string)=>{if(window.confirm("¿Eliminar este contacto de tu directorio personal?")) persist(entries.filter(entry=>entry.id!==id));};
  const importSuppliers=()=>{
    const byWebsite=new Map(entries.map(entry=>[entry.website.toLowerCase(),entry]));
    const now=new Date().toISOString();
    const imported=BOTANICA_SUPPLIERS.map(s=>{
      const current=byWebsite.get(s.website.toLowerCase());
      const phone=s.contacts?.find(c=>c.href.startsWith("tel:")||c.href.includes("wa.me"))?.value??"";
      const email=s.contacts?.find(c=>c.href.startsWith("mailto:"))?.value??"";
      const contactNotes=s.contacts?.map(contact=>`${contact.label}: ${contact.value} — ${contact.href}`).join("\n")??"";
      const supplierNotes=`${s.categories.join(" · ")}\n${s.strengths.join(" · ")}${contactNotes?`\n\nContactos comerciales:\n${contactNotes}`:""}`;
      const refreshedNotes=current?.notes&&!current.notes.includes("Contactos comerciales:")&&contactNotes?`${current.notes}\n\nContactos comerciales:\n${contactNotes}`:current?.notes||supplierNotes;
      return current?{...current,phone:current.phone||phone,email:current.email||email,location:s.location,notes:refreshedNotes,updatedAt:now}:{id:crypto.randomUUID(),name:s.name,organization:s.name,category:s.region==="INTERNATIONAL"?"Importador":s.sourcingPolicy==="CUSTOM_MANUFACTURING"?"Fabricante":"Proveedor",phone,email,website:s.website,location:s.location,notes:supplierNotes,favorite:s.researchPriority===1,updatedAt:now};
    });
    const supplierWebsites=new Set(BOTANICA_SUPPLIERS.map(s=>s.website.toLowerCase()));
    persist([...entries.filter(entry=>!supplierWebsites.has(entry.website.toLowerCase())),...imported]);
  };
  const exportDirectory=()=>{
    const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="directorio-personal-botanica-ochosi.json";anchor.click();URL.revokeObjectURL(url);
  };

  if(ready&&!hasSession) return <main className={styles.shell}><div className={styles.content}><div className={styles.error}><strong>Acceso privado requerido.</strong><p>Inicia sesión como propietario para abrir tu directorio personal.</p><a className={styles.primary} href="/owner/login">Iniciar sesión</a></div></div></main>;
  return <main className={styles.shell}><nav className={styles.nav}><a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/suppliers">Proveedores</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav><div className={styles.content}>
    <section className={styles.hero}><div className={styles.kicker}>USO PERSONAL · SOLO PROPIETARIO</div><h1>Mi <em>directorio.</em></h1><p>Contactos, fabricantes, asesores y relaciones comerciales en un espacio privado del Owner Dashboard. Esta versión se guarda únicamente en este navegador.</p><div className={styles.heroActions}><button className={styles.primary} onClick={importSuppliers}>Importar proveedores verificados</button><button className={styles.ghost} onClick={exportDirectory} disabled={!entries.length}>Exportar respaldo JSON</button></div></section>
    <div className={styles.statusStrip}><span className={styles.statusPill}>{entries.length} contactos</span><span className={styles.statusPill}>{entries.filter(entry=>entry.favorite).length} prioritarios</span><span className={styles.statusPill}>Almacenamiento local privado</span></div>
    <section className={styles.section}><div className={styles.card}><div className={styles.kicker}>{draft.id?"EDITAR CONTACTO":"NUEVO CONTACTO"}</div><h2>{draft.id?"Actualizar ficha":"Añadir al directorio"}</h2><form className={styles.form} onSubmit={save}>
      <input className={styles.input} aria-label="Nombre" placeholder="Nombre del contacto" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/><input className={styles.input} aria-label="Empresa" placeholder="Empresa u organización" value={draft.organization} onChange={e=>setDraft({...draft,organization:e.target.value})}/><select className={styles.input} aria-label="Categoría" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}><option>Proveedor</option><option>Fabricante</option><option>Importador</option><option>Cliente</option><option>Profesional</option><option>Personal</option><option>Otro</option></select>
      <input className={styles.input} aria-label="Teléfono" placeholder="Teléfono / WhatsApp" value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/><input className={styles.input} aria-label="Correo" placeholder="Correo electrónico" type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/><input className={styles.input} aria-label="Sitio web" placeholder="https://" value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})}/>
      <input className={`${styles.input} ${styles.full}`} aria-label="Ubicación" placeholder="Ciudad, estado o país" value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/><textarea className={`${styles.textarea} ${styles.full}`} aria-label="Notas" placeholder="Notas privadas, condiciones, próxima acción…" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/><label><input type="checkbox" checked={draft.favorite} onChange={e=>setDraft({...draft,favorite:e.target.checked})}/> Marcar como prioritario</label><div className={styles.rowActions}><button className={styles.primary} type="submit">{draft.id?"Guardar cambios":"Añadir contacto"}</button>{draft.id&&<button className={styles.ghost} type="button" onClick={()=>setDraft(emptyEntry())}>Cancelar</button>}</div>
    </form></div></section>
    <section className={styles.section}><div className={styles.sectionHead}><div><span>CONTACTOS PERSONALES</span><h2>Directorio operativo.</h2></div><input className={styles.input} style={{maxWidth:360}} aria-label="Buscar contactos" placeholder="Buscar nombre, país, categoría…" value={query} onChange={e=>setQuery(e.target.value)}/></div>{!visible.length?<div className={styles.empty}>No hay contactos que coincidan. Añade uno o importa el registro verificado.</div>:<div className={styles.actionGrid}>{visible.map(entry=><article className={styles.card} key={entry.id}><div className={styles.kicker}>{entry.favorite?"★ PRIORITARIO · ":""}{entry.category}</div><h2>{entry.name||entry.organization}</h2>{entry.name&&entry.organization&&entry.name!==entry.organization?<p><strong>{entry.organization}</strong></p>:null}<p>{entry.location}</p><div className={styles.productMeta}>{entry.phone&&<div><a href={`tel:${entry.phone.replace(/[^+\d]/g,"")}`}>{entry.phone}</a></div>}{entry.email&&<div><a href={`mailto:${entry.email}`}>{entry.email}</a></div>}{entry.website&&<div><a href={entry.website} target="_blank" rel="noreferrer">{entry.website}</a></div>}</div>{entry.notes&&<p style={{whiteSpace:"pre-line"}}>{entry.notes}</p>}<div className={styles.rowActions}><button className={styles.ghost} onClick={()=>{setDraft(entry);window.scrollTo({top:0,behavior:"smooth"});}}>Editar</button><button className={styles.danger} onClick={()=>remove(entry.id)}>Eliminar</button></div></article>)}</div>}</section>
    <footer className={styles.footer}><span>Directorio personal · no sincronizado con Shopify</span><span>Haz respaldos JSON periódicos</span></footer>
  </div></main>;
}
