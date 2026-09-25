/* =====================================================================
   QCM : parseur de texte + lecteur interactif + resultats
   100 % navigateur, aucune API externe.
   Format d'une question (objet) :
     { q: "enonce", choices: ["...", "..."], correct: [2], multi: false, explanation: "..." }
   Le module est pense pour accueillir plus tard : melange des questions /
   propositions, chronometre, tentatives multiples (voir QCM.prepare()).
   ===================================================================== */
const QCM = (() => {
  const LETTERS = "ABCDEFGH";

  // ---------- Expressions reconnues ----------
  const RE = {
    // "Q1.", "Q 1 :", "Question 1 -", "Question n°1", "1.", "1)", "1 -", "Exercice 1 :"
    question: /^(?:(?:q(?:uestion)?|exercice|ex)\s*(?:n\s*[°o.]?\s*)?(\d{1,3})\s*[\).:\-–—]?|(\d{1,3})\s*[\).:\-–—])\s*(.*)$/i,
    // "A.", "A)", "a)", "(A)", "[A]", "A -", "A :"  (avec marqueur facultatif * ou ✓ avant)
    choice: /^([*✓✔✅]\s*)?(?:\(\s*([A-Ha-h])\s*\)|\[\s*([A-Ha-h])\s*\]|([A-Ha-h])\s*[\).:\-–—])\s+(.+)$/,
    // "Réponse : C", "Bonne réponse : B", "Réponses correctes : A, C", "Answer: B", "Solution - C", "Corrigé : C"
    answer: /^[^\wÀ-ÿ(\[]*(?:la\s+)?(?:bonnes?\s+)?(?:r[ée]ponses?|solutions?|corrig[ée]s?|answers?|correct\s+answers?|cl[ée])(?:\s+(?:correctes?|justes?|exactes?|attendues?|vraies?))?\s*(?:\(s\))?\s*[:：=\-–—]\s*(.+)$/i,
    answerAlone: /^[^\wÀ-ÿ(\[]*(?:r[ée]ponses?|corrig[ée]s?|solutions?|answers?|answer\s+key|cl[ée]\s+de\s+correction)\s*[:：]?\s*$/i,
    explanation: /^[^\wÀ-ÿ(\[]*(?:explications?|justifications?|commentaires?|pourquoi|explanation|rationale|remarques?|d[ée]tails?|correction)\s*[:：=\-–—]\s*(.*)$/i,
    correctMark: /\s*(?:[✓✔✅]|\(\s*(?:correct|correcte|bonne\s+r[ée]ponse|vrai|juste|x)\s*\)|\*{1,2})\s*$/i,
  };

  const clean = s => s.replace(/ /g, " ").replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
  const norm = s => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w%]+/g, " ").trim();

  // Extrait les lettres d'une reponse ("C", "c)", "A et C", "A, C", "B - Ohm", "Ohm")
  function lettersFrom(value, choices) {
    const v = clean(value).replace(/^[\(\[]/, "");
    const m = v.match(/^([A-Ha-h])(?:\s*(?:,|;|\/|&|\+|et|and|ou)\s*([A-Ha-h]))*(?=$|[\s\).:\-–—\]])/);
    if (m) {
      const letters = (m[0].match(/\b[A-Ha-h]\b/g) || []).map(l => LETTERS.indexOf(l.toUpperCase()));
      if (letters.length && letters.every(i => i >= 0 && (!choices.length || i < choices.length))) return [...new Set(letters)].sort((a, b) => a - b);
    }
    // sinon : on compare au texte des propositions
    const nv = norm(v);
    if (!nv) return [];
    let idx = choices.findIndex(c => norm(c) === nv);
    if (idx < 0) idx = choices.findIndex(c => norm(c) && (nv.startsWith(norm(c)) || norm(c).startsWith(nv)));
    return idx >= 0 ? [idx] : [];
  }

  function parse(text) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n")
      .map(l => l.replace(/ /g, " ").replace(/^\s*(?:[-•▪◦·]\s+)/, "").replace(/\*\*|__/g, "").trim());
    const qs = [], warnings = [];
    let cur = null, mode = "q";     // q = enonce, c = propositions, a = apres reponse, e = explication
    const keyAnswers = {};         // grille de reponses en fin de texte : { numero: "C" }
    let inKey = false;

    const start = (num, txt) => {
      cur = { num: num || qs.length + 1, q: txt || "", choices: [], marks: [], answerRaw: null, explanation: "" };
      qs.push(cur); mode = "q";
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) { if (mode === "e") mode = "a"; continue; }

      // Grille de reponses : "Réponses :" seul puis "1-C", "2 : B"... ou "1-C, 2-B, 3-C" sur une ligne
      if (RE.answerAlone.test(line)) {
        const next = lines.slice(i + 1).find(l => l);
        if (!cur || cur.answerRaw !== null || !cur.choices.length || (next && /^(?:q\s*)?\d{1,3}\s*[\).:\-–—=]?\s*[A-Ha-h](?:$|[\s,;.])/i.test(next))) { inKey = true; continue; }
      }
      const pairs = [...line.matchAll(/(?:^|[\s,;])(?:q\s*)?(\d{1,3})\s*[\).:\-–—=]?\s*([A-Ha-h])(?=$|[\s,;.])/gi)];
      const onlyPairs = pairs.length && line.replace(/(?:q\s*)?\d{1,3}\s*[\).:\-–—=]?\s*[A-Ha-h](?=$|[\s,;.])/gi, "").replace(/[\s,;.]/g, "") === "";
      if (onlyPairs && (inKey || pairs.length >= 2)) { pairs.forEach(p => keyAnswers[+p[1]] = p[2]); inKey = true; continue; }
      if (!cur && RE.answer.test(line)) continue; // reponse avant toute question : ignoree

      // Reponse
      const am = line.match(RE.answer);
      if (am && cur) {
        const inlinePairs = [...am[1].matchAll(/(?:q\s*)?(\d{1,3})\s*[\).:\-–—=]\s*([A-Ha-h])\b/gi)];
        if (inlinePairs.length >= 2) { inlinePairs.forEach(p => keyAnswers[+p[1]] = p[2]); inKey = true; continue; }
        cur.answerRaw = am[1]; mode = "a";
        // "Réponse : C — explication" / "Réponse : C car ..."
        const rest = am[1].match(/^\(?[A-Ha-h](?:\s*(?:,|;|\/|&|\+|et|and)\s*[A-Ha-h])*\)?\s*(?:[\).:\-–—]\s*[^\s].{0,60}?)?\s*(?:[–—]|\s-\s|\bcar\b|\bparce que\b|\bbecause\b)\s*(.{3,})$/i);
        if (rest) { cur.explanation = rest[1].trim(); }
        continue;
      }
      // Explication
      const em = line.match(RE.explanation);
      if (em && cur) { cur.explanation = (cur.explanation ? cur.explanation + " " : "") + em[1].trim(); mode = "e"; continue; }

      // Nouvelle question
      const qm = line.match(RE.question);
      const cm = line.match(RE.choice);
      if (qm) {
        // "1." pourrait etre une proposition numerotee : on l'accepte comme question
        // seulement si la question courante est complete ou n'existe pas.
        const txt = qm[3] || "";
        if (!cur || cur.choices.length || cur.answerRaw !== null || !cur.q) { start(+(qm[1] || qm[2]), txt); inKey = false; continue; }
      }
      // Proposition
      if (cm && cur && mode !== "a" && mode !== "e") {
        const letter = (cm[2] || cm[3] || cm[4]).toUpperCase();
        let txt = cm[5];
        let marked = !!cm[1];
        if (RE.correctMark.test(txt)) { marked = true; txt = txt.replace(RE.correctMark, ""); }
        const expected = LETTERS[cur.choices.length];
        if (letter === expected || !cur.choices.length) {
          cur.choices.push(clean(txt)); cur.marks.push(marked); mode = "c"; continue;
        }
      }
      // Ligne de texte libre
      if (!cur) {
        if (/\?\s*$/.test(line)) start(qs.length + 1, line); // question non numerotee
        continue; // sinon : titre / consigne ignores
      }
      if (mode === "q") cur.q = clean(cur.q + " " + line);
      else if (mode === "c") {
        if (/\?\s*$/.test(line) && cur.choices.length >= 2) { start(qs.length + 1, line); continue; }
        cur.choices[cur.choices.length - 1] = clean(cur.choices[cur.choices.length - 1] + " " + line);
      }
      else if (mode === "e") cur.explanation = clean(cur.explanation + " " + line);
      else if (mode === "a") {
        if (/\?\s*$/.test(line)) { start(qs.length + 1, line); continue; }
        cur.explanation = clean((cur.explanation ? cur.explanation + " " : "") + line); mode = "e";
      }
    }

    // Construction finale + verifications
    const out = qs.map((c, k) => {
      let correct = [];
      if (c.answerRaw !== null) correct = lettersFrom(c.answerRaw, c.choices);
      if (!correct.length && keyAnswers[c.num]) correct = lettersFrom(keyAnswers[c.num], c.choices);
      if (!correct.length && keyAnswers[k + 1]) correct = lettersFrom(keyAnswers[k + 1], c.choices);
      if (!correct.length) correct = c.marks.map((m, i) => m ? i : -1).filter(i => i >= 0);
      const q = { q: clean(c.q.replace(/^[:\-–—]\s*/, "")), choices: c.choices, correct, multi: correct.length > 1 };
      if (c.explanation) q.explanation = clean(c.explanation);
      const n = k + 1;
      if (!q.q) warnings.push({ n, level: "err", msg: "énoncé introuvable" });
      if (q.choices.length < 2) warnings.push({ n, level: "err", msg: `seulement ${q.choices.length} proposition(s) détectée(s) (il en faut au moins 2 : A. … B. …)` });
      if (!q.correct.length) warnings.push({ n, level: "err", msg: c.answerRaw !== null ? `réponse « ${clean(c.answerRaw)} » non reconnue` : "bonne réponse non trouvée (ajoutez « Réponse : B »)" });
      return q;
    });
    if (!out.length) warnings.push({ n: 0, level: "err", msg: "aucune question détectée. Commencez chaque question par « Q1. », « 1. » ou « Question 1 : »." });
    return { questions: out, warnings, ok: out.length > 0 && !warnings.some(w => w.level === "err") };
  }

  // ---------- Notation ----------
  const sameSet = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
  function score(quiz, answers) {
    let good = 0;
    const detail = quiz.map((q, i) => { const ok = sameSet((answers[i] || []).map(Number), q.correct || []); if (ok) good++; return ok; });
    const total = quiz.length, unanswered = quiz.filter((q, i) => !(answers[i] || []).length).length;
    return { good, bad: total - good, unanswered, total, pct: total ? Math.round(good / total * 100) : 0, sur20: total ? Math.round(good / total * 200) / 10 : 0, detail };
  }

  // Point d'extension : melange / chronometre / tentatives (non actives en v1)
  function prepare(quiz, settings = {}) {
    return quiz.map((q, i) => ({ ...q, _i: i })); // ordre d'origine
  }

  // ---------- Lecteur interactif ----------
  // opts: { title, answers (initiales), onFinish(answers) -> Promise, preview (bool) }
  function player(el, quiz, opts = {}) {
    const qz = prepare(quiz, opts.settings);
    const ans = qz.map((q, i) => (opts.answers && opts.answers[i]) ? [...opts.answers[i]] : []);
    let i = 0;
    const draw = () => {
      const q = qz[i], n = qz.length, done = ans.filter(a => a.length).length;
      el.innerHTML = `
        <div class="qz">
          <div class="qz-top"><span class="qz-count">Question ${i + 1} / ${n}</span><span class="small muted">${done} / ${n} répondue(s)</span></div>
          <div class="qz-bar"><span style="width:${(i + 1) / n * 100}%"></span></div>
          <div class="qz-q">${esc(q.q)}</div>
          ${q.multi ? `<div class="hint" style="margin:-6px 0 10px">Plusieurs réponses possibles</div>` : ""}
          <div class="qz-choices">${q.choices.map((c, ci) => `
            <button type="button" class="qz-opt ${ans[i].includes(ci) ? "sel" : ""}" data-ci="${ci}">
              <span class="qz-letter">${LETTERS[ci]}</span><span>${esc(c)}</span></button>`).join("")}</div>
          <div class="qz-nav">
            <button type="button" class="btn ghost" data-nav="-1" ${i === 0 ? "disabled" : ""}>← Précédente</button>
            <div class="qz-dots">${qz.map((_, k) => `<button type="button" class="qz-dot ${k === i ? "cur" : ""} ${ans[k].length ? "ok" : ""}" data-go="${k}" title="Question ${k + 1}">${k + 1}</button>`).join("")}</div>
            ${i < n - 1 ? `<button type="button" class="btn" data-nav="1">Suivante →</button>`
                        : `<button type="button" class="btn" data-finish="1">${opts.preview ? "Voir le résultat" : "Terminer ✓"}</button>`}
          </div>
          <div class="qz-msg msg hidden"></div>
        </div>`;
      el.querySelectorAll(".qz-opt").forEach(b => b.onclick = () => {
        const ci = +b.dataset.ci;
        if (q.multi) ans[i] = ans[i].includes(ci) ? ans[i].filter(x => x !== ci) : [...ans[i], ci];
        else ans[i] = [ci];
        draw();
        if (!q.multi && i < n - 1) setTimeout(() => { i++; draw(); }, 220); // passe a la suivante
      });
      el.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => { i += +b.dataset.nav; draw(); });
      el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { i = +b.dataset.go; draw(); });
      const fin = el.querySelector("[data-finish]");
      if (fin) fin.onclick = async () => {
        const missing = ans.map((a, k) => a.length ? 0 : k + 1).filter(Boolean);
        if (missing.length && !confirm(`Question(s) sans réponse : ${missing.join(", ")}.\nTerminer quand même ?`)) { i = missing[0] - 1; draw(); return; }
        fin.disabled = true;
        try { await opts.onFinish(ans.map(a => [...a].sort((x, y) => x - y))); }
        catch (err) { fin.disabled = false; const m = el.querySelector(".qz-msg"); m.className = "qz-msg msg err"; m.textContent = "Erreur : " + (err.message || err); }
      };
    };
    draw();
  }

  // ---------- Ecran de resultat + corrections ----------
  function result(el, quiz, answers, opts = {}) {
    const r = score(quiz, answers || []);
    const emoji = r.pct >= 80 ? "🎉" : r.pct >= 50 ? "👍" : "💪";
    el.innerHTML = `
      <div class="qz">
        <div class="qz-result">
          <div class="qz-emoji">${emoji}</div>
          <div class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Résultat</div>
          <div class="qz-big">${r.good} / ${r.total}</div>
          <div class="qz-kpis"><div><b>${r.pct} %</b><span>réussite</span></div><div><b>${String(r.sur20).replace(".", ",")} / 20</b><span>note</span></div></div>
          <div class="qz-counts"><span class="pill done">✔ ${r.good} bonne(s) réponse(s)</span><span class="pill late">✘ ${r.bad} mauvaise(s) réponse(s)</span>${r.unanswered ? `<span class="pill wait">dont ${r.unanswered} sans réponse</span>` : ""}</div>
          <div class="row" style="justify-content:center;margin-top:16px">
            <button type="button" class="btn" data-corr>Voir les corrections</button>
            ${opts.onRetry ? `<button type="button" class="btn ghost" data-retry>Recommencer</button>` : ""}
          </div>
        </div>
        <div class="qz-review hidden">${quiz.map((q, k) => {
          const mine = (answers && answers[k]) || [], ok = r.detail[k];
          const fmt = arr => arr.length ? arr.map(ci => `<b>${LETTERS[ci]}.</b> ${esc(q.choices[ci] ?? "?")}`).join(" · ") : `<i>Pas de réponse</i>`;
          return `<div class="qz-rv ${ok ? "ok" : "ko"}">
            <div class="row" style="gap:8px;align-items:flex-start"><span class="qz-tag">${ok ? "✔" : "✘"}</span><div style="flex:1"><div class="small muted">Question ${k + 1}</div><div style="font-weight:600;white-space:pre-wrap">${esc(q.q)}</div></div></div>
            <div class="qz-rv-lines">
              <div><span class="muted small">Votre réponse :</span> ${fmt(mine)}</div>
              ${ok ? "" : `<div><span class="muted small">Bonne réponse :</span> ${fmt(q.correct || [])}</div>`}
              ${q.explanation ? `<div class="qz-expl">💡 ${esc(q.explanation)}</div>` : ""}
            </div></div>`;
        }).join("")}</div>
      </div>`;
    const btn = el.querySelector("[data-corr]"), rv = el.querySelector(".qz-review");
    btn.onclick = () => { rv.classList.toggle("hidden"); btn.textContent = rv.classList.contains("hidden") ? "Voir les corrections" : "Masquer les corrections"; if (!rv.classList.contains("hidden")) rv.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const rt = el.querySelector("[data-retry]"); if (rt) rt.onclick = opts.onRetry;
    return r;
  }

  const EXAMPLE = `Q1. Quelle est l'unité de la résistance électrique ?
A. Volt
B. Ampère
C. Ohm
D. Watt
Réponse : C
Explication : la résistance se mesure en ohms (Ω).

Q2. Quelle est la loi d'Ohm ?
A. U = R/I
B. U = R × I
C. U = I/R
D. U = R + I
Réponse : B

Q3. Un courant de 2 A traverse une résistance de 10 Ω. Quelle est la tension ?
A. 5 V
B. 10 V
C. 20 V
D. 40 V
Réponse : C
Explication : U = R × I = 10 × 2 = 20 V.`;

  return { parse, score, player, result, prepare, LETTERS, EXAMPLE };
})();
