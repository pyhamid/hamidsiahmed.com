/* =====================================================================
   Évaluations : tableau de bord du professeur (onglet « 📝 Évaluations »)
   Chargé APRÈS le script principal d'admin.html : réutilise S, sb, q, byId, setting, showTab, openModal…
   Aucune fonction existante n'est modifiée. Les données ne sont chargées qu'à l'ouverture de l'onglet.
   ===================================================================== */
(() => {
  "use strict";
  const DAYS = [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"], [6, "Samedi"], [0, "Dimanche"]];
  const DEF = { reminders_enabled: false, slots: [{ day: 3, time: "18:00" }, { day: 5, time: "18:00" }],
    reminder_text: "As-tu une évaluation à venir ? Préviens-moi dès maintenant.", alert_enabled: true, alert_days: 2, excluded: [] };
  const cfg = () => { const v = setting("eval_settings", null); return { ...DEF, ...(v && typeof v === "object" ? v : {}) }; };

  const pad = n => String(n).padStart(2, "0");
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const shortDay = s => parse(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const diff = s => Math.round((parse(s) - parse(todayStr())) / 864e5);
  const rel = s => { const n = diff(s); return n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n === -1 ? "hier" : n > 1 ? `dans ${n} jours` : `il y a ${-n} jours`; };
  const stamp = iso => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const panel = () => $('[data-panel="evals"]');
  const shown = () => panel() && !panel().classList.contains("hidden");

  let EV = [], built = false, archAll = false, draft = null;
  const F = { cls: "", sub: "", from: "", to: "" };
  const opened = new Set();                       // lignes dépliées (conservées lors des actualisations)

  const classOf = sid => {
    const g = S.sg.filter(x => x.student_id === sid).map(x => byId("groups", x.group_id).name).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    return g[0] || "Sans classe";                 // élève dans plusieurs groupes : le premier par ordre alphabétique
  };
  const subjKey = e => e.subject_id || "n:" + String(e.subject_name).toLowerCase();
  const subjName = e => byId("subjects", e.subject_id).name || e.subject_name;
  const who = sid => byId("students", sid).name || "Élève supprimé";
  const state = e => e.sent_status === "all" ? ["ev-all", "Tout envoyé"] : e.sent_status === "partial" ? ["ev-part", "Partiel"] : ["ev-none", "Rien envoyé"];
  const bucket = e => e.status === "cancelled" ? "cancelled" : e.status === "postponed" ? "postponed" : e.eval_date < todayStr() ? "past" : "upcoming";
  const plural = (n, a, b) => n > 1 ? b : a;

  async function load() {
    try { EV = await q(sb.from("evaluations").select("*").order("eval_date", { ascending: true }).limit(5000)); return true; }
    catch (err) {
      built = false;
      panel().innerHTML = `<div class="card msg err">Évaluations indisponibles : exécutez <b>setup_v8.sql</b> dans Supabase (${esc(err.message)})</div>`;
      return false;
    }
  }

  // ---------- Structure de la page ----------
  function build() {
    built = true;
    panel().innerHTML = `
      <div class="card"><div class="row" style="gap:10px">
        <div style="flex:1;min-width:220px"><h2 style="margin:0">📝 Évaluations annoncées par les élèves</h2><p class="hint" id="evStatus" style="margin:4px 0 0"></p></div>
        <button class="btn sm ghost" id="evRefresh" type="button">↻ Actualiser</button>
        <button class="btn sm" id="evAllSeen" type="button">✔ Tout marquer comme vu</button></div></div>
      <div class="filters" style="margin:0">
        <select id="evFc" aria-label="Classe"></select><select id="evFs" aria-label="Matière"></select>
        <input id="evFf" type="date" aria-label="À partir du" title="À partir du"><input id="evFt" type="date" aria-label="Jusqu'au" title="Jusqu'au"></div>
      <div id="evUp"></div>
      <details class="folder" id="evArch" data-k="arch"><summary>Passées, annulées ou reportées <span class="count" id="evArchN"></span></summary><div class="ev-rows" id="evArchList"></div></details>
      <details class="folder" id="evSet" data-k="set"><summary>⚙️ Rappels et alertes <span class="count" id="evSetState"></span></summary><div class="inner ev-set stack" id="evSetBody"></div></details>`;
    $("#evRefresh").onclick = refresh;
    $("#evAllSeen").onclick = () => setSeen(EV.filter(e => !e.seen_by_teacher && e.eval_date >= todayStr()).map(e => e.id), true);
    [["evFc", "cls"], ["evFs", "sub"], ["evFf", "from"], ["evFt", "to"]].forEach(([id, k]) => $("#" + id).addEventListener("change", () => { F[k] = $("#" + id).value; renderList(); }));
    panel().addEventListener("click", onClick);
    panel().addEventListener("toggle", ev => { const k = ev.target.dataset && ev.target.dataset.k; if (k) ev.target.open ? opened.add(k) : opened.delete(k); }, true);
  }

  function renderFilters() {
    const cls = [...new Set(EV.map(e => classOf(e.student_id)))].sort((a, b) => a.localeCompare(b, "fr"));
    const sub = new Map(EV.map(e => [subjKey(e), subjName(e)]));
    const opt = (v, t, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t)}</option>`;
    if (F.cls && !cls.includes(F.cls)) F.cls = ""; if (F.sub && !sub.has(F.sub)) F.sub = "";
    $("#evFc").innerHTML = opt("", "Toutes les classes", F.cls) + cls.map(c => opt(c, c, F.cls)).join("");
    $("#evFs").innerHTML = opt("", "Toutes les matières", F.sub) + [...sub].sort((a, b) => a[1].localeCompare(b[1], "fr")).map(([k, n]) => opt(k, n, F.sub)).join("");
    $("#evFf").value = F.from; $("#evFt").value = F.to;
  }

  // ---------- Regroupement : une ligne par classe + matière + date ----------
  const pass = e => (!F.cls || classOf(e.student_id) === F.cls) && (!F.sub || subjKey(e) === F.sub) && (!F.from || e.eval_date >= F.from) && (!F.to || e.eval_date <= F.to);
  function groupsOf(rows) {
    const m = new Map();
    for (const e of rows) {
      const cls = classOf(e.student_id), b = bucket(e), k = [b, cls, subjKey(e), e.eval_date].join("|");
      if (!m.has(k)) m.set(k, { key: k, b, cls, subject: subjName(e), date: e.eval_date, items: [] });
      m.get(k).items.push(e);
    }
    return [...m.values()];
  }
  const ORDER = { none: 0, partial: 1, all: 2 };
  function groupHtml(g) {
    const n = g.items.length, c = k => g.items.filter(e => e.sent_status === k).length, none = c("none"), part = c("partial"), all = c("all");
    const unseen = g.items.some(e => !e.seen_by_teacher), up = g.b === "upcoming";
    const tone = !up ? "mute" : none ? "none" : part ? "part" : "all";
    let line;
    if (up) line = `${n} ${plural(n, "élève a déclaré", "élèves ont déclaré")}, ` + (none ? `${none} ${plural(none, "n'a pas envoyé ses cours", "n'ont pas envoyé leurs cours")}`
      : part ? "tous ont envoyé au moins une partie de leurs cours" : "tous ont envoyé leurs cours");
    else line = `${n} ${plural(n, "déclaration", "déclarations")} · ` + ({ past: "évaluation passée", cancelled: "annulée", postponed: "reportée" })[g.b];
    const when = up ? `<span class="muted">${esc(rel(g.date))}</span>` : "";
    const pills = up ? `<div class="pills">${none ? `<span class="pill ev-none">${none} rien envoyé</span>` : ""}${part ? `<span class="pill ev-part">${part} ${plural(part, "partiel", "partiels")}</span>` : ""}${all ? `<span class="pill ev-all">${all} tout envoyé</span>` : ""}</div>` : "";
    const ids = g.items.map(e => e.id).join(",");
    const rows = g.items.slice().sort((a, b) => ORDER[a.sent_status] - ORDER[b.sent_status] || who(a.student_id).localeCompare(who(b.student_id), "fr")).map(e => {
      const [pc, pl] = state(e);
      const sent = e.sent_status === "all" ? "A envoyé tous ses cours" + (e.sent_details ? " : " + e.sent_details : "") : e.sent_status === "partial" ? "A envoyé : " + (e.sent_details || "une partie") : "N'a encore rien envoyé";
      const extra = e.status === "cancelled" ? `<span class="pill ev-mute">🚫 Annulée</span>` : e.status === "postponed" ? `<span class="pill ev-mute">🔁 Reportée${e.new_date ? " au " + esc(shortDay(e.new_date)) : " (date inconnue)"}</span>` : "";
      return `<div class="ev-row"><div class="row" style="gap:6px 8px"><b>${esc(who(e.student_id))}</b><span class="pill ${pc}">${pl}</span>${extra}${e.seen_by_teacher ? "" : `<span class="badge new">Nouveau</span>`}</div>
        <div class="ev-chap">${esc(e.chapters)}</div>
        <div class="small muted">${esc(sent)} · déclarée le ${esc(stamp(e.created_at))}${new Date(e.updated_at) - new Date(e.created_at) > 60000 ? " · modifiée le " + esc(stamp(e.updated_at)) : ""}</div></div>`;
    }).join("");
    return `<details class="folder ev-g ${tone}" data-k="${esc(g.key)}" ${opened.has(g.key) ? "open" : ""}>
      <summary><div class="ev-sum"><div class="top"><b>${esc(shortDay(g.date))}</b>${when}<span class="badge">${esc(g.cls)}</span><span style="font-weight:700">${esc(g.subject)}</span>${unseen ? `<span class="badge new">Nouveau</span>` : ""}</div>
        <div class="line">${esc(line)}</div>${pills}</div>
        <button class="btn sm ${unseen ? "" : "ghost"} ev-seen" type="button" data-ids="${ids}" data-val="${unseen ? 1 : 0}" title="${unseen ? "Marquer comme traité" : "Remettre en « non vu »"}">${unseen ? "✔ Vu" : "Vu ✓"}</button></summary>
      <div class="ev-rows">${rows}</div></details>`;
  }

  function renderList() {
    if (!built) return;
    const rows = EV.filter(pass);
    const up = groupsOf(rows.filter(e => bucket(e) === "upcoming")).sort((a, b) => a.date.localeCompare(b.date) || a.cls.localeCompare(b.cls, "fr") || a.subject.localeCompare(b.subject, "fr"));
    const old = groupsOf(rows.filter(e => bucket(e) !== "upcoming")).sort((a, b) => b.date.localeCompare(a.date) || a.cls.localeCompare(b.cls, "fr"));
    $("#evUp").innerHTML = up.length ? up.map(groupHtml).join("")
      : `<div class="card empty">${EV.length ? "Aucune évaluation à venir pour ces filtres." : "Aucune évaluation déclarée pour l'instant."}</div>`;
    const shownOld = archAll ? old : old.slice(0, 40);
    $("#evArchN").textContent = old.length ? old.reduce((s, g) => s + g.items.length, 0) : "";
    $("#evArchList").innerHTML = (shownOld.map(groupHtml).join("") || `<p class="small muted" style="margin:0">Rien à ranger ici.</p>`)
      + (old.length > shownOld.length ? `<button class="btn sm ghost" type="button" id="evMore">Afficher les ${old.length - shownOld.length} plus anciennes</button>` : "");
    $("#evArch").open = opened.has("arch"); $("#evSet").open = opened.has("set");
    const nUp = rows.filter(e => bucket(e) === "upcoming"), unseen = EV.filter(e => !e.seen_by_teacher && e.eval_date >= todayStr()).length;
    const c = cfg();
    $("#evStatus").innerHTML = `${nUp.length} ${plural(nUp.length, "déclaration à venir", "déclarations à venir")}${unseen ? ` · <b>${unseen} à voir</b>` : ""} · Rappels aux élèves : <b>${c.reminders_enabled ? "activés" : "désactivés"}</b>`;
    $("#evAllSeen").classList.toggle("hidden", !unseen);
    $("#evSetState").textContent = c.reminders_enabled ? "rappels activés" : "rappels désactivés";
    dots();
  }

  // ---------- Actions ----------
  async function setSeen(ids, val) {
    if (!ids.length) return;
    try { await q(sb.from("evaluations").update({ seen_by_teacher: val }).in("id", ids)); }
    catch (err) { return alert("Erreur : " + err.message); }
    await refresh();
  }
  function onClick(ev) {
    const b = ev.target.closest(".ev-seen");
    if (b) { ev.preventDefault(); ev.stopPropagation(); return setSeen(b.dataset.ids.split(","), b.dataset.val === "1"); }
    if (ev.target.id === "evMore") { archAll = true; renderList(); }
  }
  async function refresh() { if (await load()) { renderFilters(); renderList(); } }

  // ---------- Réglages : rappels aux élèves et alertes ----------
  function renderSettings() {
    const c = draft, pushIds = new Set((S.push || []).filter(p => p.student_id).map(p => p.student_id)), ex = new Set(c.excluded);
    const students = S.students.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const withPush = students.filter(s => pushIds.has(s.id)).length;
    $("#evSetBody").innerHTML = `
      <div><label class="inline" style="font-weight:700"><input type="checkbox" id="evOn" style="width:auto" ${c.reminders_enabled ? "checked" : ""}> Envoyer des rappels automatiques aux élèves</label>
        <div class="hint">Un rappel « As-tu une évaluation à venir ? » est envoyé en notification aux jours et heures ci-dessous. Décochez pour tout arrêter (vacances, par exemple).</div></div>
      <div><label>Jours et heures des rappels <span class="muted small">(heure de Paris)</span></label>
        <div id="evSlots">${c.slots.map((s, i) => `<div class="row ev-slot" data-i="${i}"><select data-f="day" aria-label="Jour">${DAYS.map(([v, l]) => `<option value="${v}" ${v === +s.day ? "selected" : ""}>${l}</option>`).join("")}</select>
          <input type="time" data-f="time" value="${esc(s.time)}" aria-label="Heure"><button class="btn sm ghost" type="button" data-rm="${i}" aria-label="Retirer">✕</button></div>`).join("") || `<p class="small muted" style="margin:0 0 8px">Aucun créneau : ajoutez un jour.</p>`}</div>
        <button class="btn sm ghost" type="button" id="evAdd">➕ Ajouter un jour</button>
        <div class="hint">Un élève qui a déjà au moins une évaluation à venir déclarée ne reçoit pas le rappel.</div></div>
      <div><label for="evTxt">Texte du rappel</label><textarea id="evTxt" maxlength="300" style="min-height:70px">${esc(c.reminder_text)}</textarea>
        <div class="hint">Un lien direct vers le formulaire est ajouté automatiquement. <a href="#" id="evTxtReset">Rétablir le texte par défaut</a></div></div>
      <div><label>Élèves exclus des rappels</label>
        <div class="checks" id="evEx">${students.map(s => `<label><input type="checkbox" value="${esc(s.id)}" ${ex.has(s.id) ? "checked" : ""}> ${esc(s.name)} ${pushIds.has(s.id) ? `<span title="Notifications activées">🔔</span>` : ""}</label>`).join("") || `<span class="small muted">Aucun élève.</span>`}</div>
        <div class="hint">🔔 = notifications activées sur au moins un appareil : ${withPush} élève${withPush > 1 ? "s" : ""} sur ${students.length} peu${withPush > 1 ? "vent" : "t"} recevoir les rappels.</div></div>
      <div><label class="inline" style="font-weight:700"><input type="checkbox" id="evAl" style="width:auto" ${c.alert_enabled ? "checked" : ""}> M'alerter avant une évaluation si des cours n'ont pas été envoyés</label>
        <div class="row" style="margin-top:6px;gap:8px"><input id="evAlD" type="number" min="0" max="14" value="${+c.alert_days}" style="width:80px" aria-label="Nombre de jours"> <span>jour(s) avant l'évaluation <span class="muted small">(alerte envoyée vers 7 h)</span></span></div></div>
      <div class="row"><button class="btn" type="button" id="evSave">💾 Enregistrer</button><button class="btn ghost" type="button" id="evTest">🔔 Envoyer un rappel de test (à moi)</button></div>
      <div id="evSetMsg" class="msg hidden"></div>`;
    const grab = () => {   // lit l'écran pour ne perdre aucune modification en cours
      draft.reminders_enabled = $("#evOn").checked; draft.reminder_text = $("#evTxt").value; draft.alert_enabled = $("#evAl").checked;
      draft.alert_days = Math.min(14, Math.max(0, parseInt($("#evAlD").value, 10) || 0));
      draft.excluded = $$("#evEx input:checked").map(x => x.value);
      draft.slots = $$("#evSlots .ev-slot").map(r => ({ day: +$('[data-f="day"]', r).value, time: $('[data-f="time"]', r).value }));
    };
    $("#evAdd").onclick = () => { grab(); draft.slots.push({ day: 3, time: "18:00" }); renderSettings(); };
    $$("#evSlots [data-rm]").forEach(b => b.onclick = () => { grab(); draft.slots.splice(+b.dataset.rm, 1); renderSettings(); });
    $("#evTxtReset").onclick = e => { e.preventDefault(); $("#evTxt").value = DEF.reminder_text; };
    $("#evSave").onclick = async () => {
      grab(); const msg = $("#evSetMsg");
      const slots = draft.slots.filter(s => /^\d{1,2}:\d{2}$/.test(s.time));
      if (draft.slots.length !== slots.length) return showMsg(msg, "Choisissez une heure pour chaque jour.");
      const uniq = [...new Map(slots.map(s => [s.day + "@" + s.time, s])).values()];
      if (draft.reminders_enabled && !uniq.length) return showMsg(msg, "Ajoutez au moins un jour pour les rappels, ou décochez les rappels.");
      const value = { ...cfg(), ...draft, slots: uniq, reminder_text: draft.reminder_text.trim() || DEF.reminder_text };
      try { await q(sb.from("settings").upsert({ key: "eval_settings", value })); await loadAll(true); }
      catch (err) { return showMsg(msg, "Erreur : " + err.message); }
      draft = { ...cfg() }; renderSettings(); renderList(); showMsg($("#evSetMsg"), "✔ Réglages enregistrés", "ok");
    };
    $("#evTest").onclick = async () => {
      grab(); const msg = $("#evSetMsg"); $("#evTest").disabled = true;
      try {
        const { data: { session } } = await sb.auth.getSession();
        const r = await fetch(NOTIFY_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ eval_test: true }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) throw new Error(d.error || "erreur " + r.status);
        showMsg(msg, d.devices ? `✔ Rappel de test envoyé sur ${d.devices} appareil(s) (texte enregistré : pensez à enregistrer vos modifications).` : "Aucun appareil enregistré : activez d'abord les notifications dans ⚙️ Compte.", d.devices ? "ok" : "err");
      } catch (err) { showMsg(msg, "Envoi impossible : " + err.message); }
      finally { $("#evTest").disabled = false; }
    };
  }

  // ---------- Pastille « à voir » sur l'onglet (légère : un simple comptage) ----------
  async function dots() {
    const el = $("#dotEv"); if (!el) return;
    try {
      const { count, error } = await sb.from("evaluations").select("id", { count: "exact", head: true }).eq("seen_by_teacher", false).gte("eval_date", todayStr());
      el.innerHTML = !error && count ? `<span class="dot">${count}</span>` : "";
    } catch (e) { el.innerHTML = ""; }
  }

  // ---------- Branchements ----------
  async function open() {
    const p = panel();
    if (!built) p.innerHTML = `<div class="card empty">Chargement…</div>`;
    if (!(await load())) return;
    if (!built) { build(); draft = { ...cfg() }; renderSettings(); }
    renderFilters(); renderList();
  }
  const _showTab = showTab;
  showTab = function (name) { _showTab(name); if (name === "evals") open(); };
  setInterval(() => { if (built && shown() && !document.hidden) refresh(); }, 45000);    // la page se met à jour toute seule
  (function wait() {                                                                      // pastille : après la connexion, puis toutes les 2 min
    if ($("#app").classList.contains("hidden")) return setTimeout(wait, 1500);
    dots(); setInterval(dots, 120000);
    if (location.hash === "#evals") showTab("evals");
  })();
})();
