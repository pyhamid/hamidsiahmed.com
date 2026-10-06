/* =====================================================================
   Lecteur de documents (PDF, images, vidéos) qui respecte les choix du professeur :
   téléchargement autorisé / interdit, impression autorisée / interdite.
   - PDF : affiché page par page avec pdf.js (chargé seulement si besoin), sans bouton
     de téléchargement natif. Les pages sont dessinées au fur et à mesure du défilement.
   - Impression interdite : la page imprimée ne contient qu'un message.
   NB : c'est une protection dissuasive. Aucun site ne peut empêcher une capture d'écran.
   Autonome : utilisable depuis l'espace élève comme depuis les pages publiques.
   ===================================================================== */
(() => {
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let libP = null, el = null, cur = null;

  function lib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return libP = libP || new Promise((ok, ko) => {
      const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      s.onerror = () => { libP = null; ko(new Error("lecteur PDF indisponible (connexion ?)")); };
      document.head.appendChild(s);
    });
  }
  const kindOf = (name, mime) => {
    const n = String(name || "").toLowerCase(), m = String(mime || "");
    if (m === "application/pdf" || /\.pdf$/.test(n)) return "pdf";
    if (/^image\//.test(m) || /\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return "img";
    if (/^video\//.test(m) || /\.(mp4|webm|mov|m4v)$/.test(n)) return "video";
    if (/^audio\//.test(m) || /\.(mp3|m4a|wav|ogg)$/.test(n)) return "audio";
    return "other";
  };

  function shell() {
    if (el) return el;
    el = document.createElement("div"); el.id = "dv"; el.className = "dv";
    el.innerHTML = `<div class="dv-bar"><b class="dv-title"></b><span class="dv-info small"></span><div class="dv-sp"></div>
      <button type="button" class="btn sm ghost dv-print hidden">🖨 Imprimer</button>
      <button type="button" class="btn sm ghost dv-dl hidden">⬇ Télécharger</button>
      <button type="button" class="btn sm dv-x">Fermer ✕</button></div>
      <div class="dv-body"></div><div class="dv-printmsg">L'impression de ce document n'est pas autorisée.</div>`;
    document.body.appendChild(el);
    el.querySelector(".dv-x").onclick = close;
    document.addEventListener("keydown", e => { if (e.key === "Escape" && el.classList.contains("open")) close(); });
    return el;
  }
  function close() {
    if (!el) return;
    el.classList.remove("open"); document.body.classList.remove("dv-open", "dv-noprint", "dv-printing");
    el.querySelector(".dv-body").innerHTML = "";
    if (cur && cur.io) cur.io.disconnect();
    if (cur && cur.doc) cur.doc.destroy();
    cur = null; document.body.style.overflow = "";
  }

  // opts : { title, name, mime, url (lien d'affichage), download (bool), print (bool), getDownloadUrl: async () => url }
  async function open(opts) {
    const box = shell(), body = box.querySelector(".dv-body");
    if (cur) close();
    cur = { opts };
    const k = kindOf(opts.name, opts.mime);
    box.querySelector(".dv-title").textContent = opts.title || opts.name || "Document";
    box.querySelector(".dv-info").textContent = "";
    const dl = box.querySelector(".dv-dl"), pr = box.querySelector(".dv-print");
    dl.classList.toggle("hidden", !opts.download);
    pr.classList.toggle("hidden", !opts.print || !["pdf", "img"].includes(k));
    dl.onclick = async () => { try { location.href = opts.getDownloadUrl ? await opts.getDownloadUrl() : opts.url; } catch (e) { alert("Téléchargement impossible : " + e.message); } };
    pr.onclick = () => printNow(k);
    box.classList.toggle("locked", !opts.download);
    document.body.classList.toggle("dv-noprint", !opts.print);
    box.classList.add("open"); document.body.classList.add("dv-open"); document.body.style.overflow = "hidden";
    const block = e => { if (!opts.download) e.preventDefault(); };
    body.oncontextmenu = block; body.ondragstart = block;

    if (k === "img") { body.innerHTML = `<div class="dv-pages"><img class="dv-page" src="${h(opts.url)}" alt="${h(opts.title || "")}" draggable="false"></div>`; return; }
    if (k === "video") { body.innerHTML = `<div class="dv-media"><video src="${h(opts.url)}" controls playsinline preload="metadata" ${opts.download ? "" : `controlslist="nodownload" disablepictureinpicture`}></video></div>`; return; }
    if (k === "audio") { body.innerHTML = `<div class="dv-media"><audio src="${h(opts.url)}" controls preload="metadata" ${opts.download ? "" : `controlslist="nodownload"`}></audio></div>`; return; }
    if (k === "other") {
      body.innerHTML = `<div class="dv-msg"><p><b>${h(opts.name || "Fichier")}</b></p><p>Ce type de fichier ne peut pas être affiché dans le navigateur.</p>
        ${opts.download ? `<button type="button" class="btn">⬇ Télécharger le fichier</button>` : `<p class="small">Le téléchargement n'est pas autorisé pour ce document.</p>`}</div>`;
      const b = body.querySelector(".dv-msg .btn"); if (b) b.onclick = dl.onclick;
      return;
    }
    // ---------- PDF ----------
    body.innerHTML = `<div class="dv-msg">Chargement du document…</div>`;
    try {
      const pdfjs = await lib();
      const doc = await pdfjs.getDocument({ url: opts.url, disableAutoFetch: true }).promise;
      if (!cur || cur.opts !== opts) { doc.destroy(); return; }
      cur.doc = doc;
      box.querySelector(".dv-info").textContent = doc.numPages + " page" + (doc.numPages > 1 ? "s" : "");
      body.innerHTML = `<div class="dv-pages"></div>`;
      const wrap = body.querySelector(".dv-pages");
      const first = await doc.getPage(1), vp = first.getViewport({ scale: 1 });
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const d = document.createElement("div"); d.className = "dv-page dv-ph"; d.dataset.n = n;
        d.style.aspectRatio = `${vp.width} / ${vp.height}`; wrap.appendChild(d); pages.push(d);
      }
      cur.pages = pages;
      cur.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) renderPage(e.target); }), { root: body, rootMargin: "600px 0px" });
      pages.forEach(p => cur.io.observe(p));
    } catch (e) {
      body.innerHTML = `<div class="dv-msg">Impossible d'afficher ce document.<br><span class="small">${h(e.message || e)}</span></div>`;
    }
  }
  async function renderPage(ph) {
    if (!cur || !cur.doc || ph.dataset.done) return;
    ph.dataset.done = "1";
    try {
      const page = await cur.doc.getPage(+ph.dataset.n);
      const w = Math.min(ph.clientWidth || 800, 1100), base = page.getViewport({ scale: 1 });
      const scale = (w / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas"); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      ph.classList.remove("dv-ph"); ph.innerHTML = ""; ph.appendChild(c);
    } catch (e) { delete ph.dataset.done; }
  }
  async function printNow(k) {
    if (!cur || !cur.opts.print) return;
    if (k === "pdf" && cur.pages) {
      const info = el.querySelector(".dv-info"), t = info.textContent;
      for (let i = 0; i < cur.pages.length; i++) { info.textContent = `Préparation de l'impression… ${i + 1}/${cur.pages.length}`; await renderPage(cur.pages[i]); }
      info.textContent = t;
    }
    document.body.classList.add("dv-printing");
    setTimeout(() => { window.print(); document.body.classList.remove("dv-printing"); }, 50);
  }

  // Vidéo en ligne (YouTube / Vimeo) : adresse d'intégration, chargée seulement au clic
  function embed(url) {
    const u = String(url || "");
    let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { src: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null };
    return null;
  }
  // Remplace un bouton « lecture » par la vidéo (aucun chargement avant le clic)
  function videoFacade(container, url, title) {
    const e = embed(url);
    if (!e) { container.innerHTML = `<a class="btn" href="${h(url)}" target="_blank" rel="noopener">▶ Voir la vidéo</a>`; return; }
    container.innerHTML = `<button type="button" class="vf" aria-label="Lire la vidéo">${e.thumb ? `<img src="${h(e.thumb)}" alt="" loading="lazy">` : ""}<span class="vf-play">▶</span></button>`;
    container.querySelector(".vf").onclick = () => {
      container.innerHTML = `<div class="vf-frame"><iframe src="${h(e.src)}" title="${h(title || "Vidéo")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    };
  }

  window.DocViewer = { open, close, embed, videoFacade, kindOf };
})();
