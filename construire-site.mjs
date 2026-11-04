// Construit la version autonome (GitHub Pages) à partir de table-de-saison.html.
// Usage : node construire-site.mjs   → écrit le dossier docs/
import fs from "node:fs";
import zlib from "node:zlib";

const SRC = "table-de-saison.html";
const OUT = "docs";
const FIREBASE = "10.12.2";
const page = fs.readFileSync(SRC, "utf8");
fs.mkdirSync(OUT, { recursive: true });
const version = Date.now().toString(36);

/* ---- Pont : remplace la synchro de Claude par Firebase (même interface claude.use("db") / claude.use("user")) ---- */
const shim = `
(function () {
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const cfg = window.FIREBASE_CONFIG;
  let ready = null;

  function askSetup() {
    return new Promise(resolve => {
      const box = document.createElement("div");
      box.className = "overlay";
      box.innerHTML = '<form class="sheet" id="syncSetup" style="max-width:460px">' +
        '<h2>Partager avec Anna</h2>' +
        '<p class="muted">Entre le code du foyer (le même sur vos deux téléphones) et ton prénom. Ils restent sur ce téléphone.</p>' +
        '<div class="field"><label for="sFoyer">Code du foyer</label><input type="text" id="sFoyer" autocomplete="off" autocapitalize="none" required></div>' +
        '<div class="field" style="margin-top:10px"><label for="sMe">Ton prénom</label><input type="text" id="sMe" autocomplete="given-name" maxlength="30" required></div>' +
        '<div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Activer le partage</button><button class="btn ghost" type="button" id="sLater">Plus tard</button></div></form>';
      document.body.appendChild(box);
      box.querySelector("#sLater").onclick = () => { box.remove(); put("tds:syncLater", "1"); resolve(false); };
      box.querySelector("form").onsubmit = e => {
        e.preventDefault();
        const f = box.querySelector("#sFoyer").value.trim(), m = box.querySelector("#sMe").value.trim();
        if (!f || !m) return;
        put("tds:foyer", f); put("tds:me", m); box.remove(); resolve(true);
      };
    });
  }
  async function setup() {
    if (!cfg || !window.firebase) return null;
    if (!get("tds:foyer") || !get("tds:me")) {
      if (get("tds:syncLater")) return null;
      if (!(await askSetup())) return null;
    }
    const foyer = get("tds:foyer"), me = get("tds:me");
    try {
      firebase.initializeApp(cfg);
      const fs = firebase.firestore();
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
      await firebase.auth().signInAnonymously();
      return { fs, foyer, me };
    } catch (e) { console.warn("Synchro indisponible", e); return null; }
  }
  const code = c => c === "resource-exhausted" ? "resource_exhausted" : c === "invalid-argument" ? "invalid_argument" : "unavailable";
  const err = e => cb => x => cb && cb({ code: code(x.code), message: x.message });
  function makeDb(s) {
    const base = "foyers/" + s.foyer + "/";
    const snap = d => ({ id: d.id, exists: d.exists, data: () => d.data(), metadata: d.metadata });
    // update : un niveau d'imbrication devient un chemin pointé (items.carotte), comme la fusion de Claude
    const flat = o => { const r = {}; for (const k in o) { const v = o[k]; if (v && typeof v === "object" && !Array.isArray(v)) for (const j in v) r[k + "." + j] = v[j]; else r[k] = v; } return r; };
    const doc = ref => ({ id: ref.id, path: ref.path, get: () => ref.get().then(snap), set: d => ref.set(d), update: d => ref.update(flat(d)), delete: () => ref.delete(),
      onSnapshot: (n, e) => ref.onSnapshot({ includeMetadataChanges: true }, d => n(snap(d)), err()(e)), collection: p => col(ref.collection(p)) });
    const qs = q => ({ docs: q.docs.map(snap), size: q.size, empty: q.empty, metadata: q.metadata, docChanges: () => q.docChanges() });
    const col = ref => ({ path: ref.path, doc: id => doc(id ? ref.doc(id) : ref.doc()), add: d => ref.add(d).then(doc),
      get: () => ref.get().then(qs), onSnapshot: (n, e) => ref.onSnapshot({ includeMetadataChanges: true }, q => n(qs(q)), err()(e)) });
    return { doc: p => doc(s.fs.doc(base + p)), collection: p => col(s.fs.collection(base + p)) };
  }
  window.claude = {
    use: async name => {
      const s = await (ready = ready || setup());
      if (!s) return null;
      if (name === "db") return makeDb(s);
      if (name === "user") return { id: async () => s.me, profiles: async ids => Object.fromEntries(ids.map(i => [i, { id: i, name: i }])), can: async () => true, isOwner: () => true };
      return null;
    }
  };
  window.addEventListener("load", () => {
    const p = document.createElement("p");
    p.className = "wrap small muted";
    p.style.paddingBlock = "0 40px";
    p.innerHTML = cfg ? 'Partage : <button class="btn ghost" id="syncReset">changer de prénom ou de code du foyer</button>' : "Partage avec Anna non configuré (voir LISEZMOI).";
    document.body.appendChild(p);
    const b = document.getElementById("syncReset");
    if (b) b.onclick = () => { ["tds:foyer", "tds:me", "tds:syncLater"].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); location.reload(); };
  });
  if ("serviceWorker" in navigator) {
    // une nouvelle version publiée remplace l'ancienne : on recharge une fois pour l'afficher tout de suite
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  }
})();
`;

