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
