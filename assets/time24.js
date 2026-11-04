/* =====================================================================
   Heures toujours en 24 h (jamais AM / PM), quel que soit le réglage du navigateur.
   Les champs « heure » et « date + heure » natifs suivent la langue du navigateur (12 h en anglais) et la page ne peut pas
   le changer : ils sont remplacés par des listes (heures 00–23, minutes 00–59). Le code de la page n'a rien à changer :
   le nouvel élément garde le même identifiant et la même propriété .value ("HH:MM" ou "AAAA-MM-JJTHH:MM"), et les
   champs créés plus tard (fenêtres, réglages) sont convertis automatiquement.
   ===================================================================== */
(() => {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  const css = document.createElement("style");
  css.textContent = `.t24{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;min-width:0}
.t24 select{width:auto;flex:0 0 auto;min-width:0;padding:10px 8px}
.t24 input[type=date]{flex:1 1 140px;width:auto;min-width:0}
.t24 .sep{font-weight:700}`;
  document.head.appendChild(css);

  const range = (n, sel) => Array.from({ length: n }, (_, i) => `<option value="${pad(i)}" ${pad(i) === sel ? "selected" : ""}>${pad(i)}</option>`).join("");
  const split = v => { const m = /^(?:(\d{4}-\d{2}-\d{2})T)?(\d{1,2}):(\d{2})/.exec(String(v || "")); return m ? { d: m[1] || "", h: pad(+m[2]), m: m[3] } : { d: (/^\d{4}-\d{2}-\d{2}/.exec(String(v || "")) || [""])[0], h: "", m: "" }; };

  function upgrade(input) {
    if (input.dataset.t24 || !input.parentNode) return;
    const dt = input.type === "datetime-local", p = split(input.value);
    const w = document.createElement("span");
    for (const a of input.attributes) if (!["type", "value", "min", "max", "step", "required"].includes(a.name)) w.setAttribute(a.name, a.value);
    w.classList.add("t24"); w.dataset.t24 = dt ? "dt" : "t";
    const h0 = p.h || (dt ? "08" : "00"), m0 = p.m || "00";
    w.innerHTML = `${dt ? `<input type="date" aria-label="Date" value="${p.d}">` : ""}<select aria-label="Heure">${range(24, h0)}</select><span class="sep">:</span><select aria-label="Minutes">${range(60, m0)}</select>`;
    const d = w.querySelector("input"), [h, m] = w.querySelectorAll("select");
    Object.defineProperty(w, "value", {
      get() { return dt ? (d.value ? `${d.value}T${h.value}:${m.value}` : "") : `${h.value}:${m.value}`; },
      set(v) { const q = split(v); if (dt) d.value = q.d; h.value = q.h || (dt ? "08" : "00"); m.value = q.m || "00"; },
    });
    w.focus = () => (d || h).focus();
    input.replaceWith(w);
  }
  const scan = root => root.querySelectorAll && root.querySelectorAll('input[type="time"], input[type="datetime-local"]').forEach(upgrade);
  scan(document);
  new MutationObserver(list => { for (const r of list) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches('input[type="time"], input[type="datetime-local"]')) upgrade(n); else scan(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
