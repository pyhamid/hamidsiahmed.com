// Configuration Supabase (la cle publique est faite pour le navigateur ; la securite est assuree par les regles de la base)
const SUPABASE_URL = "https://gqlfbaravnknajxhoabd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-CTgeHQP3Zx5fsdVas6dKw_G8cjWxBE";
const BUCKET = "cours";
const RENDUS = "rendus";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fmtDT = (d) => new Date(d).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fileUrl = (path, download) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}${download ? "?download=" : ""}`;
const ext = (name) => (String(name || "").split(".").pop() || "").slice(0, 4).toUpperCase() || "FICH";
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join(""));
const safeName = (n) => (String(n || "fichier").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_") || "fichier").slice(0, 80);
const KIND = { doc: "Document", devoir: "Devoir", qcm: "QCM" };
const isImgName = (n) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(n || ""));
const fmtSize = (b) => b == null ? "" : b < 1024 ? b + " o" : b < 1048576 ? Math.round(b / 1024) + " Ko" : (b / 1048576).toFixed(1).replace(".", ",") + " Mo";
// Lien temporaire (15 min) vers un fichier du bucket prive "cours"
async function signedUrl(path, downloadName) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 900, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

function showMsg(el, text, type = "err") {
  if (!el) return;
  el.className = "msg " + type;
  el.textContent = text;
  el.classList.remove("hidden");
}

// ---------- Apercu integre (PDF / image) ----------
function preview(url, name) {
  let m = $("#viewer");
  if (!m) {
    m = document.createElement("div");
    m.id = "viewer"; m.className = "modal";
    m.innerHTML = `<div class="modal-box wide"><div class="row modal-head"><b id="vTitle"></b><div class="spacer"></div>
      <a id="vDl" class="btn sm ghost" target="_blank" rel="noopener">Ouvrir dans un onglet</a>
      <button class="btn sm ghost" id="vClose">Fermer ✕</button></div><div id="vBody" class="viewer-body"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m) closePreview(); });
    $("#vClose").addEventListener("click", closePreview);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePreview(); });
  }
  $("#vTitle").textContent = name || "";
  $("#vDl").href = url;
  const low = String(name || url).toLowerCase();
  const isImg = /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/.test(low);
  $("#vBody").innerHTML = isImg ? `<img src="${esc(url)}" alt="">` : `<iframe src="${esc(url)}" title="Aperçu"></iframe>`;
  m.classList.add("open"); document.body.style.overflow = "hidden";
}
function closePreview() { const m = $("#viewer"); if (m) { m.classList.remove("open"); $("#vBody").innerHTML = ""; document.body.style.overflow = ""; } }

function openModal(html, wide) {
  let m = $("#modal");
  if (!m) {
    m = document.createElement("div"); m.id = "modal"; m.className = "modal";
    m.innerHTML = `<div class="modal-box"></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m && !m.firstElementChild.classList.contains("qcmbox")) closeModal(); });
  }
  const box = m.firstElementChild;
  box.className = "modal-box" + (wide === true ? " wide" : wide ? " " + wide : "");
  box.innerHTML = html;
  m.classList.add("open"); document.body.style.overflow = "hidden";
  return box;
}
function closeModal() { const m = $("#modal"); if (m) { m.classList.remove("open"); document.body.style.overflow = ""; } }

// ================= 🔔 Notifications sur téléphone / ordinateur (Web Push) =================
// Cle PUBLIQUE VAPID (la cle privee est uniquement dans les secrets Supabase, jamais ici)
const VAPID_PUBLIC_KEY = "BGBmquk4sr70sczEhpywKEQro7bAXbg-ep1amWDY0glzdfje-YwVUgO0qJY21ezEMTg2pBqejQJV6T_4sr5dkg8";
const NOTIFY_URL = SUPABASE_URL + "/functions/v1/notify";
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const swReady = "serviceWorker" in navigator ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null) : Promise.resolve(null);
function b64uToBytes(s) { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); }
// Abonnement deja actif sur cet appareil ? (null sinon)
async function pushCurrent() {
  if (!pushSupported() || Notification.permission !== "granted") return null;
  const reg = await swReady; if (!reg) return null;
  return reg.pushManager.getSubscription();
}
// Demande l'autorisation puis abonne cet appareil ; renvoie l'abonnement (JSON) a enregistrer dans la base
async function pushSubscribe() {
  if (!pushSupported()) throw new Error(isIOS() && !isStandalone() ? "sur iPhone, ajoutez d'abord le site à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvrez-le depuis l'icône" : "ce navigateur ne gère pas les notifications");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("notifications refusées : autorisez-les dans les réglages du navigateur pour ce site");
  const reg = await swReady; if (!reg) throw new Error("service worker indisponible");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC_KEY) });
  return sub.toJSON();
}
async function pushUnsubscribe() {
  const sub = await pushCurrent(); if (!sub) return;
  try { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); } catch (e) {}
  await sub.unsubscribe();
}
