// Configuration Supabase (la cle "anon" est publique par conception ; la securite est assuree par les regles de la base)
const SUPABASE_URL = "https://gqlfbaravnknajxhoabd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-CTgeHQP3Zx5fsdVas6dKw_G8cjWxBE";
const BUCKET = "cours";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fileUrl = (path, download) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}${download ? "?download=" : ""}`;
const ext = (name) => (String(name || "").split(".").pop() || "").slice(0, 4).toUpperCase() || "FICH";

function showMsg(el, text, type = "err") {
  el.className = "msg " + type;
  el.textContent = text;
  el.classList.remove("hidden");
}
