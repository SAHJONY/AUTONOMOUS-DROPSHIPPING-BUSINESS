"use client";

import { useState } from "react";

/**
 * The Operating Manual — rendered inside the signed-in dashboard only
 * (not a public route). Toggled from the dashboard nav.
 */

/** A ready-to-run prompt with a one-tap copy button. */
function Prompt({ children, gated }: { children: string; gated?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className={`prompt ${gated ? "gated" : ""}`}>
      <span className="ptext">
        {gated && <span className="g">⚠ </span>}
        {children}
      </span>
      <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const AGENTS: { name: string; role: string; gate?: string; ceo?: boolean }[] = [
  { name: "CEO", role: "Reviews the business, coordinates the whole fleet, and files structured reports. Your single point of command.", gate: "Killing a product", ceo: true },
  { name: "Product Hunter", role: "Discovers and scores product opportunities on a deterministic model. Only 85+ becomes launch-ready." },
  { name: "Supplier", role: "Sources across CJ Dropshipping, AliExpress, Spocket & Zendrop; compares landed cost and shipping; logs quotes." },
  { name: "Store Builder", role: "Builds storefronts and writes high-converting listings, SEO copy, and policies.", gate: "Creating a store" },
  { name: "Marketing", role: "Designs ad angles, hooks, and creative briefs for TikTok, Meta, and email." },
  { name: "Advertising", role: "Analyzes ROAS/CPA/CTR and proposes budgets.", gate: "Setting an ad budget" },
  { name: "Finance", role: "Computes unit economics and tracks profitability with exact margin math." },
  { name: "Support", role: "Drafts empathetic, on-brand customer replies.", gate: "Issuing a refund" },
];

export default function Manual({ onBack }: { onBack: () => void }) {
  return (
    <main className="doc">
      <div className="doc-hero">
        <div className="eyebrow">Operating Manual</div>
        <h1>Run an autonomous business.</h1>
        <p>
          SAHJONY Commerce is an autonomous commerce operator. An AI CEO and seven specialists discover
          products, validate demand, build stores, and optimize profit around the clock — while you keep a hand
          on the wheel, approving only what matters. This manual covers everything you need to operate it.
        </p>
        <div className="doc-cta" style={{ marginTop: 24 }}>
          <button className="btn btn-accent" onClick={onBack}>Back to Command Deck</button>
        </div>
      </div>

      <div className="doc-toc">
        <a href="#overview"><b>1 · Overview</b>What the platform is and how it thinks</a>
        <a href="#fleet"><b>2 · The Fleet</b>Your CEO and seven specialists</a>
        <a href="#operate"><b>3 · How to Operate</b>Dispatch, approve, and read the deck</a>
        <a href="#owner"><b>4 · Owner Controls</b>Your unrestricted god-mode</a>
        <a href="#autonomous"><b>5 · The 24/7 Cycle</b>What runs on its own</a>
        <a href="#prompts"><b>6 · Prompt Library</b>Ready-to-run operating prompts</a>
        <a href="#guardrails"><b>7 · Guardrails</b>Safety and human gates</a>
        <a href="#tips"><b>8 · Tips & FAQ</b>Get the most out of it</a>
      </div>

      <section id="overview" className="doc-section">
        <h2>1 · Overview</h2>
        <p>
          The platform is organized around one idea: <b>autonomy with a human hand on the wheel</b>. The AI runs
          the operation continuously, but anything irreversible or money-moving stops and waits for your approval.
          Nothing risky happens without you.
        </p>
        <h3>The core loop</h3>
        <div className="doc-step"><div className="num">1</div><div className="body"><b>Discover &amp; score</b><p>The Product Hunter finds opportunities and scores each one deterministically — demand 30%, competition 20%, margin 25%, trend 15%, risk 10%. Only products scoring 85+ are marked launch-ready.</p></div></div>
        <div className="doc-step"><div className="num">2</div><div className="body"><b>Build &amp; validate</b><p>Store Builder writes listings, Supplier sources the product, and Finance verifies the unit economics — all before a dollar is spent.</p></div></div>
        <div className="doc-step"><div className="num">3</div><div className="body"><b>Launch &amp; optimize</b><p>Marketing designs the creative, Advertising proposes budgets, and the CEO keeps the whole operation coordinated and reported.</p></div></div>
        <div className="doc-step"><div className="num">4</div><div className="body"><b>Compound</b><p>Every learning, quote, and report is written to Business Memory and recalled in future runs. The operation gets smarter over time.</p></div></div>
      </section>

      <section id="fleet" className="doc-section">
        <h2>2 · The Fleet</h2>
        <p>Eight autonomous agents. The CEO orchestrates; the specialists execute. Agents marked with a gate will halt for your approval before acting.</p>
        <div className="agent-doc">
          {AGENTS.map((a) => (
            <div className={`ad ${a.ceo ? "ceo" : ""}`} key={a.name}>
              <h4>{a.name}</h4>
              <p>{a.role}</p>
              {a.gate && <div className="gate">⚠ Approval required: {a.gate}</div>}
            </div>
          ))}
        </div>
      </section>

      <section id="operate" className="doc-section">
        <h2>3 · How to Operate</h2>
        <h3>Dispatch an agent</h3>
        <p>From the <b>Command</b> console: pick an agent in the dropdown, type a task, and hit <b>Run</b> — or tap the quick-task chips. You can also tap any tile in <b>The Fleet</b> to select that agent. The CEO can dispatch specialists itself, so a single CEO task can drive the whole team.</p>
        <h3>Clear approvals</h3>
        <p>High-risk actions appear in the <b>Approvals</b> section. Each shows the agent, the action, and the exact parameters. <b>Approve</b> executes the stored action immediately; <b>Reject</b> cancels it. Until you decide, the action has not happened.</p>
        <h3>Read the deck</h3>
        <ul>
          <li><b>Est. Margin Pool</b> — projected per-unit margin across launched products.</li>
          <li><b>Products / Stores / Agent Runs</b> — the size and activity of your operation.</li>
          <li><b>Approvals</b> — decisions waiting on you.</li>
          <li><b>Tokens</b> — how much thinking the engine has done for you.</li>
          <li><b>Operations Log</b> — the latest runs with status and output.</li>
          <li><b>Business Memory</b> — everything the fleet has learned and reported.</li>
        </ul>
        <div className="doc-note"><b>Tip:</b> the sharper your task, the sharper the result. Put real specifics (product, price, channel, budget) into the prompt.</div>
        <h3>Connect Shopify (publish products live)</h3>
        <p>In Shopify → <b>Settings → Apps and sales channels → Develop apps</b> (the Dev Dashboard) → create an app, add the <code>write_products</code> scope, and release it. Copy the app&apos;s <b>Client ID</b> and <b>Client Secret</b> and paste them into the <b>Shopify Connection</b> panel with your store domain. The platform mints short-lived tokens automatically. Then hit <b>Publish</b> on any product in the Catalog, or ask the Store Builder to <i>&quot;publish our best product to Shopify.&quot;</i> Shopify doesn&apos;t allow creating brand-new stores by API — connect an existing store.</p>
      </section>

      <section id="owner" className="doc-section">
        <h2>4 · Owner Controls</h2>
        <p>
          The account <b>sahjonycapitalllc@outlook.com</b> is the platform owner with <b>unrestricted god-mode</b>:
          full access to every organization, user, product, run, and approval across the platform. The owner panel at
          the top of the dashboard shows platform-wide totals at a glance.
        </p>
        <p>
          Your owner password is controlled from the environment (Vercel → <code>OWNER_PASSWORD</code>) and is always
          authoritative — change it there anytime and your next sign-in re-syncs automatically.
        </p>
      </section>

      <section id="autonomous" className="doc-section">
        <h2>5 · The 24/7 Cycle</h2>
        <p>
          A scheduled autonomous cycle runs on its own every day. The CEO reviews each organization, then <b>moves the
          business forward</b> — hunting new products when the pipeline is thin, drafting listings, verifying economics,
          briefing creative, and queuing any high-risk actions for your approval. It never waits on a human to keep
          going; it parks anything risky in your Approvals queue and files a report to memory.
        </p>
        <p>These operating prompts are for when you want to drive manually. The autonomous cycle handles the rest.</p>
        <div className="doc-note"><b>Autopilot (98% autonomous).</b> With Autopilot engaged (the bar at the top of your deck), the engine auto-approves routine gated actions within safe limits — creating stores, killing products, ad budgets up to $50/day, and refunds up to $50. Only larger budgets and refunds escalate to you. Switch to Manual anytime to gate everything again.</div>
      </section>

      <section id="prompts" className="doc-section">
        <h2>6 · Prompt Library</h2>
        <p>Copy any of these into the Command console. Prompts marked <span style={{ color: "var(--amber)" }}>⚠</span> queue an action for your approval.</p>

        <h3>Day-one kickstart (agent: CEO)</h3>
        <Prompt>Review the business snapshot and tell me exactly what state we&apos;re in and what to do first.</Prompt>
        <Prompt>Dispatch the product_hunter to find and score 5 trending dropshipping products for this quarter. Save every one it evaluates.</Prompt>
        <Prompt>Dispatch the finance agent to compute unit economics for our top-scored product at a 3.5x markup, then tell me if it clears our margin bar.</Prompt>
        <Prompt>Dispatch the store_builder to propose a store name and write a listing for our best launch-ready product.</Prompt>

        <h3>CEO — daily driver</h3>
        <Prompt>Review the business and write today&apos;s report: revenue, top products, failed products, risks, and the 3 highest-leverage next actions. Save it to memory.</Prompt>
        <Prompt>Recall the last 3 daily reports and tell me what&apos;s trending up or down.</Prompt>
        <Prompt>Coordinate a full launch cycle for our best opportunity: dispatch supplier, store_builder, marketing, and advertising, then summarize the plan.</Prompt>
        <Prompt gated>Kill the product that&apos;s dragging our margins and explain the reasoning.</Prompt>

        <h3>Product Hunter</h3>
        <Prompt>Find and score 5 trending products for the [home fitness / pet / kitchen] niche. Score each and save them. List which are launch-ready.</Prompt>
        <Prompt>Score this opportunity and save it: portable neck fan — demand 82, competition 60, margin 70, trend 88, risk 20.</Prompt>
        <Prompt>List our catalog and rank everything by score.</Prompt>

        <h3>Supplier</h3>
        <Prompt>Evaluate sourcing options for our best product across CJ Dropshipping, AliExpress, Spocket, and Zendrop. Compare landed cost and shipping, and record the best quote to memory.</Prompt>

        <h3>Store Builder</h3>
        <Prompt>Write a high-converting product listing for our best product: title, description, and price. Update the product.</Prompt>
        <Prompt gated>Create a new Shopify store named [store name] for our operation.</Prompt>

        <h3>Marketing</h3>
        <Prompt>Design 3 ad angles and hooks for our top product on TikTok and Meta, plus one email subject line. Record the brief to memory.</Prompt>

        <h3>Advertising</h3>
        <Prompt>Analyze the ROAS/CPA math for our best product at a $39.99 price and propose a starting daily budget with your reasoning.</Prompt>
        <Prompt gated>Set the TikTok daily ad budget to $50 for our best launch and record why.</Prompt>

        <h3>Finance</h3>
        <Prompt>Compute unit economics for price 39.99, cost 9.50, ad cost per order 8. Tell me profit per order and net margin.</Prompt>
        <Prompt>Run the margin math on our launch-ready products and tell me which has the strongest unit economics.</Prompt>
        <Prompt>Build a 12-month financial forecast from our current catalog and unit economics.</Prompt>
        <div className="doc-note"><b>Live Forecast tab.</b> The <b>Forecast</b> button in the nav opens a 12-month projection built from your real catalog — three scenarios, unit economics, and monthly revenue/profit. It updates as your catalog grows.</div>

        <h3>Support</h3>
        <Prompt>Draft an empathetic reply to a customer whose order is 5 days late and asking for an update.</Prompt>
        <Prompt gated>Issue a $39.99 refund for order #12345 — item arrived damaged.</Prompt>
      </section>

      <section id="guardrails" className="doc-section">
        <h2>7 · Guardrails</h2>
        <p>Four actions are irreversible or move money, so they always stop for your approval — no matter which agent requests them:</p>
        <ul>
          <li><b>Creating a store</b> (Store Builder)</li>
          <li><b>Setting an ad budget</b> (Advertising)</li>
          <li><b>Issuing a refund</b> (Support)</li>
          <li><b>Killing a product</b> (CEO)</li>
        </ul>
        <p>Everything else — research, scoring, listings, briefs, economics, drafts — runs autonomously. The engine makes reasonable assumptions and acts rather than stalling, and it never asks you for information it can look up itself.</p>
        <div className="doc-note"><b>Scoring is deterministic.</b> Agents can&apos;t invent launch scores — they compute them with the platform&apos;s fixed model, so launch decisions are reproducible and auditable.</div>
      </section>

      <section id="tips" className="doc-section">
        <h2>8 · Tips &amp; FAQ</h2>
        <h3>A good operating rhythm</h3>
        <ul>
          <li><b>Morning:</b> CEO → &quot;write today&apos;s report,&quot; then clear the Approvals queue.</li>
          <li><b>Midday:</b> Product Hunter finds/scores; Finance validates margins.</li>
          <li><b>Launch push:</b> Store Builder → listing → ⚠ create store; Marketing → briefs; Advertising → ⚠ budget.</li>
          <li><b>Anytime:</b> CEO → &quot;recall the last reports&quot; to watch trends compound.</li>
        </ul>
        <h3>Why did an agent stop with &quot;awaiting approval&quot;?</h3>
        <p>It requested a gated action. Approve or reject it in the Approvals section — the rest of the task already ran.</p>
        <h3>Do agents remember past work?</h3>
        <p>Yes. Everything meaningful is written to Business Memory and recalled in later runs. Ask any agent to &quot;recall&quot; a topic.</p>
        <h3>Is my data saved?</h3>
        <p>Yes — the platform uses durable storage, so your operation persists 24/7.</p>
      </section>

      <div className="doc-cta">
        <button className="btn btn-accent" onClick={onBack}>Open the Command Deck</button>
        <a className="btn btn-ghost" href="#overview">Back to top</a>
      </div>
    </main>
  );
}
