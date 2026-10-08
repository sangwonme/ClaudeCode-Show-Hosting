#!/usr/bin/env node
// Lists listening TCP ports owned by the current user, writes a minimal HTML dashboard, opens it.
// Usage: node show-hosting.js [--all] [--no-open]
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch (e) { return e.stdout || ''; } };
const isWin = process.platform === 'win32';

function listeners() {
  const out = []; // {port, pid, addr}
  if (isWin) {
    for (const line of sh('netstat -ano').replace(/\r/g, '').split('\n')) {
      const m = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
      if (m) out.push({ addr: m[1], port: +m[2], pid: +m[3] });
    }
  } else {
    let pid;
    for (const line of sh('lsof -nP -iTCP -sTCP:LISTEN -Fpn').split('\n')) {
      if (line[0] === 'p') pid = +line.slice(1);
      const m = line[0] === 'n' && line.match(/^n(.*):(\d+)$/);
      if (m) out.push({ addr: m[1], port: +m[2], pid });
    }
  }
  return out;
}

function processes(pids) {
  const info = {}; // pid -> {name, cmd, cwd}
  if (isWin) {
    // CommandLine is null for other users' processes (services, System) unless elevated -> filtered out below.
    const json = sh('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress"');
    // keep all processes: project() walks up parents (e.g. venv launcher -> base python child that owns the port)
    for (const p of JSON.parse(json || '[]')) info[p.ProcessId] = { name: p.Name.replace(/\.exe$/i, ''), cmd: p.CommandLine, ppid: p.ParentProcessId };
  } else {
    for (const pid of pids) {
      const cmd = sh(`ps -o command= -p ${pid}`).trim();
      const cwd = (sh(`lsof -a -p ${pid} -d cwd -Fn`).match(/^n(.+)$/m) || [])[1];
      if (cmd) info[pid] = { name: path.basename(cmd.split(' ')[0]), cmd, cwd };
    }
  }
  return info;
}

// Best guess at "which project": cwd if known (mac/linux), else an absolute path in the command line
// (own or up to 2 parents), cut at node_modules / venv. The executable path itself only counts when cut.
const ENV_DIR = /[\\/](?:node_modules|site-packages|\.venv|venv|env)[\\/]/;
function project(info, pid) {
  if (info[pid].cwd && info[pid].cwd !== '/') return info[pid].cwd;
  for (let i = 0, p = info[pid]; i < 3 && p?.cmd; i++, p = info[p.ppid]) {
    const tokens = [...p.cmd.matchAll(/"([^"]+)"|(\S+)/g)].map((t) => t[1] || t[2]);
    for (const [j, t] of tokens.entries()) {
      if (!/^([A-Za-z]:[\\/]|\/)/.test(t)) continue;
      if (ENV_DIR.test(t)) return t.split(ENV_DIR)[0];
      if (j > 0) return path.dirname(t);
    }
  }
  return '';
}

// Dev servers / runtimes. Desktop apps (Steam, Drive, VS Code internals) are hidden unless --all.
const DEV = /^(node|bun|deno|python[\d.]*w?|uvicorn|gunicorn|flask|ruby|rails|php|java|go|dotnet|hugo|jekyll|caddy|nginx|httpd|ollama|jupyter.*|postgres|mysqld|mongod|redis-server|com\.docker\..*|docker.*|wslrelay|vpnkit)$/i;

async function probe(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(800), redirect: 'manual' });
    const html = (res.headers.get('content-type') || '').includes('html') ? await res.text() : '';
    return { http: true, title: (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || '' };
  } catch { return { http: false, title: '' }; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function render(rows) {
  const items = rows.map((r) => `
  <li>
    <div class="port">${r.port}</div>
    <div class="main">
      <div class="head"><b>${esc(r.title || path.basename(r.project) || r.name)}</b><span class="tag">${esc(r.name)} · pid ${r.pid}</span></div>
      ${r.project ? `<div class="proj">${esc(r.project)}</div>` : ''}
      <code title="${esc(r.cmd)}">${esc(r.cmd)}</code>
    </div>
    ${r.http ? `<a href="http://localhost:${r.port}" target="_blank">localhost:${r.port}</a>` : '<span class="nohttp">not http</span>'}
  </li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Show Hosting</title><style>
:root{--bg:#fafafa;--card:#fff;--fg:#111;--mute:#888;--line:#e5e5e5;--acc:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#111;--card:#1a1a1a;--fg:#eee;--mute:#888;--line:#2a2a2a;--acc:#60a5fa}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
main{max-width:900px;margin:40px auto;padding:0 16px}
h1{font-size:18px;font-weight:600;margin:0 0 4px}.sub{color:var(--mute);margin-bottom:20px}
ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
li{display:flex;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px}
.port{font:600 20px ui-monospace,monospace;min-width:64px}
.main{flex:1;min-width:0}.head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.tag,.proj,.nohttp{color:var(--mute);font-size:12px}
code{display:block;color:var(--mute);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
a{color:var(--acc);text-decoration:none;white-space:nowrap}a:hover{text-decoration:underline}
@media (max-width:600px){li{flex-wrap:wrap}}
</style></head><body><main>
<h1>Show Hosting</h1><div class="sub">${rows.length} port${rows.length === 1 ? '' : 's'} · ${esc(os.hostname())} · ${new Date().toLocaleString()}</div>
<ul>${items || '<li>Nothing listening.</li>'}</ul></main></body></html>`;
}

(async () => {
  const all = process.argv.includes('--all');
  const ls = listeners();
  const info = processes(new Set(ls.map((l) => l.pid)));
  const seen = new Set();
  const rows = ls
    .filter((l) => info[l.pid]?.cmd && (all || DEV.test(info[l.pid].name)) && !seen.has(l.port) && seen.add(l.port))
    .sort((a, b) => a.port - b.port)
    .map((l) => ({ ...l, ...info[l.pid], project: project(info, l.pid) }));
  await Promise.all(rows.map(async (r) => Object.assign(r, await probe(r.port))));

  const file = path.join(os.tmpdir(), 'show-hosting.html');
  fs.writeFileSync(file, render(rows));
  for (const r of rows) console.log(`${String(r.port).padEnd(6)} ${r.http ? `http://localhost:${r.port}`.padEnd(24) : 'not http'.padEnd(24)} ${r.name.padEnd(12)} ${r.project || r.cmd.slice(0, 80)}`);
  console.log(`\nDashboard: ${file}`);
  if (!process.argv.includes('--no-open')) sh(isWin ? `start "" "${file}"` : `${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${file}"`);
})();
