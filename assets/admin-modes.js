/* =====================================================================
   Admin : interrupteur « Mes élèves / Master (Hamid) ».
   - Mode « Mes élèves » : on ne voit que les contenus et les élèves de la classe (le compte personnel « Hamid » n'y est pas).
   - Mode « Master » : on ne voit que les contenus du compte personnel, et la publication est verrouillée sur lui
     (impossible de publier un cours de master à la classe par erreur).
   Ce module n'ajoute rien en base : il filtre l'affichage et enveloppe quelques fonctions de admin.html (rien n'est modifié dans ces fonctions).
   Un « compte personnel » = élève avec la case « 🔒 Compte personnel » cochée (admin › Élèves & groupes › ✏️).
   ===================================================================== */
(() => {
  "use strict";
  const KEY = "adm_mode";
  const read = () => { try { return localStorage.getItem(KEY) === "master" ? "master" : "class"; } catch (e) { return "class"; } };
  let mode = read();

  const solo = () => S.students.filter(s => s.solo);
  const hasSolo = () => S.students.some(s => s.solo);
  // contenu « de master » = envoyé uniquement à des comptes personnels
  const isMasterItem = it => {
    const ids = new Set(solo().map(s => s.id));
    if (!ids.size || it.for_all) return false;
    const t = targetsOf(it);
    return t.length > 0 && t.every(id => ids.has(id));
  };
  const itemInMode = it => mode === "master" ? isMasterItem(it) : !isMasterItem(it);
  const studentInMode = s => mode === "master" ? !!s.solo : !s.solo;

  // appelle fn avec S[key] filtré (puis remet toujours la liste complète)
  function filtered(key, keep, fn) { const all = S[key]; S[key] = all.filter(keep); try { return fn(); } finally { S[key] = all; } }
  function wrap(name, key, keep) {
    const orig = window[name];
    if (typeof orig !== "function") return null;
    window[name] = function (...args) { return hasSolo() ? filtered(key, keep, () => orig.apply(this, args)) : orig.apply(this, args); };
    return orig;
  }

  const origItems = wrap("renderItems", "items", itemInMode);
  wrap("renderSuiviSelect", "items", itemInMode);
  wrap("renderTargets", "students", studentInMode);
  wrap("fillSubjectSelects", "students", studentInMode);
  wrap("renderStudents", "students", studentInMode);
  // les filtres de la liste des contenus appelaient l'ancienne fonction : on les rebranche sur la nouvelle
  if (origItems) ["#fSubject", "#fKind", "#fStudent", "#fStatus"].forEach(sel => {
    const el = document.querySelector(sel); if (!el) return;
    el.removeEventListener("change", origItems); el.addEventListener("change", window.renderItems);
  });

  // ---- barre de choix du mode ----
  const bar = document.createElement("div");
  bar.id = "modeBar"; bar.className = "card"; bar.style.cssText = "padding:10px 12px;margin:0 0 12px;display:none";
  bar.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
    <div class="seg" id="modeSeg"><button type="button" data-m="class">👥 Mes élèves</button><button type="button" data-m="master">🎓 Master (Hamid)</button></div>
    <span class="small muted" id="modeHint"></span><div class="spacer"></div>
    <a class="btn sm ghost" id="modeView" target="_blank" rel="noopener" href="#">👁 Voir son espace</a></div>`;
  const tabs = document.querySelector(".tabs");
  if (tabs) tabs.before(bar);

  let lastApplied = null;
  function apply() {
    const on = hasSolo();
    bar.style.display = on ? "" : "none";
    if (!on) return;
    bar.style.background = mode === "master" ? "#fff7e6" : "";
    bar.querySelectorAll("#modeSeg button").forEach(b => b.classList.toggle("active", b.dataset.m === mode));
    $("#modeHint", bar).textContent = mode === "master"
      ? "Mode Master : vous ne voyez et ne publiez que pour " + solo().map(s => s.name).join(", ") + " (aucun élève de la classe ne le voit)."
      : "Mode classe : vos élèves et leurs contenus.";
    const v = $("#modeView", bar); v.href = "cours.html?voir=" + encodeURIComponent(solo()[0].id); v.textContent = "👁 Voir l'espace de " + solo()[0].name;
    // formulaire « Publier » : en mode Master, seule la cible « Élèves » reste possible (et elle est cochée sur le compte personnel)
    const seg = document.querySelector("#tgtSeg");
    if (seg) {
      seg.querySelectorAll("button").forEach(b => { b.style.display = mode === "master" && b.dataset.t !== "students" ? "none" : ""; });
      if (mode === "master") {
        tgt = "students";
        seg.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.t === "students"));
        renderTargets("#tgtBox", "students", "t");
        document.querySelectorAll("#tgtBox .tchk").forEach(c => { c.checked = true; });
      } else if (lastApplied === "master") {   // retour au mode classe : on revient à « Toute la classe »
        tgt = "all";
        seg.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.t === "all"));
        renderTargets("#tgtBox", "all", "t");
      }
    }
    lastApplied = mode;
  }
  bar.querySelectorAll("#modeSeg button").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.m; try { localStorage.setItem(KEY, mode); } catch (e) {}
    window.renderAll();
  }));

  const origAll = window.renderAll;
  window.renderAll = function (...args) { const r = origAll.apply(this, args); apply(); return r; };
})();
