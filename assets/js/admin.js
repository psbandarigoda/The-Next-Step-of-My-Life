// Third Eye Admin - fully database driven.
// Girls (profiles + photos) live in Supabase via the "girls" Edge Function and
// Storage; responses live via the "date-response" Edge Function. Nothing here
// touches local files, so adding/editing/removing a girl is instant and live.
(function () {
  "use strict";

  const CREDENTIALS = { user: "root", pass: "root" };

  const CFG = {
    girlsUrl: "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/girls",
    responseUrl: "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/date-response",
    anon:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqemh3bnp0bHFiZnlqbnJxdnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY1NzIsImV4cCI6MjA5NzE2MjU3Mn0.feyDSuD951TGndME1dElGikBZ8lwzSctpE7xbQUH-tM",
    adminKey: "ns_live_7Qk2Vp9mZx4Rt6Bw3Ln8Yh1Cd0Js5Ae",
  };

  // Default words for a brand-new girl. {name} becomes her real name on the page.
  const DEFAULTS = {
    eyebrow: "A tiny surprise invitation",
    headline: "{name}, your smile deserves a beautiful date.",
    intro:
      "I made this little page just for you, {name}, because asking you the normal way felt too small for someone this lovely.",
    polaroidCaption: "My favorite view",
    question: "Will you go on a date with me, {name}?",
    questionSub:
      "One evening. Good food. A little walk. A lot of smiles. And me trying my best to make you feel special.",
    planTitle: "When are you free, {name}?",
    finaleTitle: "I will make it sweet, simple, and unforgettable.",
    finaleMessage:
      "If you say yes, I will bring the smile, the care, and a little surprise just for you.",
    reasons: [
      { title: "Your smile", text: "It quietly turns an ordinary moment into my favorite part of the day." },
      { title: "Your energy", text: "You carry a warmth that makes everything around you feel lighter." },
      { title: "Your presence", text: "I just want one evening where the only plan is making you feel special." },
    ],
  };

  const SLOT_LABELS = ["Main hero photo", "Floating photo 1", "Floating photo 2", "Polaroid close-up", "Finale photo"];

  const $ = (id) => document.getElementById(id);
  const adminHeaders = () => ({ apikey: CFG.anon, Authorization: `Bearer ${CFG.anon}`, "x-admin-key": CFG.adminKey });
  const linkBase = location.origin + location.pathname.split("/Third-Eye")[0] + "/";
  const girlLink = (slug) => linkBase + slug;

  let currentUrls = []; // existing photo URLs per slot while editing
  let lastResponses = [];

  /* ---------------- login ---------------- */
  if (sessionStorage.getItem("tns:auth") === "1") showAdmin();

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("loginUser").value.trim() === CREDENTIALS.user && $("loginPass").value === CREDENTIALS.pass) {
      sessionStorage.setItem("tns:auth", "1");
      $("loginError").textContent = "";
      showAdmin();
    } else {
      $("loginError").textContent = "Wrong username or password.";
    }
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("tns:auth");
    location.reload();
  });

  function showAdmin() {
    $("loginView").classList.add("hidden");
    $("adminView").classList.remove("hidden");
    buildSlots();
    wireTabs();
    wireGirls();
    wireEditor();
    wireResponses();
    loadGirls();
    loadResponses();
  }

  /* ---------------- tabs / panels ---------------- */
  function wireTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => showPanel(tab.dataset.tab));
    });
  }

  function showPanel(name) {
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    $(`panel-${name}`).classList.add("active");
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  }

  /* ---------------- girls list ---------------- */
  function wireGirls() {
    $("refreshGirls").addEventListener("click", loadGirls);
    $("addGirlBtn").addEventListener("click", () => openEditor("add"));
  }

  async function loadGirls() {
    const list = $("girlsList");
    $("girlsLoading").classList.remove("hidden");
    $("girlsEmpty").classList.add("hidden");
    list.innerHTML = "";
    let girls = [];
    try {
      const res = await fetch(CFG.girlsUrl, { headers: adminHeaders(), cache: "no-store" });
      const data = await res.json();
      girls = (data && data.girls) || [];
    } catch (_) {
      toast("Could not load girls. Check your connection.", "error");
    }
    $("girlsLoading").classList.add("hidden");
    $("girlsCount").textContent = girls.length ? `${girls.length} girl${girls.length > 1 ? "s" : ""} in the system` : "Existing girls";

    if (!girls.length) {
      $("girlsEmpty").classList.remove("hidden");
      return;
    }

    girls.forEach((g) => {
      const cover = (g.images && g.images[0]) || "";
      const tile = document.createElement("div");
      tile.className = "girl-tile";
      tile.innerHTML = `
        ${cover ? `<img src="${escapeAttr(cover)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:16px;margin-bottom:12px;">` : ""}
        <h3>${escapeHtml(g.name || "")}</h3>
        <p class="slug">${escapeHtml(g.slug || "")}</p>
        <div class="link-row">
          <input type="text" readonly value="${escapeAttr(girlLink(g.slug))}">
          <button class="btn-ghost" type="button" data-copy>Copy</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <a class="btn-ghost" href="${escapeAttr(girlLink(g.slug))}" target="_blank" rel="noopener">Open</a>
          <button class="btn-ghost" type="button" data-edit>Edit</button>
          <button class="reset-response" type="button" data-del>Delete</button>
        </div>`;
      tile.querySelector("[data-copy]").addEventListener("click", () => {
        copyText(girlLink(g.slug));
        toast("Link copied.", "ok");
      });
      tile.querySelector("[data-edit]").addEventListener("click", () => editGirl(g.slug));
      tile.querySelector("[data-del]").addEventListener("click", () => deleteGirl(g));
      list.appendChild(tile);
    });
  }

  async function editGirl(slug) {
    toast("Loading her page...", "ok");
    try {
      const res = await fetch(`${CFG.girlsUrl}?slug=${encodeURIComponent(slug)}`, { headers: adminHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!data || !data.ok || !data.girl) throw new Error("not found");
      openEditor("edit", data.girl);
    } catch (_) {
      toast("Could not load that girl.", "error");
    }
  }

  async function deleteGirl(g) {
    if (!confirm(`Delete ${g.name} (${g.slug})? Her page, photos and profile will be removed. This cannot be undone.`)) return;
    try {
      const res = await fetch(`${CFG.girlsUrl}?slug=${encodeURIComponent(g.slug)}`, { method: "DELETE", headers: adminHeaders() });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("delete failed");
      toast(`${g.name} removed.`, "ok");
      loadGirls();
    } catch (_) {
      toast("Could not delete. Try again.", "error");
    }
  }

  /* ---------------- editor (add / edit) ---------------- */
  function buildSlots() {
    $("imageSlots").innerHTML = SLOT_LABELS.map(
      (label, i) => `
      <div class="field">
        <label>${label}${i === 0 ? " *" : ""}
          <input id="img${i}" type="file" accept="image/png,image/jpeg,image/webp">
        </label>
        <div class="thumbs"><img id="prev${i}" alt="" class="hidden" style="width:96px;height:120px;object-fit:cover;border-radius:14px;"></div>
      </div>`
    ).join("");
    for (let i = 0; i < 5; i += 1) $(`img${i}`).addEventListener("change", () => previewSlot(i));
  }

  function wireEditor() {
    $("editorBack").addEventListener("click", () => showPanel("girls"));
    $("resetDefaults").addEventListener("click", () => {
      fillWords(DEFAULTS);
      toast("Words reset to defaults.", "ok");
    });
    $("fName").addEventListener("input", () => {
      if (!$("fSlug").dataset.touched) {
        $("fSlug").value = slugify($("fName").value);
        updateLinkPreview();
      }
    });
    $("fSlug").addEventListener("input", () => {
      $("fSlug").dataset.touched = "1";
      $("fSlug").value = slugify($("fSlug").value);
      updateLinkPreview();
    });
    $("girlForm").addEventListener("submit", saveGirl);
  }

  function openEditor(mode, girl) {
    $("editorMode").value = mode;
    $("editorTitle").textContent = mode === "edit" ? "Edit girl" : "Add a girl";
    $("editorStatus").textContent = "";
    currentUrls = [];
    // reset file inputs + previews
    for (let i = 0; i < 5; i += 1) {
      $(`img${i}`).value = "";
      hidePreview(i);
    }

    if (mode === "edit" && girl) {
      $("fName").value = girl.name || "";
      $("fSlug").value = girl.slug || "";
      $("fSlug").dataset.touched = "1";
      fillWords({
        eyebrow: girl.eyebrow,
        headline: girl.headline,
        intro: girl.intro,
        polaroidCaption: girl.polaroidCaption,
        question: girl.question,
        questionSub: girl.questionSub,
        planTitle: girl.planTitle,
        finaleTitle: girl.finaleTitle,
        finaleMessage: girl.finaleMessage,
        reasons: girl.reasons && girl.reasons.length ? girl.reasons : DEFAULTS.reasons,
      });
      $("fWhatsapp").value = girl.whatsapp || "";
      $("fEmail").value = girl.email || "";
      currentUrls = Array.isArray(girl.images) ? girl.images.slice(0, 5) : [];
      currentUrls.forEach((url, i) => showPreview(i, url));
    } else {
      $("girlForm").reset();
      $("fSlug").dataset.touched = "";
      fillWords(DEFAULTS);
      $("fWhatsapp").value = "";
      $("fEmail").value = "";
    }

    updateLinkPreview();
    showPanel("editor");
    $("editorTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fillWords(w) {
    $("fEyebrow").value = w.eyebrow || "";
    $("fHeadline").value = w.headline || "";
    $("fIntro").value = w.intro || "";
    $("fPolaroid").value = w.polaroidCaption || "";
    $("fQuestion").value = w.question || "";
    $("fQuestionSub").value = w.questionSub || "";
    $("fPlanTitle").value = w.planTitle || "";
    $("fFinaleTitle").value = w.finaleTitle || "";
    $("fFinaleMessage").value = w.finaleMessage || "";
    const reasons = (w.reasons && w.reasons.length ? w.reasons : DEFAULTS.reasons).slice(0, 3);
    for (let i = 0; i < 3; i += 1) {
      $(`fR${i}t`).value = (reasons[i] && reasons[i].title) || "";
      $(`fR${i}x`).value = (reasons[i] && reasons[i].text) || "";
    }
  }

  function updateLinkPreview() {
    const slug = $("fSlug").value;
    $("linkPreview").textContent = slug ? `Link: ${girlLink(slug)}` : "Her link will be shown here.";
  }

  function previewSlot(i) {
    const file = $(`img${i}`).files[0];
    if (file) {
      showPreview(i, URL.createObjectURL(file));
    } else if (currentUrls[i]) {
      showPreview(i, currentUrls[i]);
    } else {
      hidePreview(i);
    }
  }
  function showPreview(i, url) {
    const img = $(`prev${i}`);
    if (!img) return;
    img.src = url;
    img.classList.remove("hidden");
  }
  function hidePreview(i) {
    const img = $(`prev${i}`);
    if (!img) return;
    img.src = "";
    img.classList.add("hidden");
  }

  async function saveGirl(e) {
    e.preventDefault();
    const name = $("fName").value.trim();
    const slug = slugify($("fSlug").value);
    if (!name || !slug) {
      toast("Name and link name are required.", "error");
      return;
    }

    const btn = $("saveGirl");
    btn.disabled = true;
    const status = $("editorStatus");

    try {
      // Build the photo list in slot order: upload new files, keep existing URLs.
      const images = [];
      for (let i = 0; i < 5; i += 1) {
        const file = $(`img${i}`).files[0];
        if (file) {
          status.textContent = `Uploading ${SLOT_LABELS[i].toLowerCase()}...`;
          images.push(await uploadImage(slug, file));
        } else if (currentUrls[i]) {
          images.push(currentUrls[i]);
        }
      }

      if (!images.length) {
        toast("Please add at least one photo.", "error");
        btn.disabled = false;
        status.textContent = "";
        return;
      }

      status.textContent = "Saving her page...";
      const payload = {
        slug,
        name,
        eyebrow: $("fEyebrow").value.trim(),
        headline: $("fHeadline").value.trim(),
        intro: $("fIntro").value.trim(),
        polaroidCaption: $("fPolaroid").value.trim(),
        question: $("fQuestion").value.trim(),
        questionSub: $("fQuestionSub").value.trim(),
        planTitle: $("fPlanTitle").value.trim(),
        finaleTitle: $("fFinaleTitle").value.trim(),
        finaleMessage: $("fFinaleMessage").value.trim(),
        reasons: [0, 1, 2]
          .map((i) => ({ title: $(`fR${i}t`).value.trim(), text: $(`fR${i}x`).value.trim() }))
          .filter((r) => r.title || r.text),
        images,
        whatsapp: $("fWhatsapp").value.trim(),
        email: $("fEmail").value.trim(),
      };

      const res = await fetch(CFG.girlsUrl, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "save failed");

      toast(`${name} saved. Her link is live.`, "ok");
      showPanel("girls");
      loadGirls();
    } catch (err) {
      toast(`Could not save: ${err.message || err}`, "error");
      status.textContent = "";
    } finally {
      btn.disabled = false;
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(slug, file) {
    const dataBase64 = await fileToBase64(file);
    const res = await fetch(`${CFG.girlsUrl}?action=upload`, {
      method: "POST",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ slug, filename: file.name || "photo.png", contentType: file.type || "image/png", dataBase64 }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.url) throw new Error((data && (data.detail || data.error)) || "upload failed");
    return data.url;
  }

  /* ---------------- responses ---------------- */
  function wireResponses() {
    $("refreshResponses").addEventListener("click", loadResponses);
    $("exportCsv").addEventListener("click", exportCsv);
  }

  async function loadResponses() {
    let rows = [];
    try {
      const res = await fetch(CFG.responseUrl, { headers: adminHeaders(), cache: "no-store" });
      const data = await res.json();
      rows = Array.isArray(data.responses) ? data.responses : [];
    } catch (_) {
      toast("Could not load responses.", "error");
    }
    rows.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    lastResponses = rows;

    const tbody = document.querySelector("#responsesTable tbody");
    tbody.innerHTML = "";
    if (!rows.length) {
      $("responsesEmpty").classList.remove("hidden");
      return;
    }
    $("responsesEmpty").classList.add("hidden");

    rows.forEach((r, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.name || "")}</strong><br><span class="slug">${escapeHtml(r.slug || "")}</span></td>
        <td><span class="pill ${r.answer === "yes" ? "yes" : "no"}">${escapeHtml(r.answer || "-")}</span></td>
        <td>${escapeHtml(formatWhen(r.date, r.time))}</td>
        <td>${escapeHtml(r.whatsapp || "-")}</td>
        <td>${escapeHtml(r.treat || "-")}</td>
        <td>${escapeHtml(r.mood || "-")}</td>
        <td>${escapeHtml(r.note || "-")}</td>
        <td>${escapeHtml(formatStamp(r.submittedAt))}</td>
        <td><button class="reset-response" type="button" data-i="${index}">Reset</button></td>`;
      tr.querySelector("[data-i]").addEventListener("click", () => resetResponse(index));
      tbody.appendChild(tr);
    });
  }

  async function resetResponse(index) {
    const target = lastResponses[index];
    if (!target || !target.id) return;
    if (!confirm(`Remove ${target.name}'s answer permanently?`)) return;
    try {
      const res = await fetch(`${CFG.responseUrl}?id=${encodeURIComponent(target.id)}`, { method: "DELETE", headers: adminHeaders() });
      if (!res.ok) throw new Error("delete failed");
      toast("Response removed.", "ok");
      loadResponses();
    } catch (_) {
      toast("Could not remove that response.", "error");
    }
  }

  function exportCsv() {
    if (!lastResponses.length) {
      toast("Nothing to export yet.", "error");
      return;
    }
    const headers = ["name", "slug", "answer", "date", "time", "whatsapp", "treat", "mood", "note", "submittedAt"];
    const lines = [headers.join(",")].concat(lastResponses.map((r) => headers.map((h) => csvCell(r[h])).join(",")));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------------- helpers ---------------- */
  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatWhen(date, time) {
    if (!date && !time) return "-";
    let readable = date;
    try {
      if (date) readable = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    } catch (_) { /* keep raw */ }
    return `${readable || ""}${time ? ` at ${time}` : ""}`.trim();
  }

  function formatStamp(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return iso;
    }
  }

  function csvCell(value) {
    const s = String(value == null ? "" : value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }
  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }

  let toastTimer = null;
  function toast(message, kind) {
    const el = $("toast");
    el.textContent = message;
    el.className = `toast show ${kind || ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast"), 2600);
  }
})();
