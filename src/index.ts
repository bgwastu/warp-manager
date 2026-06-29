import { Elysia } from "elysia";
import { all, get, create, updateConfig, markError, remove } from "./db";
import { generateConfig, refreshConfig } from "./warp";

const REFRESH_INTERVAL = Number(process.env.REFRESH_INTERVAL || "6");
const PORT = Number(process.env.PORT || "8080");
const HOST = process.env.HOST || "0.0.0.0";
const PASSWORD = process.env.PASSWORD || "";

declare namespace JSX { interface IntrinsicElements { [tag: string]: any; } type Element = string | number | null | undefined | (string | number | null | undefined)[]; }

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Shared client JS ────────────────────────────────────────────────────────
const CLIENT_JS = `
function toast(t,m,type){
  var c=document.getElementById('toasts'),el=document.createElement('div');
  var cl='anim-fade flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm pointer-events-auto';
  var ic='';
  if(type==='success'){cl+=' border-green-200 bg-green-50 text-green-800';ic='<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';}
  else if(type==='error'){cl+=' border-red-200 bg-red-50 text-red-800';ic='<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';}
  else{cl+=' border-blue-200 bg-blue-50 text-blue-800';ic='<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>';}
  el.className=cl;el.innerHTML=ic+'<div><p class="text-sm font-medium">'+t+'</p><p class="text-xs mt-0.5 opacity-80">'+msg+'</p></div>';
  c.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove()},300)},4000);
}
function openModal(id){var m=document.getElementById(id);if(m){m.classList.remove('hidden');m.classList.add('flex');document.body.style.overflow='hidden';}}
function closeModal(id){var m=document.getElementById(id);if(m){m.classList.add('hidden');m.classList.remove('flex');document.body.style.overflow='';}}
function onCloseClick(e,id){if(e.target===e.currentTarget)closeModal(id);}
function copyText(t){navigator.clipboard.writeText(t).then(function(){toast('Copied','Copied to clipboard','success');})['catch'](function(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied','Copied to clipboard','success');});}
function fm(t){if(!t)return'—';var d=dayjs(t.replace(' ','T'));var n=dayjs();if(n.diff(d,'hour')<24)return d.fromNow();return d.format('MMM D, YYYY h:mm A');}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
`;

// ── Login JS (no auth-dependent features) ──
const LOGIN_JS = `
document.addEventListener('DOMContentLoaded',function(){
  if(document.cookie.indexOf('warp_auth=1')>=0) window.location.href='/';
});
`;

// ── Dashboard JS (all interactive features) ──
function DASHBOARD_JS(): string { return `
${CLIENT_JS}
document.getElementById('genForm').addEventListener('submit',function(e){
  e.preventDefault();var btn=document.getElementById('genBtn'),txt=document.getElementById('genTxt'),sp=document.getElementById('genSp');
  btn.disabled=true;txt.classList.add('hidden');sp.classList.remove('hidden');
  var fd=new FormData(e.target);
  fetch('/api/clients',{method:'POST',body:fd}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Failed');return d;})}).then(function(d){
    var h='<div class="anim-fade">'+
      '<div class="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-3 mb-4"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><span class="text-sm font-medium">'+esc(d.name)+' created</span></div>'+
      '<div class="flex gap-2 mb-4">'+
        '<a href="/api/clients/'+d.id+'/download" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cf hover:bg-cf-dark text-white text-sm font-medium rounded-lg transition-colors"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download .conf</a>'+
        '<button onclick="copyText('+JSON.stringify(d.config)+')" class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[var(--border-default)] text-sm font-medium rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638"/></svg> Copy</button>'+
      '</div>'+
      '<pre class="text-xs leading-relaxed bg-[var(--text-code-bg)] text-[var(--text-code)] p-4 rounded-xl overflow-x-auto max-h-72 overflow-y-auto font-mono">'+esc(d.config)+'</pre>'+
    '</div>';
    document.getElementById('resultData').innerHTML=h;
    closeModal('addModal');
    setTimeout(function(){openModal('resultModal')},200);
  })['catch'](function(err){toast('Error',err.message,'error');})['finally'](function(){btn.disabled=false;txt.classList.remove('hidden');sp.classList.add('hidden');});
});
function showClient(id){
  var c=window.__clients&&window.__clients[id];if(!c)return;
  var isErr=c.status==='error';
  document.getElementById('detailName').textContent=c.name;
  document.getElementById('detailStatus').innerHTML='<span class="w-2 h-2 rounded-full '+(isErr?'bg-red-500':'bg-green-500')+'"></span><span>'+(isErr?'Error':'Active')+'</span>';
  document.getElementById('detailCreated').textContent=fm(c.created_at);
  document.getElementById('detailRefreshed').textContent=fm(c.last_refreshed);
  document.getElementById('detailConfig').textContent=c.config||'';
  document.getElementById('detailDownload').href='/api/clients/'+c.id+'/download';
  var rb=document.getElementById('detailRefresh');rb.onclick=function(){
    rb.disabled=true;rb.innerHTML='<span class="spinner"></span>';
    fetch('/api/clients/'+c.id+'/refresh',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
      if(d.error)throw new Error(d.error);
      toast('Refreshed','Config updated','success');
      setTimeout(function(){location.reload()},1000);
    })['catch'](function(err){toast('Error',err.message,'error');rb.disabled=false;rb.innerHTML='<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg> Refresh';});
  };
  var db=document.getElementById('detailDelete');db.onclick=function(){
    if(!confirm('Delete "'+c.name+'"?'))return;
    fetch('/api/clients/'+c.id,{method:'DELETE'}).then(function(r){return r.json();}).then(function(d){
      if(d.error)throw new Error(d.error);
      toast('Deleted','Client removed','success');closeModal('detailModal');
      setTimeout(function(){location.reload()},500);
    })['catch'](function(err){toast('Error',err.message,'error');});
  };
  if(isErr){document.getElementById('detailError').classList.remove('hidden');document.getElementById('detailErrorText').textContent=c.error||'';}
  else document.getElementById('detailError').classList.add('hidden');
  openModal('detailModal');
}
document.querySelectorAll('.js-time').forEach(function(el){var t=el.getAttribute('data-t');if(t)el.textContent=fm(t);});
`; }

