/* =====================================================================
   STI2D : outils des pages publiques (accueil, ressources, entraide…)
   Léger : aucun framework, appels directs à l'API Supabase (clé publique).
   La sécurité est assurée par la base (fonctions public_* / forum_* …).
   ===================================================================== */
const SUPA_URL = "https://gqlfbaravnknajxhoabd.supabase.co";             // identiques a assets/common.js
const SUPA_KEY = "sb_publishable_-CTgeHQP3Zx5fsdVas6dKw_G8cjWxBE";
const VAPID_KEY = "BGBmquk4sr70sczEhpywKEQro7bAXbg-ep1amWDY0glzdfje-YwVUgO0qJY21ezEMTg2pBqejQJV6T_4sr5dkg8";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fmtSize = (b) => b == null ? "" : b < 1024 ? b + " o" : b < 1048576 ? Math.round(b / 1024) + " Ko" : (b / 1048576).toFixed(1).replace(".", ",") + " Mo";
const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return "il y a " + Math.max(1, Math.round(s / 60)) + " min";
  if (s < 86400) return "il y a " + Math.round(s / 3600) + " h";
  if (s < 86400 * 30) return "il y a " + Math.round(s / 86400) + " j";
  return "le " + fmtDate(d);
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// « Voir le site en tant que visiteur » (lien depuis l'administration) : aucun droit professeur sur ces pages
const VISITOR = (() => {
  try {
    if (new URLSearchParams(location.search).has("visiteur")) sessionStorage.setItem("visiteur", "1");
    return sessionStorage.getItem("visiteur") === "1";
  } catch (e) { return false; }
})();
// Jeton du professeur connecté (même navigateur que la page Administration), sinon null
function adminToken() {
  if (VISITOR) return null;
  try {
    const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x)); if (!k) return null;
    const s = JSON.parse(localStorage.getItem(k));
    return s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 ? s.access_token : null;
  } catch (e) { return null; }
}
const headers = (extra = {}) => ({ apikey: SUPA_KEY, Authorization: "Bearer " + (adminToken() || SUPA_KEY), ...extra });

// Appel d'une fonction de la base -> données, ou exception avec un message lisible
async function rpc(fn, args = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(args) });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) {
    const m = (data && (data.message || data.error)) || "erreur " + r.status;
    throw new Error(/JWT|token/i.test(m) ? "session expirée, rechargez la page" : m);
  }
  return data;
}
// Lien temporaire (15 min) vers un fichier du stockage prive, apres autorisation par la base
async function signFile(bucket, path, downloadName) {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
    { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: 900 }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.signedURL) throw new Error(d.message || "fichier indisponible");
  return `${SUPA_URL}/storage/v1${d.signedURL}${downloadName ? "&download=" + encodeURIComponent(downloadName) : ""}`;
}
const forumUrl = (path) => `${SUPA_URL}/storage/v1/object/public/forum/${path.split("/").map(encodeURIComponent).join("/")}`;
async function uploadForum(path, file) {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/forum/${path.split("/").map(encodeURIComponent).join("/")}`,
    { method: "POST", headers: headers({ "Content-Type": file.type, "x-upsert": "false", "cache-control": "max-age=31536000" }), body: file });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "envoi impossible"); }
}

// ---------- Vocabulaire ----------
const NIVEAU = { "1ere": "Première", term: "Terminale", both: "Première & Terminale" };
const RTYPE = {
  cours: ["📘", "Cours"], resume: ["📝", "Résumé"], essentiel: ["⭐", "L'essentiel"], exercices: ["✏️", "Exercices"],
  corriges: ["✅", "Exercices corrigés"], annale: ["🎓", "Annale"], qcm: ["☑️", "QCM"], video: ["▶️", "Vidéo"],
  document: ["📎", "Document"], autre: ["📂", "Ressource"],
};
const RTYPE_PLURAL = { cours: "Cours", resume: "Résumés", essentiel: "L'essentiel", exercices: "Exercices", corriges: "Exercices corrigés",
  annale: "Annales", qcm: "QCM", video: "Vidéos", document: "Documents", autre: "Autres ressources" };
const FAMILY = { maths: "Mathématiques", pc: "Physique-chimie", techno: "Enseignements technologiques", autre: "Autres" };
const typeOf = (it) => it.type || (it.kind === "qcm" ? "qcm" : it.kind === "memo" ? "essentiel" : it.video || it.video_url ? "video" : "document");
const familyOf = (s) => s && (s.family || (/^math/i.test(s.name) ? "maths" : /^(physique|chimie)/i.test(s.name) ? "pc" : "autre"));
const niveauMatch = (it, n) => !n || it.niveau === n || it.niveau === "both";

function resCard(it, subjects = []) {
  const t = typeOf(it), [ico, lbl] = RTYPE[t] || RTYPE.autre, sub = subjects.find(s => s.id === it.subject_id);
  const extra = it.kind === "qcm" && it.questions ? `${it.questions} question(s)` : it.kind === "memo" && it.cards ? `${it.cards} carte(s)` : it.year ? "Session " + it.year : "";
  return `<a class="rc" href="ressource.html?id=${it.id}">
    <span class="rc-ico t-${t}">${ico}</span>
    <span class="rc-body"><span class="rc-meta"><b>${esc(lbl)}</b>${it.niveau ? " · " + esc(NIVEAU[it.niveau]) : ""}${sub ? " · " + esc(sub.name) : ""}</span>
      <span class="rc-title">${esc(it.title)}</span>
      ${it.excerpt ? `<span class="rc-ex">${esc(it.excerpt)}</span>` : ""}
      ${extra ? `<span class="rc-ex small">${esc(extra)}</span>` : ""}</span></a>`;
}

// ---------- Élève connecté sur cet appareil (espace élève) ----------
function savedStudent() { try { return JSON.parse(store.get("eleve") || "null"); } catch (e) { return null; } }

// ---------- Images : réduction avant envoi (forum) ----------
async function shrinkImage(f, maxDim = 1600, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || typeof createImageBitmap !== "function") return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 900 * 1024) return f;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", quality));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch (e) { return f; }
}

// ---------- Installation (PWA) et notifications « nouveautés » ----------
const isStandaloneApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOSDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const swReg = "serviceWorker" in navigator ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null) : Promise.resolve(null);
function b64u(s) { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function newsPushState() {
  if (!pushOK()) return isIOSDevice() && !isStandaloneApp() ? "ios" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (store.get("newsPush") === "1" && Notification.permission === "granted") return "on";
  return "off";
}
async function newsPushOn() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("notifications refusées : autorisez-les dans les réglages du navigateur");
  const reg = await swReg; if (!reg) throw new Error("service indisponible sur ce navigateur");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_KEY) });
  await rpc("public_push_subscribe", { p_sub: sub.toJSON(), p_ua: navigator.userAgent });
  store.set("newsPush", "1");
}
async function newsPushOff() {
  const reg = await swReg; const sub = reg && await reg.pushManager.getSubscription();
  if (sub) await rpc("public_push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
  store.del("newsPush");
}

// En-tête commun : année du pied de page
document.addEventListener("DOMContentLoaded", () => { const y = $("#y"); if (y) y.textContent = new Date().getFullYear(); });
