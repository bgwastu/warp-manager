import React, { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { all, get, create, updateConfig, markError, remove } from "./db";
import { generateConfig, refreshConfig } from "./warp";

// ── Config ──
const REFRESH_INTERVAL = Number(process.env.REFRESH_INTERVAL || "6");
const PORT = Number(process.env.PORT || "8080");
const HOST = process.env.HOST || "0.0.0.0";
const PASSWORD = process.env.PASSWORD || "";

// ── Cookie helpers ──
function getCookie(c: string | null, name: string): string | null {
  if (!c) return null;
  for (const p of c.split(";")) {
    const eq = p.trim().indexOf("=");
    if (eq > 0 && p.trim().substring(0, eq) === name) return p.trim().substring(eq + 1);
  }
  return null;
}
function authed(req: Request): boolean {
  if (!PASSWORD) return true;
  return getCookie(req.headers.get("cookie"), "warp_auth") === "1";
}

// ── HTML shell ──
function Shell(children: ReactNode, opts?: { title?: string; scripts?: string }) {
  const title = opts?.title || "WARP Manager";
  const isLogin = title.includes("Login");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${esc(title)}</title>
<link rel="icon" href="https://www.cloudflare.com/favicon.ico"/>
<style>
:root{--bg:#fafbfc;--card:#fff;--elevated:#fff;--subtle:#f8fafc;--hover:#f1f5f9;--border:#e2e8f0;--bsub:#f1f5f9;--txt:#1e293b;--sec:#64748b;--muted:#94a3b8;--accent:#FF5F06;--a-hover:#E05500;--green:16 185 129;--red:239 68 68}
@media(prefers-color-scheme:dark){:root{--bg:#08090a;--card:#1a1d27;--elevated:#0f1011;--subtle:#111318;--hover:#1e2028;--border:#2a2d3a;--bsub:#1e2028;--txt:#f7f8f8;--sec:#94a3b8;--muted:#62666d}}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased;font-family:'Inter',system-ui,-apple-system,sans-serif}
body{min-height:100vh}
::selection{background:rgba(255,95,6,.15)}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--a-hover)}
.btn-pri{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:background .15s}
.btn-pri:hover{background:var(--a-hover)}
.btn-pri:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;color:var(--sec);border:none;border-radius:10px;font-size:13px;cursor:pointer;transition:background .15s}
.btn-ghost:hover{background:var(--hover);color:var(--txt)}
.btn-outline{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--card);color:var(--txt);border:1px solid var(--border);border-radius:10px;font-size:13px;cursor:pointer;transition:all .15s}
.btn-outline:hover{background:var(--hover);border-color:var(--muted)}
.card{border-radius:12px;border:1px solid var(--border);transition:all .15s}
.card-hover{cursor:pointer}.card-hover:hover{border-color:var(--muted);box-shadow:0 1px 4px rgba(0,0,0,.05)}
.modal-overlay{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.3);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:641px){.modal-overlay{align-items:center}}
.modal-content{width:100%;max-width:520px;background:var(--card);border-radius:16px 16px 0 0;box-shadow:0 8px 40px rgba(0,0,0,.15);max-height:90vh;overflow-y:auto;animation:slideUp .2s ease-out}
@media(min-width:641px){.modal-content{border-radius:16px;margin:0 12px}}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast-container{position:fixed;bottom:16px;right:16px;z-index:99;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:12px;border:1px solid;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.1);pointer-events:auto;max-width:360px;animation:fadeIn .2s ease-out}
.toast-success{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.toast-error{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.toast-info{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}
@media(prefers-color-scheme:dark){.toast-success{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.2);color:#6ee7b7}.toast-error{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.2);color:#fca5a5}.toast-info{background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.2);color:#93c5fd}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .2s ease-out}
.hidden{display:none!important}
input,textarea{width:100%;padding:10px 14px;font-size:14px;background:var(--card);color:var(--txt);border:1px solid var(--border);border-radius:10px;outline:none;transition:border .15s;font-family:inherit}
input:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;font-family:ui-monospace,monospace;font-size:13px}
label{display:block;font-size:13px;font-weight:500;color:var(--sec);margin-bottom:6px}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
code{background:var(--subtle);padding:1px 5px;border-radius:4px;font-size:12px}
pre code{background:none;padding:0}
@media(max-width:640px){.hide-mobile{display:none!important}}
</style>
</head>
<body>
<div id="root">${renderToString(<>{children}</>)}</div>
<script>
function toast(t,m,type){
  var c=document.getElementById('toasts'),el=document.createElement('div');
  el.className='toast toast-'+type+' fade-in';
  el.innerHTML='<div><strong>'+t+'</strong><br>'+m+'</div>';
  c.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove()},400)},4000);
}
function openModal(id){var m=document.getElementById(id);if(m){m.classList.remove('hidden');document.body.style.overflow='hidden'}}
function closeModal(id){var m=document.getElementById(id);if(m){m.classList.add('hidden');document.body.style.overflow=''}}
function onBgClick(e,id){if(e.target===e.currentTarget)closeModal(id)}
function copyText(t){navigator.clipboard.writeText(t).then(function(){toast('Copied','Copied to clipboard','success')})['catch'](function(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied','Copied to clipboard','success')})}
${isLogin ? "" : `
var __clients={};
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function showClient(id){
  var c=__clients[id];if(!c)return;
  var e=!!c.error;
  document.getElementById('dName').textContent=c.name;
  document.getElementById('dStatus').innerHTML='<span class="dot '+(e?'dot-red':'dot-green')+'"></span>'+(e?'Error':'Active');
  document.getElementById('dCreated').textContent=c.created_at?c.created_at.split(' ')[0]:'—';
  document.getElementById('dRefreshed').textContent=c.last_refreshed?c.last_refreshed.split(' ')[0]:'never';
  document.getElementById('dConfig').textContent=c.config||'';
  document.getElementById('dDownload').href='/api/clients/'+c.id+'/download';
  var rb=document.getElementById('dRefresh');
  rb.onclick=function(){
    rb.disabled=true;rb.textContent='Refreshing...';
    fetch('/api/clients/'+c.id+'/refresh',{method:'POST'}).then(function(r){return r.json()}).then(function(d){
      if(d.error)throw new Error(d.error);
      toast('Refreshed','Config updated','success');
      setTimeout(function(){location.reload()},1000);
    })['catch'](function(err){toast('Error',err.message,'error');rb.disabled=false;rb.textContent='Refresh'});
  };
  var db=document.getElementById('dDelete');
  db.onclick=function(){
    if(!confirm('Delete "'+c.name+'"?'))return;
    fetch('/api/clients/'+c.id,{method:'DELETE'}).then(function(r){return r.json()}).then(function(d){
      if(d.error)throw new Error(d.error);
      toast('Deleted','Client removed','success');closeModal('detailModal');
      setTimeout(function(){location.reload()},500);
    })['catch'](function(err){toast('Error',err.message,'error')});
  };
  if(e){document.getElementById('dError').classList.remove('hidden');document.getElementById('dErrorText').textContent=c.error}
  else document.getElementById('dError').classList.add('hidden');
  openModal('detailModal');
}
document.getElementById('genForm')?.addEventListener('submit',function(e){
  e.preventDefault();var btn=document.getElementById('genBtn'),fd=new FormData(e.target);
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating...';
  fetch('/api/clients',{method:'POST',body:fd}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Failed');return d})}).then(function(d){
    var h='<div class="fade-in">'+
      '<div class="toast-success toast" style="margin-bottom:16px"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><div><strong>'+esc(d.name)+'</strong> created</div></div>'+
      '<div style="display:flex;gap:8px;margin-bottom:16px">'+
        '<a href="/api/clients/'+d.id+'/download" class="btn-pri"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download .conf</a>'+
        '<button onclick="copyText('+JSON.stringify(d.config)+')" class="btn-outline"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638"/></svg> Copy</button>'+
      '</div>'+
      '<pre style="background:#0f172a;color:#e2e8f0;padding:16px;border-radius:12px;overflow:auto;max-height:280px;font-size:12px;line-height:1.6;font-family:ui-monospace,monospace">'+esc(d.config)+'</pre>'+
    '</div>';
    document.getElementById('resultData').innerHTML=h;
    closeModal('addModal');
    setTimeout(function(){openModal('resultModal')},200);
  })['catch'](function(err){toast('Error',err.message,'error')})['finally'](function(){btn.disabled=false;btn.innerHTML='Generate Config'});
});
`}
</script>
<div id="toasts" class="toast-container"></div>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── React Components ──

function LoginPage({ error }: { error?: string } = {}) {
  return Shell(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <img src="https://www.cloudflare.com/favicon.ico" alt="" style={{ width: "36px", height: "36px", marginBottom: "12px" }}/>
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>WARP Manager</h1>
          <p style={{ fontSize: "14px", color: "var(--sec)", marginTop: "4px" }}>Enter password to continue</p>
        </div>
        <form method="POST" action="/login" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px" }}>
          {error && <div className="toast toast-error" style={{ marginBottom: "16px" }}>{error}</div>}
          <div style={{ marginBottom: "16px" }}>
            <label>Password</label>
            <input type="password" name="password" required autoFocus placeholder="Enter password" style={{ background: "var(--bg)" }}/>
          </div>
          <button type="submit" className="btn-pri" style={{ width: "100%", justifyContent: "center", padding: "12px" }}>Continue</button>
        </form>
      </div>
    </div>,
    { title: "Login — WARP Manager" }
  );
}

function DashboardPage({ clients }: { clients: any[] }) {
  const hasClients = clients.length > 0;
  const clientsJson = JSON.stringify(Object.fromEntries(clients.map(c => [c.id, { id: c.id, name: c.name, status: c.status, error: c.error, created_at: c.created_at, last_refreshed: c.last_refreshed, config: c.config }])));
  const html = Shell(
    <>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--elevated)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="https://www.cloudflare.com/favicon.ico" alt="" style={{ width: "22px", height: "22px" }}/>
            <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>WARP Manager</span>
          </div>
          <button onclick="openModal('addModal')" className="btn-pri" style={{ fontSize: "13px"}}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            New Client
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        {!hasClients ? (
          <div className="fade-in" style={{ textAlign: "center", padding: "80px 16px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "var(--subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>No clients yet</h2>
            <p style={{ fontSize: "14px", color: "var(--sec)", marginBottom: "24px" }}>Add your first WARP client to get started.</p>
            <button onclick="openModal('addModal')" className="btn-pri">New Client</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <script>{`__clients=${clientsJson};`}</script>
            {clients.map(c => {
              const isErr = c.status === "error";
              return (
                <div key={c.id} onclick={`showClient(${c.id})`} className="card card-hover" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: isErr ? "#ef4444" : "#10b981", flexShrink: 0 }}></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--txt)" }}>{esc(c.name)}</span>
                        {isErr && <span style={{ fontSize: "10px", fontWeight: 500, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "1px 6px", borderRadius: "999px" }}>Error</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", gap: "12px", alignItems: "center" }}>
                        <span className="hide-mobile">Created {c.created_at ? esc(c.created_at.substring(0, 10)) : "—"}</span>
                        <span style={{ color: "var(--border)" }} className="hide-mobile">·</span>
                        <span>Refreshed {c.last_refreshed ? esc(c.last_refreshed.substring(0, 10)) : "never"}</span>
                      </div>
                    </div>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" stroke-width="2" style={{ flexShrink: 0 }}><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Modal */}
      <div id="addModal" className="modal-overlay hidden" onclick="onBgClick(event,'addModal')">
        <div className="modal-content" onclick="event.stopPropagation()">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600 }}>New Client</h2>
              <p style={{ fontSize: "12px", color: "var(--sec)", marginTop: "2px" }}>Generate a WARP WireGuard configuration</p>
            </div>
            <button onclick="closeModal('addModal')" style={{ padding: "6px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <form id="genForm" style={{ padding: "16px 24px 24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <label>Device Name</label>
              <input type="text" name="device_name" required placeholder="e.g. laptop, homeserver, phone"/>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ marginBottom: 0 }}>Teams JWT Token <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span></label>
                <button type="button" onclick="document.getElementById('jwtHelp').classList.toggle('hidden')" style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>How to get this?</button>
              </div>
              <textarea name="jwt" rows={2} placeholder="Paste JWT or leave empty for consumer WARP..."></textarea>
              <div id="jwtHelp" className="hidden" style={{ marginTop: "12px", background: "var(--subtle)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--accent)", marginBottom: "8px" }}>Getting your Teams JWT Token</p>
                {[
                  `Visit https://<span style="font-weight:600">YOUR_TEAM</span>.cloudflareaccess.com/warp`,
                  "Authenticate with your identity provider",
                  "Open browser DevTools (F12) → Console tab",
                  'Paste: <code>console.log(document.querySelector("meta[http-equiv=\'refresh\']").content.split("=")[2])</code>',
                  "Copy the output — that is your JWT token",
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--sec)", padding: "4px 0", borderBottom: i < 4 ? "1px solid var(--bsub)" : "none" }}>
                    <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(255,95,6,0.15)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span dangerouslySetInnerHTML={{ __html: s }}></span>
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" id="genBtn" className="btn-pri" style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: "20px" }}>Generate Config</button>
          </form>
        </div>
      </div>

      {/* Detail Modal */}
      <div id="detailModal" className="modal-overlay hidden" onclick="onBgClick(event,'detailModal')">
        <div className="modal-content" onclick="event.stopPropagation()">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div id="dStatus" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 500, color: "#166534", background: "rgba(16,185,129,0.1)", padding: "3px 10px", borderRadius: "999px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                Active
              </div>
              <h2 id="dName" style={{ fontSize: "15px", fontWeight: 600 }}></h2>
            </div>
            <button onclick="closeModal('detailModal')" style={{ padding: "6px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ padding: "16px 24px 24px" }}>
            <div id="dError" className="hidden" style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", marginBottom: "16px" }}>
              <span id="dErrorText"></span>
            </div>
            <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "var(--sec)", marginBottom: "16px" }}>
              <div><span style={{ color: "var(--muted)" }}>Created</span><br/><span id="dCreated" style={{ fontWeight: 500, color: "var(--txt)" }}></span></div>
              <div><span style={{ color: "var(--muted)" }}>Refreshed</span><br/><span id="dRefreshed" style={{ fontWeight: 500, color: "var(--txt)" }}></span></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              <a id="dDownload" href="#" className="btn-pri" style={{ fontSize: "13px" }}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download</a>
              <button id="dRefresh" className="btn-outline" style={{ fontSize: "13px" }}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg> Refresh</button>
              <button id="dDelete" className="btn-outline" style={{ fontSize: "13px", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg> Delete</button>
            </div>
            <div>
              <label style={{ marginBottom: "8px" }}>Configuration</label>
              <pre id="dConfig" style={{ background: "#0f172a", color: "#e2e8f0", padding: "16px", borderRadius: "12px", overflow: "auto", maxHeight: "240px", fontSize: "12px", lineHeight: "1.6", fontFamily: "ui-monospace,monospace" }}></pre>
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <div id="resultModal" className="modal-overlay hidden" onclick="onBgClick(event,'resultModal')">
        <div className="modal-content" onclick="event.stopPropagation()">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 12px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600 }}>Config Generated</h2>
            <button onclick="closeModal('resultModal')" style={{ padding: "6px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div id="resultData" style={{ padding: "16px 24px 24px" }}></div>
        </div>
      </div>
    </>,
    { title: "WARP Manager", scripts: "dashboard" }
  );
  // Inject clients data
  return html.replace("__clients={}", `__clients=${clientsJson}`);
}

// ── Background refresh ──
async function refreshAllClients() {
  const clients = all();
  if (!clients.length) return;
  for (const c of clients) {
    if (!c.cf_token || !c.device_id || !c.wg_private_key) continue;
    try {
      const config = refreshConfig(c.cf_token, c.device_id, c.wg_private_key);
      updateConfig(c.id, config);
      console.log(`[bg] Refreshed #${c.id} ${c.name}`);
    } catch (e: any) {
      markError(c.id, e.message);
      console.log(`[bg] Failed #${c.id} ${c.name}: ${e.message}`);
    }
  }
}

// ── Server ──
async function handleReq(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  // Auth check
  const needsAuth = !url.pathname.startsWith("/login") && !url.pathname.startsWith("/health");
  if (needsAuth && !authed(req)) {
    if (url.pathname.startsWith("/api/")) {
      return json(401, { error: "Unauthorized" });
    }
    return Response.redirect(`${url.origin}/login`, 302);
  }

  // Login page
  if (url.pathname === "/login" && method === "GET") {
    if (!PASSWORD || authed(req)) return Response.redirect(`${url.origin}/`, 302);
    return htmlResp(LoginPage());
  }

  // Login POST
  if (url.pathname === "/login" && method === "POST") {
    const form = await req.formData();
    if (form.get("password") === PASSWORD) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": "warp_auth=1; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax",
        },
      });
    }
    return htmlResp(LoginPage({ error: "Incorrect password" }));
  }

  // Dashboard
  if (url.pathname === "/" && method === "GET") {
    return htmlResp(DashboardPage({ clients: all() }));
  }

  // API: Create client
  if (url.pathname === "/api/clients" && method === "POST") {
    const form = await req.formData();
    const name = (form.get("device_name") || "").toString().trim();
    if (!name) return json(400, { error: "Device name is required" });
    const jwt = (form.get("jwt") || "").toString().trim() || undefined;
    try {
      const { config, cf_token, device_id, wg_private_key } = generateConfig(name, jwt);
      const id = create(name, device_id, cf_token, wg_private_key, config);
      return json(200, { id, name, config });
    } catch (e: any) {
      return json(400, { error: e.message });
    }
  }

  // API: Download config
  const downloadMatch = url.pathname.match(/^\/api\/clients\/(\d+)\/download$/);
  if (downloadMatch && method === "GET") {
    const client = get(parseInt(downloadMatch[1], 10));
    if (!client || !client.config) return new Response("Not found", { status: 404 });
    const filename = `warp-${client.name.replace(/\s+/g, "-").toLowerCase()}.conf`;
    return new Response(client.config, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  }

  // API: Refresh client
  const refreshMatch = url.pathname.match(/^\/api\/clients\/(\d+)\/refresh$/);
  if (refreshMatch && method === "POST") {
    const id = parseInt(refreshMatch[1], 10);
    const client = get(id);
    if (!client) return json(404, { error: "Client not found" });
    if (!client.cf_token || !client.device_id || !client.wg_private_key) {
      return json(400, { error: "Missing refresh credentials" });
    }
    try {
      const config = refreshConfig(client.cf_token, client.device_id, client.wg_private_key);
      updateConfig(id, config);
      return json(200, { success: true });
    } catch (e: any) {
      markError(id, e.message);
      return json(500, { error: e.message });
    }
  }

  // API: Delete client
  const deleteMatch = url.pathname.match(/^\/api\/clients\/(\d+)$/);
  if (deleteMatch && method === "DELETE") {
    remove(parseInt(deleteMatch[1], 10));
    return json(200, { success: true });
  }

  // Health
  if (url.pathname === "/health") return new Response("OK");

  return new Response("Not found", { status: 404 });
}

function json(status: number, data: any): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResp(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const server = Bun.serve({ port: PORT, hostname: HOST, fetch: handleReq });

// ── Background refresh ──
setInterval(() => refreshAllClients().catch(e => console.error("[bg]", e)), REFRESH_INTERVAL * 3600 * 1000);
setTimeout(() => { console.log("[bg] Initial refresh"); refreshAllClients().catch(e => console.error("[bg]", e)); }, 10000);

console.log(`[startup] WARP Manager on ${HOST}:${PORT}, refresh every ${REFRESH_INTERVAL}h${PASSWORD ? ", password auth" : ", no auth"}`);
