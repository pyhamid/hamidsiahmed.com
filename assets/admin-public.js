/* =====================================================================
   Administration v7 : site public (STI2D.ORG)
   - bloc « Site public / droits » dans Publier et Modifier
   - onglets : 🌐 Site public · 🙋 Entraide · 📨 Demandes · 📰 Newsletter
   Chargé APRÈS le script principal d'admin.html (réutilise S, sb, q, $, esc…).
   Les onglets Entraide / Demandes / Newsletter ne chargent leurs données qu'à l'ouverture.
   ===================================================================== */
const RT = { cours: "📘 Cours", resume: "📝 Résumé", essentiel: "⭐ L'essentiel", exercices: "✏️ Exercices", corriges: "✅ Exercices corrigés",
  annale: "🎓 Annale", qcm: "☑️ QCM", video: "▶️ Vidéo", document: "📎 Document", autre: "📂 Autre" };
const NIV = { "1ere": "Première", term: "Terminale", both: "Première & Terminale" };
const FAM = { maths: "Mathématiques", pc: "Physique-chimie", techno: "Enseignements technologiques", autre: "Autres" };
const autoType = it => it.resource_type || (it.kind === "qcm" ? "qcm" : it.kind === "memo" ? "essentiel" : it.video_url ? "video" : "document");
const panel = n => $(`[data-panel="${n}"]`);
const visible = n => !panel(n).classList.contains("hidden");

