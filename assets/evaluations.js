/* =====================================================================
   Évaluations : espace élève (« Prévenir d'une évaluation » + « Mes évaluations »)
   Autonome : réutilise la connexion existante de cours.html (me, data, sb, showTab,
   openModal…). Aucune fonction existante n'est modifiée. Toutes les écritures passent par
   les fonctions student_eval_* de la base (nom + code, comme le reste de l'espace élève).
   ===================================================================== */
(() => {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const longDay = s => parse(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const diff = s => Math.round((parse(s) - parse(todayStr())) / 864e5);
  const rel = s => { const n = diff(s); return n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n === -1 ? "hier" : n > 1 ? `dans ${n} jours` : `il y a ${-n} jours`; };
  const cap = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  const panel = () => $('[data-panel="evals"]');

  let list = [], built = false, seq = 0, flashTimer = null;
  const call = (fn, args) => sb.rpc(fn, { p_name: me.name, p_code: me.code, ...args });
  const isUp = e => e.status === "upcoming" && e.eval_date >= todayStr();

  async function load() {
    const { data: res, error } = await call("student_eval_list", {});
    if (error || !Array.isArray(res)) return false;
    list = res; return true;
  }

  // ---------- Formulaire (création, modification, remise à venir) ----------
  function formEl(init, o) {
    init = init || {}; o = o || {};
    const id = "evf" + (++seq), subs = (data && data.subjects) || [];
    const f = document.createElement("form");
    f.className = "card stack ev-form"; f.noValidate = true;
    f.innerHTML = `
      <h2 style="margin:0">${esc(o.title || "Prévenir d'une évaluation")}</h2>
      <div class="form-grid">
        <div><label for="${id}s">Matière</label>
          <select id="${id}s" name="subject"><option value="">Choisir la matière…</option>${subs.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></div>
        <div><label for="${id}d">Date de l'évaluation</label>
          <input id="${id}d" name="date" type="date" min="${todayStr()}"></div>
      </div>
      <div><label for="${id}c">Chapitres</label>
        <textarea id="${id}c" name="chapters" rows="5" placeholder="Chapitre 2 : titre du chapitre&#10;Chapitre 3 : titre du chapitre"></textarea>
        <div class="hint">Un chapitre par ligne.</div></div>
      <div>
        <label class="inline"><input type="checkbox" name="sent" style="width:auto"> J'ai déjà envoyé mes cours</label>
        <div class="ev-sent hidden">
          <div class="radio"><label><input type="radio" name="mode" value="all" checked style="width:auto"> Tous mes cours</label>
            <label><input type="radio" name="mode" value="partial" style="width:auto"> Seulement une partie</label></div>
          <label for="${id}l">Lesquels ?</label>
          <input id="${id}l" name="details" type="text" maxlength="500" placeholder="ex. le chapitre 2 seulement">
          <div class="hint">Par exemple un seul chapitre, ou les deux.</div>
        </div>
      </div>
      <div class="row"><button class="btn" type="submit">${esc(o.submit || "Envoyer")}</button>${o.cancel ? `<button class="btn ghost" type="button" data-cancel>Annuler</button>` : ""}</div>
      <div class="msg err hidden" data-msg></div>`;
    const el = f.elements, sentBox = f.querySelector(".ev-sent"), msg = f.querySelector("[data-msg]");
    const syncSent = () => sentBox.classList.toggle("hidden", !el.sent.checked);
    el.sent.addEventListener("change", syncSent);
    const fill = v => {
      el.subject.value = v.subject_id || ""; el.date.value = v.date || ""; el.chapters.value = v.chapters || "";
      el.sent.checked = v.sent_status === "all" || v.sent_status === "partial";
      f.querySelector(`input[name=mode][value=${v.sent_status === "partial" ? "partial" : "all"}]`).checked = true;
      el.details.value = v.sent_details || ""; syncSent();
    };
    fill({ subject_id: init.subject_id, date: init.date, chapters: init.chapters, sent_status: init.sent_status, sent_details: init.sent_details });
    const c = f.querySelector("[data-cancel]"); if (c) c.onclick = o.onCancel;

    f.addEventListener("submit", async ev => {
      ev.preventDefault(); msg.classList.add("hidden");
      const fail = t => showMsg(msg, t);
      const v = { subject: el.subject.value, date: el.date.value, chapters: el.chapters.value.trim(), sent: el.sent.checked,
        mode: f.querySelector("input[name=mode]:checked").value, details: el.details.value.trim() };
      if (!v.subject) return fail("Choisissez la matière.");
      if (!v.date) return fail("Choisissez la date de l'évaluation.");
      if (v.date < todayStr()) return fail("La date doit être aujourd'hui ou dans le futur.");
      if (!v.chapters) return fail("Indiquez au moins un chapitre (un par ligne).");
      const status = v.sent ? v.mode : "none";
      if (status === "partial" && !v.details) return fail("Précisez lesquels de vos cours vous avez déjà envoyés.");
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      const { error } = await call("student_eval_save", { p_id: init.id || null, p_subject: v.subject, p_date: v.date, p_chapters: v.chapters,
        p_sent_status: status, p_sent_details: status === "none" ? null : (v.details || null) });
      btn.disabled = false;
      if (error) return fail(cap(error.message));
      await load(); renderList(); updateHome();
      if (o.onSaved) return o.onSaved();
      showMsg(msg, "Évaluation enregistrée ✔", "ok");          // création : le formulaire reste ouvert pour en ajouter une autre
      f.reset(); fill({}); setTimeout(() => msg.classList.add("hidden"), 7000);
    });
    return f;
  }

  // ---------- Page « Mes évaluations » ----------
  function build() {
    if (built) return; built = true;
    panel().innerHTML = `
      <div class="card"><div class="row" style="gap:12px">
        <div style="flex:1;min-width:220px"><h2 style="margin:0 0 4px">⏰ Mes évaluations</h2>
          <p class="small muted" style="margin:0">Dès que vous connaissez la date d'une évaluation, prévenez votre professeur : il pourra vérifier que vous avez tous vos cours.</p></div>
        <button class="btn" id="evToggle" type="button">➕ Prévenir d'une évaluation</button></div></div>
      <div id="evFlash" class="msg ok hidden" style="margin:0"></div>
      <div id="evFormBox" class="hidden"></div>
      <div id="evList"></div>
      <details class="folder hidden" id="evOld"><summary>Passées, annulées ou reportées <span class="count" id="evOldN"></span></summary><div class="inner" id="evOldList"></div></details>`;
    $("#evFormBox").appendChild(formEl());
    $("#evToggle").onclick = () => setForm(!formVisible());
    panel().addEventListener("click", onClick);
  }
  const formVisible = () => !$("#evFormBox").classList.contains("hidden");
  function setForm(show, focus) {
    $("#evFormBox").classList.toggle("hidden", !show);
    $("#evToggle").textContent = show ? "✕ Fermer le formulaire" : "➕ Prévenir d'une évaluation";
    if (show && focus) { $("#evFormBox").scrollIntoView({ behavior: "smooth", block: "start" }); const s = $("#evFormBox select"); if (s) setTimeout(() => s.focus({ preventScroll: true }), 300); }
  }
  function flash(text) {
    const el = $("#evFlash"); el.textContent = text; el.classList.remove("hidden");
    clearTimeout(flashTimer); flashTimer = setTimeout(() => el.classList.add("hidden"), 7000);
  }

  const sentPill = e => e.sent_status === "all" ? ["ev-all", "Cours envoyés"] : e.sent_status === "partial" ? ["ev-part", "Cours envoyés en partie"] : ["ev-none", "Cours non envoyés"];
  function card(e, old) {
    const [pc, pl] = sentPill(e), btn = (a, t, c) => `<button class="btn sm ${c || "ghost"}" type="button" data-act="${a}" data-id="${esc(e.id)}">${t}</button>`;
    let tag = "", actions;
    if (e.status === "cancelled") tag = `<span class="pill ev-mute">🚫 Annulée</span>`;
    else if (e.status === "postponed") tag = `<span class="pill ev-mute">🔁 Reportée${e.new_date ? " au " + esc(longDay(e.new_date)) : " (nouvelle date inconnue)"}</span>`;
    else if (old) tag = `<span class="pill ev-mute">Passée</span>`;
    if (!old) actions = btn("edit", "✏️ Modifier") + btn("postpone", "🔁 Reportée") + btn("cancel", "🚫 Annulée") + btn("del", "🗑 Supprimer", "danger");
    else actions = (e.status !== "upcoming" ? btn("back", "↩ Remettre à venir") : "") + btn("del", "🗑 Supprimer", "danger");
    return `<div class="card ev-item">
      <div class="ev-head"><div class="main"><div class="ev-subj">${esc(e.subject_name)}</div>
        <div class="ev-date">${esc(cap(longDay(e.eval_date)))} <span class="muted" style="font-weight:500">· ${esc(rel(e.eval_date))}</span></div></div>
        <div class="row" style="gap:6px">${tag}${e.status === "upcoming" && !old ? `<span class="pill ${pc}">${pl}</span>` : ""}</div></div>
      <div class="ev-chapters">${esc(e.chapters)}</div>
      ${e.sent_details && e.sent_status !== "none" ? `<div class="small muted" style="margin-top:6px">Déjà envoyé : ${esc(e.sent_details)}</div>` : ""}
      <div class="row ev-actions">${actions}</div></div>`;
  }
  function renderList() {
    if (!built) return;
    const up = list.filter(isUp).sort((a, b) => a.eval_date.localeCompare(b.eval_date));
    const old = list.filter(e => !isUp(e)).sort((a, b) => b.eval_date.localeCompare(a.eval_date));
    $("#evList").innerHTML = up.length ? up.map(e => card(e, false)).join("")
      : `<div class="card empty">Aucune évaluation à venir déclarée.<br><span class="small">Vous en connaissez une ? Utilisez « Prévenir d'une évaluation ».</span></div>`;
    $("#evOld").classList.toggle("hidden", !old.length);
    $("#evOldN").textContent = old.length;
    $("#evOldList").innerHTML = old.map(e => card(e, true)).join("");
  }

  // ---------- Actions : modifier, reporter, annuler, supprimer ----------
  async function act(promise, okText) {
    const { error } = await promise;
    if (error) { alert("Impossible : " + cap(error.message)); return false; }
    await load(); renderList(); updateHome(); flash(okText); return true;
  }
  function openEdit(e, back) {
    const box = openModal(`<div class="evHost"></div>`);
    const f = formEl({ id: e.id, subject_id: e.subject_id, date: back ? (e.new_date && e.new_date >= todayStr() ? e.new_date : "") : e.eval_date,
        chapters: e.chapters, sent_status: e.sent_status, sent_details: e.sent_details },
      { title: back ? "Remettre l'évaluation à venir" : "Modifier l'évaluation", submit: "Enregistrer", cancel: true, onCancel: closeModal,
        onSaved: () => { closeModal(); flash(back ? "Évaluation remise à venir ✔" : "Évaluation modifiée ✔"); } });
    box.querySelector(".evHost").appendChild(f);
  }
  function openPostpone(e) {
    const box = openModal(`<form class="stack" novalidate><h2 style="margin:0">🔁 Évaluation reportée</h2>
      <p class="small muted" style="margin:0">${esc(e.subject_name)} · ${esc(longDay(e.eval_date))}</p>
      <div><label for="evPpD">Nouvelle date <span class="muted small">(si elle est connue)</span></label><input id="evPpD" type="date" min="${todayStr()}"></div>
      <div class="row"><button class="btn" type="submit">Signaler le report</button><button class="btn ghost" type="button" data-x>Annuler</button></div>
      <div class="msg err hidden" data-msg></div></form>`);
    const f = box.querySelector("form"), msg = box.querySelector("[data-msg]");
    box.querySelector("[data-x]").onclick = closeModal;
    f.onsubmit = async ev => {
      ev.preventDefault(); const d = $("#evPpD", box).value || null;
      if (d && d < todayStr()) return showMsg(msg, "La nouvelle date doit être aujourd'hui ou dans le futur.");
      const { error } = await call("student_eval_status", { p_id: e.id, p_status: "postponed", p_new_date: d });
      if (error) return showMsg(msg, cap(error.message));
      closeModal(); await load(); renderList(); updateHome(); flash("Report signalé à votre professeur ✔");
    };
  }
  function onClick(ev) {
    const b = ev.target.closest("[data-act]"); if (!b) return;
    const e = list.find(x => x.id === b.dataset.id); if (!e) return;
    const a = b.dataset.act;
    if (a === "edit") openEdit(e, false);
    else if (a === "back") openEdit(e, true);
    else if (a === "postpone") openPostpone(e);
    else if (a === "cancel") {
      if (confirm(`Signaler que l'évaluation de ${e.subject_name} du ${longDay(e.eval_date)} est annulée ?\nVotre professeur sera prévenu.`))
        act(call("student_eval_status", { p_id: e.id, p_status: "cancelled", p_new_date: null }), "Annulation signalée à votre professeur ✔");
    } else if (a === "del") {
      if (confirm(`Supprimer cette déclaration ?\n(à faire seulement si elle a été saisie par erreur : ${e.subject_name}, ${longDay(e.eval_date)})`))
        act(call("student_eval_delete", { p_id: e.id }), "Déclaration supprimée.");
    }
  }

  // ---------- Carte sur l'accueil de l'espace élève (ajoutée, sans toucher au code existant) ----------
  function homeCard() {
    const home = $('[data-panel="home"]'); if (!home || $("#evHome")) return;
    const el = document.createElement("div"); el.id = "evHome"; el.className = "card ev-home";
    el.innerHTML = `<div class="row"><div style="flex:1;min-width:200px"><b>⏰ Une évaluation à venir ?</b>
      <div class="small muted" id="evHomeSub">Prévenez votre professeur dès que vous connaissez la date.</div></div>
      <button class="btn sm" id="evHomeGo" type="button">Prévenir d'une évaluation</button></div>`;
    home.insertBefore(el, $("#annBox") || home.firstChild);
    $("#evHomeGo").onclick = () => { showTab("evals"); setForm(true, true); };
  }
  function updateHome() {
    const s = $("#evHomeSub"); if (!s) return;
    const up = list.filter(isUp).sort((a, b) => a.eval_date.localeCompare(b.eval_date));
    s.textContent = up.length ? `${up.length} évaluation${up.length > 1 ? "s" : ""} déclarée${up.length > 1 ? "s" : ""} · prochaine : ${up[0].subject_name}, ${rel(up[0].eval_date)}.`
      : "Prévenez votre professeur dès que vous connaissez la date.";
  }

  // ---------- Branchements ----------
  async function open() {
    build();
    await load(); renderList(); updateHome();
    if (!list.some(isUp) && !$("#evFormBox").dataset.touched) { setForm(true); $("#evFormBox").dataset.touched = "1"; }   // aucune évaluation : formulaire ouvert d'emblée
  }
  const _showTab = showTab;
  showTab = function (name) { _showTab(name); if (name === "evals") open(); };

  // lien direct du rappel : cours.html#evals-new
  function fromHash() { if (location.hash === "#evals-new" && typeof me !== "undefined" && me) { showTab("evals"); build(); $("#evFormBox").dataset.touched = "1"; setForm(true, true); } }
  window.addEventListener("hashchange", fromHash);
  const wait = setInterval(() => {                                   // attend la fin de la connexion
    if (typeof me !== "undefined" && me && typeof data !== "undefined" && data) {
      clearInterval(wait); homeCard(); load().then(updateHome); fromHash();
    }
  }, 300);
})();