// ── Page shell ──────────────────────────────────────────────────────────────
function Page(title: string, authed: boolean | undefined, error: string | undefined, children: string): string {
  const pwEnabled = !!PASSWORD;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"/>
<title>${esc(title)}</title>
<link rel="icon" href="https://www.cloudflare.com/favicon.ico" type="image/x-icon"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/plugin/relativeTime.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/plugin/calendar.js"></script>
<script>
dayjs.extend(dayjs_plugin_relativeTime);
dayjs.extend(dayjs_plugin_calendar);
tailwind.config={theme:{extend:{colors:{orange:{50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12'},cf:'#FF5F06','cf-dark':'#E05500','cf-light':'#FF7A2F',surface:'var(--bg-surface)','card-bg':'var(--bg-card)','card-border':'var(--border-default)','text-pri':'var(--text-primary)','text-sec':'var(--text-secondary)','text-muted':'var(--text-muted)'}}}};
</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg-surface:#fafbfc;--bg-card:#ffffff;--bg-elevated:#ffffff;--bg-subtle:#f8fafc;--bg-hover:#f1f5f9;--border-default:#e2e8f0;--border-subtle:#f1f5f9;--text-primary:#1e293b;--text-secondary:#64748b;--text-muted:#94a3b8}
@media(prefers-color-scheme:dark){:root{--bg-surface:#08090a;--bg-card:#1a1d27;--bg-elevated:#0f1011;--bg-subtle:#111318;--bg-hover:#1e2028;--border-default:#2a2d3a;--border-subtle:#1e2028;--text-primary:#f7f8f8;--text-secondary:#94a3b8;--text-muted:#62666d}}
html{background:var(--bg-surface);color:var(--text-primary);-webkit-font-smoothing:antialiased}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100vh}
::selection{background:rgba(255,95,6,0.15)}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--text-muted);border-radius:3px}
.anim-fade{animation:fadeIn .2s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@media(max-width:640px){.hide-mobile{display:none!important}}
@media(min-width:641px){.show-mobile{display:none!important}}
</style>
</head>
<body class="bg-[var(--bg-surface)] min-h-screen">
${error ? `<div class="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 text-red-700 text-sm px-4 py-3 text-center">${esc(error)}</div>` : ""}
${children}
<!-- toasts -->
<div id="toasts" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"></div>
<script>
${authed === false && pwEnabled ? LOGIN_JS : ""}
${authed !== false ? DASHBOARD_JS() : CLIENT_JS}
</script>
</body></html>`;
}

// ── Login page ──
function LoginPage(error?: string): string {
  return Page("Login — WARP Manager", false, undefined, `
<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm anim-fade">
    <div class="text-center mb-8">
      <img src="https://www.cloudflare.com/favicon.ico" alt="" class="w-10 h-10 mx-auto mb-3"/>
      <h1 class="text-xl font-semibold text-[var(--text-primary)]">WARP Manager</h1>
      <p class="text-sm text-[var(--text-secondary)] mt-1">Enter password to continue</p>
    </div>
    <form method="POST" action="/login" class="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-6">
      ${error ? `<div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-center gap-2"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>${esc(error)}</div>` : ""}
      <div class="mb-4">
        <label class="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Password</label>
        <input type="password" name="password" required autofocus placeholder="Enter password" class="w-full px-3.5 py-2.5 text-sm border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-cf/30 focus:border-cf transition-all"/>
      </div>
      <button type="submit" class="w-full py-2.5 bg-cf hover:bg-cf-dark text-white text-sm font-medium rounded-xl transition-colors">Continue</button>
    </form>
  </div>
</div>`);
}

// ── Dashboard ──
function Dashboard(clients: any[]): string {
  const hasClients = clients.length > 0;
  const clientsSafe = clients.map(c => ({id: c.id, name: c.name, status: c.status, error: c.error, created_at: c.created_at, last_refreshed: c.last_refreshed, config: c.config}));
  const clientsJson = JSON.stringify(Object.fromEntries(clientsSafe.map(c => [c.id, c])));

  return Page("WARP Manager", true, undefined, `
<script>window.__clients=${clientsJson};</script>

<!-- Header -->
<header class="sticky top-0 z-40 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-default)]/60">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
    <div class="flex items-center gap-2.5">
      <img src="https://www.cloudflare.com/favicon.ico" alt="" class="w-6 h-6 sm:w-7 sm:h-7"/>
      <span class="text-sm sm:text-base font-semibold text-[var(--text-primary)] tracking-tight">WARP Manager</span>
    </div>
    <button onclick="openModal('addModal')" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cf hover:bg-cf-dark text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
      <span class="hidden sm:inline">New Client</span>
    </button>
  </div>
</header>

<!-- Main -->
<main class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
${!hasClients ? `
<div class="anim-fade flex flex-col items-center justify-center py-20 text-center">
  <div class="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-5">
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#FF5F06" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
  </div>
  <h2 class="text-lg font-semibold text-[var(--text-primary)] mb-1">No clients yet</h2>
  <p class="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">Add your first WARP client to generate and manage WireGuard configurations.</p>
  <button onclick="openModal('addModal')" class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-cf hover:bg-cf-dark text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
    Add Client
  </button>
</div>` : `
<div class="grid gap-3">
${clients.map(c => {
  const isErr = c.status === "error";
  return `<div onclick="showClient(${c.id})" class="anim-fade bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)]/80 hover:border-[var(--border-default)]/80 shadow-sm hover:shadow-md px-4 sm:px-5 py-4 cursor-pointer transition-all duration-150 active:scale-[0.99]">
    <div class="flex items-center gap-3 sm:gap-4">
      <div class="shrink-0"><div class="w-3 h-3 rounded-full ${isErr ? 'bg-red-500' : 'bg-green-500'}"></div></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate">${esc(c.name)}</h3>
          ${isErr ? `<span class="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">Error</span>` : ""}
        </div>
        <div class="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
          <span><span class="hide-mobile">Created </span><span class="js-time" data-t="${c.created_at || ''}">${c.created_at ? esc(c.created_at.substring(0, 10)) : '—'}</span></span>
          <span class="text-gray-200">·</span>
          <span><span class="hide-mobile">Refreshed </span><span class="js-time" data-t="${c.last_refreshed || ''}">${c.last_refreshed ? esc(c.last_refreshed.substring(0, 10)) : 'never'}</span></span>
        </div>
      </div>
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" stroke-width="2" class="shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
    </div>
  </div>`;
}).join("\n")}
</div>`}
</main>

<!-- Add Modal -->
<div id="addModal" class="fixed inset-0 z-50 hidden items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px]" onclick="onCloseClick(event,'addModal')">
  <div class="w-full sm:max-w-lg bg-[var(--bg-card)] sm:rounded-2xl rounded-t-2xl shadow-2xl anim-fade sm:mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
      <div>
        <h2 class="text-base font-semibold text-[var(--text-primary)]">New Client</h2>
        <p class="text-xs text-[var(--text-secondary)] mt-0.5">Generate a WARP WireGuard configuration</p>
      </div>
      <button onclick="closeModal('addModal')" class="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <form id="genForm" class="px-5 py-4 space-y-4">
      <div>
        <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Device Name</label>
        <input type="text" name="device_name" required placeholder="e.g. laptop, homeserver, phone" class="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] placeholder-gray-400 outline-none focus:border-cf focus:ring-2 focus:ring-cf/20 transition-all"/>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Teams JWT Token <span class="text-[var(--text-muted)] font-normal">(optional)</span></label>
          <button type="button" onclick="document.getElementById('jwtHelp').classList.toggle('hidden')" class="text-xs text-cf hover:text-cf-dark transition-colors">How to get this?</button>
        </div>
        <textarea name="jwt" rows="2" placeholder="Paste JWT here or leave empty for consumer WARP..." class="w-full px-3.5 py-2.5 text-sm font-mono bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] placeholder-gray-400 outline-none focus:border-cf focus:ring-2 focus:ring-cf/20 transition-all resize-none"></textarea>
        <div id="jwtHelp" class="hidden mt-3">
          <div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div class="text-xs font-medium text-orange-800 mb-2 flex items-center gap-1.5"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>Getting your Teams JWT</div>
            ${[
              ['Visit your Cloudflare Zero Trust portal', 'https://<YOUR_TEAM>.cloudflareaccess.com/warp'],
              ['Authenticate with your identity provider', ''],
              ['Open browser DevTools (F12 or Ctrl+Shift+I) → Console', ''],
              ['Paste this in the console:', "console.log(document.querySelector('meta[http-equiv=\"refresh\"]').content.split('=')[2])"],
              ['Copy the output — that is your JWT token', ''],
            ].map((s, i) => `<div class="flex gap-2.5 text-xs text-orange-700 py-1.5 ${i < 4 ? 'border-b border-orange-200/50' : ''}"><span class="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-orange-200/50 text-orange-600 text-[10px] font-bold">${i+1}</span><span>${s[0]}${s[1] ? '<br><code class="inline-block mt-0.5 text-orange-800 bg-orange-100/50 px-1.5 py-0.5 rounded text-[11px]">'+esc(s[1])+'</code>' : ''}</span></div>`).join('')}
            <button type="button" onclick="copyText('console.log(document.querySelector(\\'meta[http-equiv=\\'+\\'refresh\\'+\\'\\']\\').content.split(\\'=\\')[2])')" class="mt-2 text-xs text-orange-600 hover:text-orange-800 transition-colors font-medium">Copy script</button>
          </div>
        </div>
      </div>
      <button type="submit" id="genBtn" class="w-full py-2.5 bg-cf hover:bg-cf-dark active:bg-cf-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
        <span id="genTxt">Generate Config</span>
        <span id="genSp" class="hidden"><span class="spinner -ml-1 mr-2 align-middle"></span> Generating...</span>
      </button>
    </form>
  </div>
</div>

<!-- Detail Modal -->
<div id="detailModal" class="fixed inset-0 z-50 hidden items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px]" onclick="onCloseClick(event,'detailModal')">
  <div class="w-full sm:max-w-lg bg-[var(--bg-card)] sm:rounded-2xl rounded-t-2xl shadow-2xl anim-fade sm:mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
      <div class="flex items-center gap-3 min-w-0">
        <div id="detailStatus" class="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full"><span class="w-2 h-2 rounded-full bg-green-500"></span><span>Active</span></div>
        <h2 id="detailName" class="text-base font-semibold text-[var(--text-primary)] truncate"></h2>
      </div>
      <button onclick="closeModal('detailModal')" class="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] shrink-0 ml-2">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="px-5 py-4 space-y-4">
      <div class="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span><span class="text-[var(--text-muted)]">Created</span><br><span id="detailCreated" class="text-[var(--text-primary)] font-medium"></span></span>
        <span><span class="text-[var(--text-muted)]">Refreshed</span><br><span id="detailRefreshed" class="text-[var(--text-primary)] font-medium"></span></span>
      </div>
      <div id="detailError" class="hidden bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-start gap-2">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="shrink-0 mt-0.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        <span id="detailErrorText"></span>
      </div>
      <div class="flex flex-wrap gap-2">
        <a id="detailDownload" href="#" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cf hover:bg-cf-dark text-white text-sm font-medium rounded-xl transition-colors shadow-sm"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download</a>
        <button id="detailRefresh" class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[var(--border-default)] hover:bg-[var(--bg-subtle)] text-sm font-medium rounded-xl transition-colors text-[var(--text-primary)]"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg> Refresh</button>
        <button id="detailDelete" class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors text-red-600"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg> Delete</button>
      </div>
      <div>
        <label class="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Configuration</label>
        <pre id="detailConfig" class="text-xs leading-relaxed bg-[var(--text-code-bg)] text-[var(--text-code)] p-4 rounded-xl overflow-x-auto max-h-60 overflow-y-auto font-mono select-all"></pre>
      </div>
    </div>
  </div>
</div>

<!-- Result Modal -->
<div id="resultModal" class="fixed inset-0 z-50 hidden items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px]" onclick="onCloseClick(event,'resultModal')">
  <div class="w-full sm:max-w-lg bg-[var(--bg-card)] sm:rounded-2xl rounded-t-2xl shadow-2xl anim-fade sm:mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
      <h2 class="text-base font-semibold text-[var(--text-primary)]">Config Generated</h2>
      <button onclick="closeModal('resultModal')" class="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="px-5 py-4" id="resultData"></div>
  </div>
</div>`);
}

// ── Auth middleware ──
function authed(req: any): boolean {
  if (!PASSWORD) return true;
  const cookie = req?.headers?.cookie || req?.cookie?.warp_auth?.value || "";
  return cookie.split(";").some((c: string) => c.trim() === "warp_auth=1");
}

// ── Routes ──
const app = new Elysia()
  .onAfterHandle(({ response, set }: any) => {
    if (typeof response === "string" && !set.headers?.["Content-Type"]) {
      set.headers = { ...(set.headers || {}), "Content-Type": "text/html; charset=utf-8" };
    }
  })
  .get("/login", ({ cookie: { warp_auth }, set, headers }: any) => {
    if (!PASSWORD || authed({ headers, cookie: { warp_auth } })) { set.redirect = "/"; return; }
    return LoginPage();
  })
  .post("/login", ({ body, cookie: { warp_auth }, set }: any) => {
    if (body?.password === PASSWORD) {
      if (warp_auth?.set) warp_auth.set({ value: "1", path: "/", maxAge: 86400 * 7 });
      set.redirect = "/";
      return;
    }
    return LoginPage("Incorrect password");
  })
  .get("/", ({ cookie: { warp_auth }, set, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) { set.redirect = "/login"; return; }
    return Dashboard(all());
  })
  .post("/api/clients", async ({ body, set, cookie: { warp_auth }, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) { set.status = 401; return { error: "Unauthorized" }; }
    const name = (body?.device_name || "").trim();
    if (!name) { set.status = 400; return { error: "Device name is required" }; }
    const jwt = (body?.jwt || "").trim() || undefined;
    try {
      const { config, cf_token, device_id, wg_private_key } = generateConfig(name, jwt);
      const id = create(name, device_id, cf_token, wg_private_key, config);
      return { id, name, config };
    } catch (e: any) {
      set.status = 400;
      return { error: e.message };
    }
  })
  .get("/api/clients/:id/download", ({ params: { id: idStr }, set, cookie: { warp_auth }, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) { set.status = 401; return "Unauthorized"; }
    const client = get(parseInt(idStr, 10));
    if (!client || !client.config) { set.status = 404; return "Not found"; }
    const filename = `warp-${client.name.replace(/\s+/g, "-").toLowerCase()}.conf`;
    set.headers = { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="${filename}"` };
    return client.config;
  })
  .post("/api/clients/:id/refresh", ({ params: { id: idStr }, set, cookie: { warp_auth }, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) { set.status = 401; return { error: "Unauthorized" }; }
    const id = parseInt(idStr, 10);
    const client = get(id);
    if (!client) { set.status = 404; return { error: "Client not found" }; }
    if (!client.cf_token || !client.device_id || !client.wg_private_key) {
      set.status = 400; return { error: "Missing refresh credentials (consumer WARP cannot be refreshed)" };
    }
    try {
      const config = refreshConfig(client.cf_token, client.device_id, client.wg_private_key);
      updateConfig(id, config);
      return { success: true };
    } catch (e: any) {
      markError(id, e.message);
      set.status = 500; return { error: e.message };
    }
  })
  .delete("/api/clients/:id", ({ params: { id: idStr }, set, cookie: { warp_auth }, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) { set.status = 401; return { error: "Unauthorized" }; }
    remove(parseInt(idStr, 10));
    return { success: true };
  })
  .post("/api/refresh-all", ({ cookie: { warp_auth }, headers }: any) => {
    if (!authed({ headers, cookie: { warp_auth } })) return { error: "Unauthorized" };
    refreshAllClients();
    return { success: true };
  })
  .get("/health", () => "OK");

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

setInterval(() => refreshAllClients().catch(e => console.error("[bg]", e)), REFRESH_INTERVAL * 3600 * 1000);
setTimeout(() => { console.log("[bg] Initial refresh"); refreshAllClients().catch(e => console.error("[bg]", e)); }, 10000);

app.listen({ hostname: HOST, port: PORT });
console.log(`[startup] WARP Manager on ${HOST}:${PORT}, refresh every ${REFRESH_INTERVAL}h${PASSWORD ? ', password auth' : ', no auth'}`);