// ================= Bloc « Site public & droits » (Publier / Modifier) =================
function drawPubBlock(el, x, it) {
  if (!el) return;
  const pub = !!it.is_public;
  el.innerHTML = `<div class="card" style="background:var(--bg);padding:14px">
    <div><label>Vidéo <span class="muted small">(lien YouTube / Vimeo, facultatif)</span></label><input type="text" id="${x}_Video" value="${esc(it.video_url || "")}" placeholder="https://www.youtube.com/watch?v=…"></div>
    <div class="row" style="margin-top:10px;gap:8px 18px">
      <label class="inline"><input type="checkbox" id="${x}_Dl" style="width:auto" ${it.allow_download !== false ? "checked" : ""}> ⬇ Téléchargement autorisé</label>
      <label class="inline"><input type="checkbox" id="${x}_Print" style="width:auto" ${it.allow_print !== false ? "checked" : ""}> 🖨 Impression autorisée</label>
    </div>
    <div class="hint">Téléchargement / impression : s'appliquent sur le site public <b>et</b> dans l'espace élève (protection dissuasive : une capture d'écran reste possible).</div>
    <label class="inline" style="margin-top:12px;font-weight:700;align-items:flex-start"><input type="checkbox" id="${x}_Pub" style="width:auto;margin-top:4px" ${pub ? "checked" : ""}> <span>🌐 Publier sur le site public <span class="muted small" style="font-weight:500">(accès libre, sans inscription)</span></span></label>
    <div id="${x}_PubOpts" class="${pub ? "" : "hidden"}" style="margin-top:10px">
      <div class="grid3">
        <div><label>Niveau</label><select id="${x}_Niv"><option value="">—</option>${Object.entries(NIV).map(([k, v]) => `<option value="${k}" ${it.niveau === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>Type de ressource</label><select id="${x}_Type"><option value="">Automatique</option>${Object.entries(RT).map(([k, v]) => `<option value="${k}" ${it.resource_type === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div id="${x}_YearBox" class="${it.resource_type === "annale" ? "" : "hidden"}"><label>Année (annale)</label><input type="number" id="${x}_Year" min="1990" max="2100" value="${it.annale_year || ""}" placeholder="${new Date().getFullYear()}"></div>
      </div>
      <label class="inline" style="margin-top:8px"><input type="checkbox" id="${x}_Feat" style="width:auto" ${it.featured ? "checked" : ""}> ⭐ Mettre en avant sur l'accueil (« À découvrir »)</label>
      <div class="hint">Le contenu apparaît dans la bibliothèque publique (Niveau → Enseignement → Chapitre → Type) quand il est publié (pas brouillon, date atteinte). Pensez à choisir la matière et le chapitre ci-dessus.</div>
    </div></div>`;
  $(`#${x}_Pub`, el).onchange = e => $(`#${x}_PubOpts`, el).classList.toggle("hidden", !e.target.checked);
  $(`#${x}_Type`, el).onchange = e => $(`#${x}_YearBox`, el).classList.toggle("hidden", e.target.value !== "annale");
}
function readPubBlock(el, x) {
  const v = id => $(`#${x}_${id}`, el);
  const url = v("Video").value.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) throw new Error("le lien vidéo doit commencer par https://");
  const yr = parseInt(v("Year").value, 10);
  return { video_url: url || null, allow_download: v("Dl").checked, allow_print: v("Print").checked, is_public: v("Pub").checked,
    niveau: v("Niv").value || null, resource_type: v("Type").value || null, annale_year: v("Type").value === "annale" && yr ? yr : null, featured: v("Pub").checked && v("Feat").checked };
}
function pubBadges(it) {
  return (it.is_public ? `<span class="badge" style="background:#e7f6ee;color:#1b7f4b">🌐 Public${it.niveau ? " · " + esc(NIV[it.niveau]) : ""}</span>` : "")
    + (it.is_public && it.featured ? `<span class="badge" style="background:#fff4e0;color:#a15c00">⭐ À la une</span>` : "")
    + (it.allow_download === false ? `<span class="badge" style="background:#f2f4f7;color:#667085" title="Téléchargement interdit">⬇̸</span>` : "")
    + (it.allow_print === false ? `<span class="badge" style="background:#f2f4f7;color:#667085" title="Impression interdite">🖨̸</span>` : "")
    + (it.video_url ? `<span class="badge" style="background:#fdecec;color:#c62828">▶ Vidéo</span>` : "");
}
function pubBtn(it) {
  return it.is_public
    ? `<a class="btn sm ok" href="ressource.html?id=${it.id}&visiteur=1" target="_blank" rel="noopener" title="Voir la page publique">🌐 Voir en public</a>`
    : `<button class="btn sm ghost" onclick="makePublic('${it.id}')" title="Rendre visible sur le site public">🌐 Rendre public</button>`;
}
function makePublic(id) {
  const it = byId("items", id);
  if (it.kind === "devoir" && !confirm("C'est un devoir : sur le site public, la correction n'apparaîtra qu'après la date limite. Continuer ?")) return;
  setItem(id, { is_public: true }, `Publier « ${it.title} » sur le site public ?\nIl sera visible par tous, sans inscription.\n(Niveau, type et mise en avant : bouton « Modifier ».)`);
}
drawPubBlock($("#pPubBlock"), "p", {});

// ================= Matières : famille (classement public) =================
const _renderSubjects = renderSubjects;
renderSubjects = function () {
  _renderSubjects();
  $$("#subList > .card").forEach((card, k) => {
    const s = S.subjects[k]; if (!s || !("family" in s)) return;
    const row = card.querySelector(".row");
    row.insertAdjacentHTML("beforeend", `<select style="width:auto;max-width:240px" title="Rubrique sur le site public" onchange="setFamily('${s.id}', this.value)">
      <option value="">Rubrique publique : —</option>${Object.entries(FAM).map(([k2, v]) => `<option value="${k2}" ${s.family === k2 ? "selected" : ""}>${v}</option>`).join("")}</select>`);
  });
};
async function setFamily(id, v) { try { await q(sb.from("subjects").update({ family: v || null }).eq("id", id)); loadAll(true); } catch (e) { alert("Erreur : " + e.message); } }

// ================= Onglet 🌐 Site public =================
const SECTIONS = { nouveautes: "🆕 Les nouveautés", decouvrir: "⭐ À découvrir (mises en avant)", entraide: "🙋 Questions & entraide",
  accompagnement: "📨 Demander un accompagnement", newsletter: "📰 Newsletter", installer: "📲 Installer STI2D" };
function renderSite() {
  const p = panel("site"); if (!p) return;
  const home = setting("public_home", null);
  const pub = S.items.filter(i => i.is_public);
  const live = pub.filter(i => itemStatus(i).k === "live" || itemStatus(i).k === "ended");
  const feat = pub.filter(i => i.featured).sort((a, b) => a.public_position - b.public_position || new Date(b.public_at || b.publish_at) - new Date(a.public_at || a.publish_at));
  p.innerHTML = `
    <div class="card"><div class="row"><div style="flex:1;min-width:240px"><h2 style="margin:0">🌐 Site public</h2>
      <p class="hint" style="margin:4px 0 0">${live.length} contenu(s) visible(s) par le public${pub.length > live.length ? ` · ${pub.length - live.length} en brouillon / programmé(s)` : ""}. Une rubrique sans contenu n'apparaît jamais.</p></div>
      <a class="btn" href="./?visiteur=1" target="_blank" rel="noopener">👁 Voir le site en tant que visiteur</a><a class="btn ghost" href="ressources.html?visiteur=1" target="_blank" rel="noopener">📚 Bibliothèque publique</a></div></div>
    <div class="card"><h2>🏠 Rubriques de la page d'accueil</h2>
      ${home ? `<div class="checks" style="max-height:none">${Object.entries(SECTIONS).map(([k, v]) => `<label><input type="checkbox" data-sec="${k}" ${home[k] !== false ? "checked" : ""}> ${v}</label>`).join("")}</div>
        <p class="hint">Décochez pour masquer une rubrique. « Nouveautés » et « À découvrir » ne s'affichent que s'il y a des contenus publics ; l'exemple de question n'apparaît que si vous en épinglez une (onglet Entraide).</p>`
      : `<p class="msg err">Exécutez d'abord <b>setup_v7.sql</b> dans Supabase.</p>`}</div>
    <div class="card"><h2>⭐ À découvrir <span class="small muted">(ordre d'affichage sur l'accueil)</span></h2>
      ${feat.length ? feat.map((it, k) => `<div class="list-row"><b style="width:22px">${k + 1}.</b><div style="flex:1;min-width:180px"><div class="title">${esc(it.title)}</div><div class="small muted">${esc(RT[autoType(it)])}${it.niveau ? " · " + NIV[it.niveau] : ""} · <span class="pill ${itemStatus(it).cls}">${esc(itemStatus(it).txt)}</span></div></div>
          <button class="btn sm ghost" ${k ? "" : "disabled"} onclick="moveFeat('${it.id}',-1)">↑</button><button class="btn sm ghost" ${k < feat.length - 1 ? "" : "disabled"} onclick="moveFeat('${it.id}',1)">↓</button>
          <button class="btn sm ghost" onclick="setItem('${it.id}', { featured: false })">Retirer</button></div>`).join("")
        : `<p class="small muted" style="margin:0">Aucun contenu mis en avant. Dans « Modifier » d'un contenu public, cochez « Mettre en avant sur l'accueil ».</p>`}</div>
    <div class="card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0">📚 Contenus publics</h2><div class="spacer"></div><button class="btn sm" onclick="showTab('pub')">➕ Publier</button></div>
      ${pub.length ? pub.map(it => `<div class="list-row"><div style="flex:1;min-width:200px"><div class="title">${esc(it.title)}</div>
          <div class="small muted">${esc(RT[autoType(it)])}${it.niveau ? " · " + NIV[it.niveau] : ""}${byId("subjects", it.subject_id).name ? " · " + esc(byId("subjects", it.subject_id).name) : ""}${byId("chapters", it.chapter_id).name ? " › " + esc(byId("chapters", it.chapter_id).name) : ""} · <span class="pill ${itemStatus(it).cls}">${esc(itemStatus(it).txt)}</span></div></div>
          <label class="inline small"><input type="checkbox" style="width:auto" ${it.allow_download !== false ? "checked" : ""} onchange="setItem('${it.id}', { allow_download: this.checked })"> ⬇</label>
          <label class="inline small"><input type="checkbox" style="width:auto" ${it.allow_print !== false ? "checked" : ""} onchange="setItem('${it.id}', { allow_print: this.checked })"> 🖨</label>
          <a class="btn sm ghost" href="ressource.html?id=${it.id}&visiteur=1" target="_blank" rel="noopener">👁</a>
          <button class="btn sm ghost" onclick="editItem('${it.id}')">✏️</button>
          <button class="btn sm ghost" onclick="unpublish('${it.id}')">Retirer du public</button></div>`).join("")
        : `<p class="small muted" style="margin:0">Aucun contenu public. Dans « Publier » ou « Modifier », cochez « 🌐 Publier sur le site public », ou utilisez le bouton « 🌐 Rendre public » dans Contenus.</p>`}</div>`;
  $$("[data-sec]", p).forEach(c => c.onchange = async () => {
    const v = { ...(setting("public_home", {}) || {}) }; $$("[data-sec]", p).forEach(x => v[x.dataset.sec] = x.checked);
    try { await q(sb.from("settings").update({ value: v }).eq("key", "public_home")); loadAll(true); } catch (e) { alert("Erreur : " + e.message); }
  });
}
function unpublish(id) { setItem(id, { is_public: false, featured: false }, `Retirer « ${byId("items", id).title} » du site public ? (rien n'est supprimé)`); }
async function moveFeat(id, d) {
  const feat = S.items.filter(i => i.is_public && i.featured).sort((a, b) => a.public_position - b.public_position || new Date(b.public_at || b.publish_at) - new Date(a.public_at || a.publish_at));
  const k = feat.findIndex(i => i.id === id), j = k + d; if (j < 0 || j >= feat.length) return;
  [feat[k], feat[j]] = [feat[j], feat[k]];
  try { for (let n = 0; n < feat.length; n++) if (feat[n].public_position !== n) await q(sb.from("items").update({ public_position: n }).eq("id", feat[n].id)); loadAll(true); }
  catch (e) { alert("Erreur : " + e.message); }
}

// ================= Onglet 🙋 Entraide =================
const FX = { threads: [], posts: [], slots: [], loaded: false };
const forumUrl = p => `${SUPABASE_URL}/storage/v1/object/public/forum/${p.split("/").map(encodeURIComponent).join("/")}`;
const attLinks = a => (a || []).map(x => `<a class="use" href="${esc(forumUrl(x.path))}" target="_blank" rel="noopener">${/^image/.test(x.mime) ? "🖼" : "📄"} ${esc(x.name)} <span class="muted">${fmtSize(x.size)}</span></a>`).join(" ");
const ST = { pending: ["wait", "⏳ À valider"], published: ["done", "🟢 Publié"], hidden: ["late", "🚫 Masqué"] };
async function loadForum() {
  try {
    const [t, p, s] = await Promise.all([
      q(sb.from("forum_threads").select("*").order("last_activity_at", { ascending: false }).limit(2000)),
      q(sb.from("forum_posts").select("*").order("created_at").limit(10000)),
      q(sb.from("forum_upload_slots").select("path, size, used, created_at, expires_at").limit(5000))]);
    Object.assign(FX, { threads: t, posts: p, slots: s, loaded: true });
  } catch (e) { panel("entraide").innerHTML = `<div class="card msg err">Entraide indisponible : exécutez setup_v7.sql (${esc(e.message)})</div>`; return false; }
  return true;
}
const threadOf = id => FX.threads.find(t => t.id === id) || {};
function renderForum() {
  const p = panel("entraide");
  const pend = [...FX.threads.filter(t => t.status === "pending").map(t => ({ k: "thread", r: t })), ...FX.posts.filter(x => x.status === "pending").map(x => ({ k: "post", r: x }))]
    .sort((a, b) => new Date(a.r.created_at) - new Date(b.r.created_at));
  const rep = [...FX.threads.filter(t => t.reports > 0).map(t => ({ k: "thread", r: t })), ...FX.posts.filter(x => x.reports > 0).map(x => ({ k: "post", r: x }))];
  const allAtt = [...FX.threads, ...FX.posts].flatMap(r => r.attachments || []);
  const size = allAtt.reduce((s, a) => s + (+a.size || 0), 0);
  const orphans = FX.slots.filter(s => !s.used && new Date(s.expires_at) < new Date());
  const qs = ($("#fxQ") || {}).value || "";
  const list = FX.threads.filter(t => !qs || (t.title + " " + t.body + " " + t.author).toLowerCase().includes(qs.toLowerCase()));
  const item = ({ k, r }) => `<div class="doc"><div class="body">
      <div class="row" style="gap:8px"><span class="badge">${k === "thread" ? "Question" : "Réponse"}</span><b>${esc(r.author)}</b><span class="small muted">${fmtDT(r.created_at)}</span>${r.reports ? `<span class="pill late">⚑ ${r.reports} signalement(s)</span>` : ""}<span class="pill ${ST[r.status][0]}">${ST[r.status][1]}</span></div>
      ${k === "thread" ? `<div class="title" style="margin-top:6px">${esc(r.title)}</div>` : `<div class="small muted" style="margin-top:6px">dans « ${esc(threadOf(r.thread_id).title || "?")} »</div>`}
      <div class="comment">${esc(r.body)}</div>${(r.attachments || []).length ? `<div class="uses">${attLinks(r.attachments)}</div>` : ""}
      <div class="row" style="margin-top:8px">
        ${r.status !== "published" ? `<button class="btn sm" onclick="fxSet('${k}','${r.id}',{status:'published'})">✔ Publier</button>` : ""}
        ${r.status !== "hidden" ? `<button class="btn sm ghost" onclick="fxSet('${k}','${r.id}',{status:'hidden'})">🚫 ${r.status === "pending" ? "Refuser" : "Masquer"}</button>` : ""}
        ${r.reports ? `<button class="btn sm ghost" onclick="fxSet('${k}','${r.id}',{reports:0})">Ignorer le signalement</button>` : ""}
        <button class="btn sm ghost" onclick="fxOpen('${k === "thread" ? r.id : r.thread_id}')">💬 Ouvrir la discussion</button>
        <button class="btn sm danger" onclick="fxDel('${k}','${r.id}')">🗑 Supprimer</button></div></div></div>`;
  p.innerHTML = `
    <div class="card"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">🙋 Questions & entraide</h2>
      <p class="hint" style="margin:4px 0 0">Les élèves inscrits publient directement ; les visiteurs sont validés par vous. Vous pouvez répondre en tant que « Professeur ».</p></div>
      <a class="btn ghost" href="entraide.html" target="_blank" rel="noopener">Ouvrir la page publique</a><button class="btn ghost" onclick="fxReload()">↻ Actualiser</button></div></div>
    <div class="card"><h2>⏳ À valider <span class="dot" style="${pend.length ? "" : "display:none"}">${pend.length}</span></h2>${pend.length ? pend.map(item).join("") : `<p class="small muted" style="margin:0">Rien à valider.</p>`}</div>
    ${rep.length ? `<div class="card"><h2>⚑ Signalés</h2>${rep.map(item).join("")}</div>` : ""}
    <div class="card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0">💬 Discussions (${FX.threads.length})</h2><div class="spacer"></div><input id="fxQ" type="search" placeholder="Rechercher…" style="max-width:240px" value="${esc(qs)}"></div>
      ${list.length ? list.slice(0, 300).map(t => `<div class="list-row"><div style="flex:1;min-width:200px"><div class="title">${t.pinned ? "📌 " : ""}${t.featured ? "⭐ " : ""}${t.closed ? "🔒 " : ""}${esc(t.title)}</div>
          <div class="small muted">${esc(t.author)} · ${fmtDate(t.created_at)} · ${t.answers} réponse(s) · <span class="pill ${ST[t.status][0]}">${ST[t.status][1]}</span>${(t.attachments || []).length ? " · 📎" : ""}</div></div>
          <button class="btn sm ghost" onclick="fxOpen('${t.id}')">💬 Ouvrir</button>
          <button class="btn sm ghost" title="Épingler en haut de la liste" onclick="fxSet('thread','${t.id}',{pinned:${!t.pinned}})">${t.pinned ? "Désépingler" : "📌 Épingler"}</button>
          <button class="btn sm ${t.featured ? "ok" : "ghost"}" title="Exemple affiché sur la page d'accueil" onclick="fxFeature('${t.id}')">⭐ ${t.featured ? "Exemple accueil" : "Montrer sur l'accueil"}</button>
          <button class="btn sm danger" onclick="fxDel('thread','${t.id}')">🗑</button></div>`).join("") : `<p class="small muted" style="margin:0">Aucune discussion.</p>`}</div>
    <div class="card stack"><h2 style="margin:0">🧹 Stockage et nettoyage</h2>
      <div class="small">Pièces jointes du forum : <b>${allAtt.length}</b> fichier(s), <b>${fmtSize(size) || "0 o"}</b> (limites : 3 par message, photo 2 Mo, PDF 3 Mo). Rien n'est supprimé automatiquement.</div>
      <div class="row"><label style="margin:0">Discussions sans activité depuis</label><select id="fxAge" style="width:auto"><option value="6">6 mois</option><option value="12" selected>1 an</option><option value="24">2 ans</option><option value="36">3 ans</option></select>
        <label class="inline small"><input type="checkbox" id="fxKeepPin" checked style="width:auto"> garder les épinglées / exemples</label><button class="btn sm ghost" id="fxOld">Voir et supprimer…</button></div>
      <div class="row"><button class="btn sm ghost" id="fxHidden">Supprimer les messages refusés / masqués (${FX.threads.filter(t => t.status === "hidden").length + FX.posts.filter(x => x.status === "hidden").length})</button>
        <button class="btn sm ghost" id="fxOrph">Supprimer les fichiers envoyés mais jamais publiés (${orphans.length}, ${fmtSize(orphans.reduce((s, x) => s + (+x.size || 0), 0)) || "0 o"})</button></div></div>`;
  $("#fxQ").oninput = () => { const pos = $("#fxQ").selectionStart; renderForum(); $("#fxQ").focus(); $("#fxQ").setSelectionRange(pos, pos); };
  $("#fxOld").onclick = () => {
    const lim = new Date(); lim.setMonth(lim.getMonth() - +$("#fxAge").value);
    const old = FX.threads.filter(t => new Date(t.last_activity_at) < lim && !($("#fxKeepPin").checked && (t.pinned || t.featured)));
    if (!old.length) return alert("Aucune discussion concernée.");
    const paths = fxPaths(old.map(t => t.id));
    if (!confirm(`Supprimer définitivement ${old.length} discussion(s) sans activité depuis le ${fmtDate(lim)}, avec leurs réponses et ${paths.length} pièce(s) jointe(s) ?\nCette action ne peut pas être annulée.`)) return;
    fxDelThreads(old.map(t => t.id));
  };
  $("#fxHidden").onclick = async () => {
    const th = FX.threads.filter(t => t.status === "hidden"), po = FX.posts.filter(x => x.status === "hidden" && !th.some(t => t.id === x.thread_id));
    if (!th.length && !po.length) return alert("Rien à supprimer.");
    if (!confirm(`Supprimer définitivement ${th.length} question(s) et ${po.length} réponse(s) refusées / masquées ?`)) return;
    const paths = [...fxPaths(th.map(t => t.id)), ...po.flatMap(x => (x.attachments || []).map(a => a.path))];
    try {
      if (po.length) await q(sb.from("forum_posts").delete().in("id", po.map(x => x.id)));
      if (th.length) await q(sb.from("forum_threads").delete().in("id", th.map(t => t.id)));
      if (paths.length) await sb.storage.from("forum").remove(paths);
    } catch (e) { alert("Erreur : " + e.message); }
    fxReload();
  };
  $("#fxOrph").onclick = async () => {
    const used = FX.slots.filter(s => s.used && new Date(s.created_at) < new Date(Date.now() - 864e5));
    if (!orphans.length && !used.length) return alert("Rien à nettoyer.");
    if (orphans.length && !confirm(`Supprimer ${orphans.length} fichier(s) envoyé(s) mais jamais publié(s) ?`)) return;
    try {
      if (orphans.length) { await sb.storage.from("forum").remove(orphans.map(s => s.path)); await q(sb.from("forum_upload_slots").delete().in("path", orphans.map(s => s.path))); }
      if (used.length) await q(sb.from("forum_upload_slots").delete().in("path", used.map(s => s.path))); // jetons deja utilises : inutiles (les fichiers restent)
    } catch (e) { alert("Erreur : " + e.message); }
    fxReload();
  };
}
const fxPaths = ids => [...FX.threads.filter(t => ids.includes(t.id)), ...FX.posts.filter(x => ids.includes(x.thread_id))].flatMap(r => (r.attachments || []).map(a => a.path));
async function fxDelThreads(ids) {
  const paths = fxPaths(ids);
  try {
    for (let k = 0; k < ids.length; k += 100) await q(sb.from("forum_threads").delete().in("id", ids.slice(k, k + 100)));
    for (let k = 0; k < paths.length; k += 100) await sb.storage.from("forum").remove(paths.slice(k, k + 100));
  } catch (e) { alert("Erreur : " + e.message); }
  fxReload();
}
async function fxReload() { if (await loadForum()) { renderForum(); fxDots(); if ($("#modal.open .fx-thread")) fxOpen($("#modal .fx-thread").dataset.id); } }
async function fxSet(k, id, patch) {
  try { await q(sb.from(k === "thread" ? "forum_threads" : "forum_posts").update(patch).eq("id", id)); } catch (e) { return alert("Erreur : " + e.message); }
  fxReload();
}
async function fxFeature(id) {
  const t = threadOf(id);
  if (!t.featured && t.status !== "published") return alert("Publiez d'abord cette discussion.");
  try {
    await q(sb.from("forum_threads").update({ featured: false }).eq("featured", true));
    if (!t.featured) await q(sb.from("forum_threads").update({ featured: true }).eq("id", id));
  } catch (e) { return alert("Erreur : " + e.message); }
  fxReload();
}
async function fxDel(k, id) {
  if (k === "thread") {
    const t = threadOf(id), n = FX.posts.filter(x => x.thread_id === id).length;
    if (!confirm(`Supprimer définitivement la question « ${t.title} »${n ? ` et ses ${n} réponse(s)` : ""} ?`)) return;
    return fxDelThreads([id]);
  }
  const p = FX.posts.find(x => x.id === id);
  if (!confirm("Supprimer définitivement cette réponse ?")) return;
  try { await q(sb.from("forum_posts").delete().eq("id", id)); const a = (p.attachments || []).map(x => x.path); if (a.length) await sb.storage.from("forum").remove(a); }
  catch (e) { alert("Erreur : " + e.message); }
  fxReload();
}
function fxOpen(id) {
  const t = threadOf(id); if (!t.id) return;
  const posts = FX.posts.filter(x => x.thread_id === id);
  const box = openModal(`<div class="fx-thread" data-id="${id}"><div class="row"><h2 style="margin:0;flex:1">${esc(t.title)}</h2><button class="btn sm ghost" onclick="closeModal()">✕</button></div>
    <div class="small muted" style="margin:4px 0 10px">${esc(t.author)} · ${fmtDT(t.created_at)} · <span class="pill ${ST[t.status][0]}">${ST[t.status][1]}</span></div>
    <div class="comment" style="margin:0">${esc(t.body)}</div>${(t.attachments || []).length ? `<div class="uses">${attLinks(t.attachments)}</div>` : ""}
    <div class="row" style="margin-top:8px">${t.status !== "published" ? `<button class="btn sm" onclick="fxSet('thread','${id}',{status:'published'})">✔ Publier</button>` : `<button class="btn sm ghost" onclick="fxSet('thread','${id}',{status:'hidden'})">🚫 Masquer</button>`}
      <button class="btn sm ghost" onclick="fxSet('thread','${id}',{closed:${!t.closed}})">${t.closed ? "🔓 Rouvrir" : "🔒 Fermer"}</button>
      <a class="btn sm ghost" href="entraide.html?q=${id}" target="_blank" rel="noopener">👁 Page publique</a></div>
    <h3 style="margin:16px 0 8px">Réponses (${posts.length})</h3>
    ${posts.map(x => `<div class="sess ${x.status !== "published" ? "past" : ""}"><div class="row" style="gap:8px"><b>${esc(x.author)}</b><span class="small muted">${fmtDT(x.created_at)}</span><span class="pill ${ST[x.status][0]}">${ST[x.status][1]}</span>${x.is_solution ? `<span class="pill done">✔ Solution</span>` : ""}</div>
        <div style="white-space:pre-wrap;margin-top:6px">${esc(x.body)}</div>${(x.attachments || []).length ? `<div class="uses">${attLinks(x.attachments)}</div>` : ""}
        <div class="row" style="margin-top:6px">${x.status !== "published" ? `<button class="btn sm" onclick="fxSet('post','${x.id}',{status:'published'})">✔ Publier</button>` : `<button class="btn sm ghost" onclick="fxSet('post','${x.id}',{status:'hidden'})">🚫 Masquer</button>`}
          <button class="btn sm ghost" onclick="fxSet('post','${x.id}',{is_solution:${!x.is_solution}})">${x.is_solution ? "Retirer « solution »" : "✔ Marquer comme solution"}</button>
          <button class="btn sm danger" onclick="fxDel('post','${x.id}')">🗑</button></div></div>`).join("") || `<p class="small muted">Pas encore de réponse.</p>`}
    <form id="fxRep" class="stack" style="margin-top:12px"><label style="margin:0">Répondre en tant que « Professeur »</label><textarea id="fxBody" required placeholder="Votre réponse…"></textarea>
      <div><button class="btn" type="submit">Publier la réponse</button></div><div id="fxMsg" class="msg hidden"></div></form></div>`, true);
  box.style.height = "auto";
  $("#fxRep", box).onsubmit = async e => {
    e.preventDefault();
    try { const { error } = await sb.rpc("forum_reply", { p_thread: id, p_body: $("#fxBody", box).value, p_author: "Professeur", p_name: null, p_code: null, p_attachments: [], p_hp: null }); if (error) throw error; fxReload(); }
    catch (err) { showMsg($("#fxMsg", box), "Erreur : " + err.message); }
  };
}

// ================= Onglet 📨 Demandes d'accompagnement =================
let REQ = [], reqF = "";
const RS = { nouvelle: ["late", "🆕 Nouvelle"], en_cours: ["todo", "⏳ En cours"], traitee: ["done", "✔ Traitée"] };
async function loadReq() {
  try { REQ = await q(sb.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(2000)); return true; }
  catch (e) { panel("demandes").innerHTML = `<div class="card msg err">Demandes indisponibles : exécutez setup_v7.sql (${esc(e.message)})</div>`; return false; }
}
function renderReq() {
  const list = REQ.filter(r => !reqF || r.status === reqF);
  panel("demandes").innerHTML = `<div class="card"><div class="row"><h2 style="margin:0;flex:1">📨 Demandes d'accompagnement</h2>
      <div class="seg">${[["", "Toutes"], ...Object.entries(RS).map(([k, v]) => [k, v[1]])].map(([k, v]) => `<button type="button" class="${reqF === k ? "active" : ""}" onclick="reqF='${k}';renderReq()">${v} (${k ? REQ.filter(r => r.status === k).length : REQ.length})</button>`).join("")}</div></div>
      <p class="hint" style="margin:6px 0 0">Formulaire public : <a href="accompagnement.html" target="_blank" rel="noopener">accompagnement.html</a>. Supprimez une demande quand elle n'est plus utile (données personnelles).</p></div>
    ${list.length ? list.map(r => `<div class="card"><div class="row" style="gap:8px"><b style="font-size:1.05rem">${esc(r.first_name)} ${esc(r.last_name)}</b><span class="pill ${RS[r.status][0]}">${RS[r.status][1]}</span><span class="small muted">${fmtDT(r.created_at)}</span></div>
        <div class="small" style="margin-top:4px">✉️ <a href="mailto:${esc(r.email)}?subject=${encodeURIComponent("Re : " + r.subject)}">${esc(r.email)}</a>${r.phone ? ` · 📞 <a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${esc(r.phone)}</a>` : ""}</div>
        <div class="title" style="margin-top:10px">${esc(r.subject)}</div><div class="comment">${esc(r.message)}</div>
        <div class="row" style="margin-top:10px"><select style="width:auto" onchange="reqSet('${r.id}', this.value)">${Object.entries(RS).map(([k, v]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${v[1]}</option>`).join("")}</select>
          <a class="btn sm" href="mailto:${esc(r.email)}?subject=${encodeURIComponent("Re : " + r.subject)}">✉️ Répondre</a><button class="btn sm danger" onclick="reqDel('${r.id}')">🗑 Supprimer</button></div></div>`).join("")
      : `<div class="card empty">Aucune demande${reqF ? " dans cette catégorie" : ""}.</div>`}`;
}
async function reqSet(id, status) { try { await q(sb.from("contact_requests").update({ status }).eq("id", id)); } catch (e) { return alert("Erreur : " + e.message); } await loadReq(); renderReq(); fxDots(); }
async function reqDel(id) {
  const r = REQ.find(x => x.id === id);
  if (!confirm(`Supprimer définitivement la demande de ${r.first_name} ${r.last_name} ?`)) return;
  try { await q(sb.from("contact_requests").delete().eq("id", id)); } catch (e) { return alert("Erreur : " + e.message); }
  await loadReq(); renderReq(); fxDots();
}

// ================= Onglet 📰 Newsletter =================
let NL = [], nlQ = "";
const NS = { pending: ["wait", "⏳ À confirmer"], confirmed: ["done", "✔ Inscrit"], unsubscribed: ["late", "Désinscrit"] };
async function loadNl() {
  try { NL = await q(sb.from("newsletter_subscribers").select("id, email, status, created_at, confirmed_at, unsubscribed_at, confirm_sent_at").order("created_at", { ascending: false }).limit(10000)); return true; }
  catch (e) { panel("newsletter").innerHTML = `<div class="card msg err">Newsletter indisponible : exécutez setup_v7.sql (${esc(e.message)})</div>`; return false; }
}
function renderNl() {
  const c = k => NL.filter(s => s.status === k).length, conf = c("confirmed");
  const list = NL.filter(s => !nlQ || s.email.includes(nlQ.toLowerCase()));
  const p = panel("newsletter");
  const keep = p.querySelector("#nlSubj") ? { s: $("#nlSubj").value, t: $("#nlText").value } : null;
  p.innerHTML = `<div class="grid3"><div class="stat"><b>${conf}</b><span class="small muted">abonné(s) confirmé(s)</span></div><div class="stat"><b>${c("pending")}</b><span class="small muted">en attente de confirmation</span></div><div class="stat"><b>${c("unsubscribed")}</b><span class="small muted">désinscrit(s)</span></div></div>
    <form id="nlForm" class="card stack"><h2 style="margin:0">✉️ Envoyer les nouveautés</h2>
      <p class="hint" style="margin:0">Envoyé uniquement aux adresses <b>confirmées</b> (double inscription), avec un lien de désinscription dans chaque e-mail. Nécessite un domaine vérifié dans Resend (secret <code>MAIL_FROM</code>, voir LISEZMOI).</p>
      <div><label>Objet</label><input id="nlSubj" type="text" maxlength="150" required placeholder="Nouveautés STI2D : 3 nouveaux QCM"></div>
      <div><div class="row"><label style="margin:0">Message</label><div class="spacer"></div><button type="button" class="btn sm ghost" id="nlFill">📋 Insérer les ressources publiées depuis 30 jours</button></div>
        <textarea id="nlText" required style="min-height:180px" placeholder="Bonjour,&#10;&#10;Voici les nouvelles ressources…"></textarea></div>
      <div class="row"><button type="button" class="btn ghost" id="nlTest">Envoyer un test (à moi)</button><button type="submit" class="btn" id="nlSend">Envoyer à ${conf} abonné(s)</button></div>
      <div id="nlMsg" class="msg hidden"></div></form>
    <div class="card"><div class="row" style="margin-bottom:8px"><h2 style="margin:0;flex:1">Abonnés</h2><input id="nlQ" type="search" placeholder="Rechercher une adresse…" style="max-width:240px" value="${esc(nlQ)}"><button class="btn sm ghost" id="nlCsv">⬇ Export CSV (confirmés)</button></div>
      ${list.length ? list.slice(0, 500).map(s => `<div class="list-row"><div style="flex:1;min-width:200px"><b>${esc(s.email)}</b><div class="small muted">inscrit le ${fmtDate(s.created_at)}${s.confirmed_at ? " · confirmé le " + fmtDate(s.confirmed_at) : ""}${s.unsubscribed_at ? " · désinscrit le " + fmtDate(s.unsubscribed_at) : ""}</div></div>
          <span class="pill ${NS[s.status][0]}">${NS[s.status][1]}</span><button class="btn sm danger" onclick="nlDel('${s.id}')" title="Supprimer cette adresse (RGPD)">🗑</button></div>`).join("") : `<p class="small muted" style="margin:0">Aucun abonné pour l'instant.</p>`}</div>`;
  if (keep) { $("#nlSubj").value = keep.s; $("#nlText").value = keep.t; }
  $("#nlQ").oninput = () => { nlQ = $("#nlQ").value; const pos = $("#nlQ").selectionStart; renderNl(); $("#nlQ").focus(); $("#nlQ").setSelectionRange(pos, pos); };
  $("#nlCsv").onclick = () => {
    const rows = [["email", "inscrit_le", "confirme_le"], ...NL.filter(s => s.status === "confirmed").map(s => [s.email, s.created_at, s.confirmed_at])];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.join(";")).join("\n")], { type: "text/csv" }));
    a.download = "abonnes-sti2d.csv"; a.click();
  };
  $("#nlFill").onclick = () => {
    const since = Date.now() - 30 * 864e5;
    const recent = S.items.filter(i => i.is_public && itemStatus(i).k === "live" && new Date(i.public_at || i.publish_at) >= since);
    if (!recent.length) return alert("Aucune ressource publique publiée ces 30 derniers jours.");
    $("#nlText").value = ($("#nlText").value ? $("#nlText").value + "\n\n" : "Bonjour,\n\nVoici les nouvelles ressources disponibles sur STI2D.ORG :\n\n")
      + recent.map(i => `• ${RT[autoType(i)].replace(/^\S+\s/, "")} : ${i.title}${i.niveau ? " (" + NIV[i.niveau] + ")" : ""}\n  https://sti2d.org/ressource.html?id=${i.id}`).join("\n") + "\n\nBon travail !";
  };
  const send = async test => {
    const s = $("#nlSubj").value.trim(), t = $("#nlText").value.trim();
    if (!s || !t) return showMsg($("#nlMsg"), "Objet et message obligatoires.");
    if (!test && !confirm(`Envoyer « ${s} » à ${conf} abonné(s) ?`)) return;
    $("#nlSend").disabled = $("#nlTest").disabled = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(NOTIFY_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ newsletter_send: { subject: s, text: t, test } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) throw new Error(d.error || "erreur " + r.status);
      showMsg($("#nlMsg"), test ? "✔ E-mail de test envoyé à votre adresse." : `✔ Envoyé à ${d.sent} abonné(s).`, "ok");
    } catch (e) { showMsg($("#nlMsg"), "Envoi impossible : " + e.message); }
    finally { $("#nlSend").disabled = $("#nlTest").disabled = false; }
  };
  $("#nlTest").onclick = () => send(true);
  $("#nlForm").onsubmit = e => { e.preventDefault(); send(false); };
}
async function nlDel(id) {
  const s = NL.find(x => x.id === id);
  if (!confirm(`Supprimer définitivement ${s.email} de la liste ?`)) return;
  try { await q(sb.from("newsletter_subscribers").delete().eq("id", id)); } catch (e) { return alert("Erreur : " + e.message); }
  await loadNl(); renderNl();
}

// ================= Pastilles (à valider / nouvelles demandes) =================
async function fxDots() {
  const n = async (t, f) => { try { const { count } = await f(sb.from(t).select("id", { count: "exact", head: true })); return count || 0; } catch (e) { return 0; } };
  const [a, b, c, d] = await Promise.all([
    n("forum_threads", x => x.eq("status", "pending")), n("forum_posts", x => x.eq("status", "pending")),
    n("forum_threads", x => x.gt("reports", 0)), n("contact_requests", x => x.eq("status", "nouvelle"))]);
  const f = a + b + c;
  $("#dotForum").innerHTML = f ? `<span class="dot">${f}</span>` : "";
  $("#dotReq").innerHTML = d ? `<span class="dot">${d}</span>` : "";
}

// ================= Branchements =================
const _showTab = showTab;
showTab = function (name) {
  _showTab(name);
  if (name === "site") renderSite();
  if (name === "entraide") { panel("entraide").innerHTML = `<div class="card empty">Chargement…</div>`; loadForum().then(ok => ok && renderForum()); }
  if (name === "demandes") { panel("demandes").innerHTML = `<div class="card empty">Chargement…</div>`; loadReq().then(ok => ok && renderReq()); }
  if (name === "newsletter") { panel("newsletter").innerHTML = `<div class="card empty">Chargement…</div>`; loadNl().then(ok => ok && renderNl()); }
};
const _renderAll = renderAll;
renderAll = function () { _renderAll(); if (visible("site")) renderSite(); };
// pastilles : au démarrage (après connexion) puis toutes les 2 minutes
(function waitApp() {
  if ($("#app").classList.contains("hidden")) return setTimeout(waitApp, 1500);
  fxDots(); setInterval(fxDots, 120000);
  const h = location.hash.slice(1); if (["site", "entraide", "demandes", "newsletter"].includes(h)) showTab(h);
})();