const head = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2C6A43">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Table de saison">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icone-180.png">
<link rel="icon" href="icone-192.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-firestore-compat.js"></script>
<script src="config.js?v=${version}"></script>
<script>${shim}</script>
</head><body>
`;
fs.writeFileSync(`${OUT}/index.html`, head + page + "\n</body></html>\n");

if (!fs.existsSync(`${OUT}/config.js`)) fs.writeFileSync(`${OUT}/config.js`, `// Colle ici la configuration de ton projet Firebase (voir LISEZMOI.md), puis republie.
// Laisse null pour utiliser l'app sans partage.
window.FIREBASE_CONFIG = null;
`);

fs.writeFileSync(`${OUT}/manifest.webmanifest`, JSON.stringify({
  name: "Table de saison", short_name: "Table de saison", lang: "fr", start_url: "./", scope: "./", display: "standalone",
  background_color: "#EFF3EC", theme_color: "#2C6A43",
  icons: [{ src: "icone-192.png", sizes: "192x192", type: "image/png" }, { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }]
}, null, 2));

/* Service worker : l'app s'ouvre même sans réseau ; la page est rechargée depuis le réseau quand il y en a */
fs.writeFileSync(`${OUT}/sw.js`, `const C = "tds-${version}";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "index.html", "config.js", "manifest.webmanifest", "icone-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("googleapis.com") && !u.hostname.startsWith("fonts.")) return;
  const local = u.origin === location.origin;
  if (local && (e.request.mode === "navigate" || u.pathname.endsWith(".js") || u.pathname.endsWith(".html"))) {
    e.respondWith(fetch(e.request, { cache: "no-store" }).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  if (local || u.hostname === "www.gstatic.com" || u.hostname.startsWith("fonts.")) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; })));
  }
});
`);

/* ---- Icônes : une assiette sur fond vert sauge, avec une feuille ---- */
function png(size) {
  const S = 4, N = size * S, px = Buffer.alloc(size * size * 3);
  const bg = [44, 106, 67], plate = [251, 252, 249], rim = [226, 234, 223], leaf = [79, 127, 31];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const u = ((x * S + sx + 0.5) / N) - 0.5, v = ((y * S + sy + 0.5) / N) - 0.5;
      const r = Math.hypot(u, v);
      let c = bg;
      if (r < 0.33) c = r > 0.29 ? rim : plate;
      const a = Math.PI / 4, lu = (u * Math.cos(a) + v * Math.sin(a)), lv = (-u * Math.sin(a) + v * Math.cos(a));
      if ((lu / 0.17) ** 2 + (lv / 0.085) ** 2 < 1) c = leaf;
      if (Math.abs(lv) < 0.006 && Math.abs(lu) < 0.15) c = [124, 197, 150];
      acc = acc.map((s, i) => s + c[i]);
    }
    acc.forEach((s, i) => px[(y * size + x) * 3 + i] = Math.round(s / (S * S)));
  }
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3); }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) fs.writeFileSync(`${OUT}/icone-${s}.png`, png(s));
fs.writeFileSync(`${OUT}/.nojekyll`, "");
console.log("Site construit dans", OUT);
