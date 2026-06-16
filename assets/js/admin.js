// Third Eye admin. Pure client-side. Uses the File System Access API so the
// owner can create girl folders, save images, and edit the XML files directly
// in the repository, then commit & push with git.
(function () {
  "use strict";

  // NOTE: This is a light gate for a private link, not real security.
  const CREDENTIALS = { user: "root", pass: "root" };

  let rootHandle = null; // FileSystemDirectoryHandle for the repo root

  const $ = (id) => document.getElementById(id);

  /* ---------------- login ---------------- */
  if (sessionStorage.getItem("tns:auth") === "1") showAdmin();

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value;
    if (u === CREDENTIALS.user && p === CREDENTIALS.pass) {
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
    restoreHandle();
  }

  /* ---------------- tabs ---------------- */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`panel-${tab.dataset.tab}`).classList.add("active");
    });
  });

  /* ---------------- repository connection ---------------- */
  $("connectBtn").addEventListener("click", connectRepo);

  async function connectRepo() {
    if (!window.showDirectoryPicker) {
      toast("This browser can't open folders. Please use Chrome or Edge on desktop.", "error");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      const ok = await ensurePermission(handle);
      if (!ok) {
        toast("Permission denied.", "error");
        return;
      }
      rootHandle = handle;
      await saveHandle(handle);
      markConnected();
      await loadGirls();
      await loadResponses();
      toast("Repository connected.", "ok");
    } catch (err) {
      if (err && err.name !== "AbortError") toast("Could not open folder.", "error");
    }
  }

  function markConnected() {
    const badge = $("repoBadge");
    badge.classList.add("connected");
    badge.innerHTML = '<span class="dot"></span> Repository connected';
    $("connectNotice").classList.add("hidden");
  }

  async function ensurePermission(handle) {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return (await handle.requestPermission(opts)) === "granted";
  }

  function requireRepo() {
    if (!rootHandle) {
      toast("Connect the repository first.", "error");
      return false;
    }
    return true;
  }

  /* ---------------- directory helpers ---------------- */
  async function getDir(pathParts, create = false) {
    let dir = rootHandle;
    for (const part of pathParts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }

  async function readTextFile(dir, name) {
    try {
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      return await file.text();
    } catch (_) {
      return null;
    }
  }

  async function writeTextFile(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  async function writeBlobFile(dir, name, blob) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }

  async function listGirlSlugs() {
    const slugs = [];
    try {
      const assets = await getDir(["assets"]);
      for await (const [name, handle] of assets.entries()) {
        if (handle.kind === "directory") {
          const profile = await readTextFile(handle, "profile.xml");
          if (profile) slugs.push(name);
        }
      }
    } catch (_) {
      /* assets missing */
    }
    return slugs.sort();
  }

  /* ---------------- girls list ---------------- */
  async function loadGirls() {
    if (!rootHandle) return;
    const list = $("girlsList");
    const empty = $("girlsEmpty");
    list.innerHTML = "";
    const slugs = await listGirlSlugs();
    if (!slugs.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const slug of slugs) {
      const assetsDir = await getDir(["assets", slug]);
      const xml = parseXml(await readTextFile(assetsDir, "profile.xml"));
      const name = xml ? tag(xml, "name") : slug;
      const images = xml ? Array.from(xml.querySelectorAll("images > image")).map((n) => n.textContent.trim()) : [];
      const responses = parseXml(await readTextFile(assetsDir, "responses.xml"));
      const count = responses ? responses.querySelectorAll("response").length : 0;
      const link = girlLink(slug);

      const thumbs = images
        .slice(0, 4)
        .map((f) => `<img src="../../assets/${encodeURIComponent(slug)}/${encodeURIComponent(f)}" alt="">`)
        .join("");

      const tile = document.createElement("div");
      tile.className = "girl-tile";
      tile.innerHTML = `
        <h3>${escapeHtml(name)}</h3>
        <div class="slug">${escapeHtml(slug)} &middot; ${count} response${count === 1 ? "" : "s"}</div>
        <div class="thumbs">${thumbs}</div>
        <div class="link-row">
          <input type="text" readonly value="${escapeAttr(link)}">
          <button class="btn-ghost" type="button" data-copy="${escapeAttr(link)}">Copy</button>
        </div>`;
      tile.querySelector("[data-copy]").addEventListener("click", (e) => {
        copyText(e.currentTarget.dataset.copy);
      });
      list.appendChild(tile);
    }
  }

  function girlLink(slug) {
    const base = location.pathname.replace(/Third-Eye\/Admin\/?(index\.html)?$/i, "");
    return `${location.origin}${base}${slug}/`;
  }

  /* ---------------- responses report ---------------- */
  $("refreshResponses").addEventListener("click", () => {
    if (requireRepo()) loadResponses();
  });
  $("exportCsv").addEventListener("click", exportCsv);
  $("importLocal").addEventListener("click", importFromBrowser);
  $("importCodeBtn").addEventListener("click", importFromCode);

  let lastRows = [];

  async function loadResponses() {
    if (!rootHandle) return;
    const tbody = $("responsesTable").querySelector("tbody");
    const empty = $("responsesEmpty");
    tbody.innerHTML = "";
    lastRows = [];

    const slugs = await listGirlSlugs();
    for (const slug of slugs) {
      const assetsDir = await getDir(["assets", slug]);
      const profile = parseXml(await readTextFile(assetsDir, "profile.xml"));
      const name = profile ? tag(profile, "name") : slug;
      const xml = parseXml(await readTextFile(assetsDir, "responses.xml"));
      if (!xml) continue;
      xml.querySelectorAll("response").forEach((r) => {
        lastRows.push({
          name,
          slug,
          answer: childText(r, "answer"),
          date: childText(r, "date"),
          time: childText(r, "time"),
          treat: childText(r, "treat"),
          mood: childText(r, "mood"),
          note: childText(r, "note"),
          submittedAt: childText(r, "submittedAt"),
        });
      });
    }

    lastRows.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    if (!lastRows.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    lastRows.forEach((r) => {
      const tr = document.createElement("tr");
      const when = formatWhen(r.date, r.time);
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.name)}</strong><br><span class="slug">${escapeHtml(r.slug)}</span></td>
        <td><span class="pill ${r.answer === "yes" ? "yes" : "no"}">${escapeHtml(r.answer || "-")}</span></td>
        <td>${escapeHtml(when)}</td>
        <td>${escapeHtml(r.treat || "-")}</td>
        <td>${escapeHtml(r.mood || "-")}</td>
        <td>${escapeHtml(r.note || "-")}</td>
        <td>${escapeHtml(formatStamp(r.submittedAt))}</td>`;
      tbody.appendChild(tr);
    });
  }

  function exportCsv() {
    if (!lastRows.length) {
      toast("Nothing to export yet.", "error");
      return;
    }
    const headers = ["name", "slug", "answer", "date", "time", "treat", "mood", "note", "submittedAt"];
    const rows = [headers.join(",")].concat(
      lastRows.map((r) => headers.map((h) => csvCell(r[h])).join(","))
    );
    const blob = new Blob([rows.join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importFromBrowser() {
    if (!requireRepo()) return;
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem("tns:responses") || "[]");
    } catch (_) {
      stored = [];
    }
    if (!stored.length) {
      toast("No answers saved in this browser.", "error");
      return;
    }
    let added = 0;
    for (const r of stored) {
      if (await appendResponse(r)) added += 1;
    }
    localStorage.removeItem("tns:responses");
    await loadResponses();
    await loadGirls();
    toast(`${added} answer${added === 1 ? "" : "s"} imported.`, "ok");
  }

  async function importFromCode() {
    if (!requireRepo()) return;
    const raw = $("importCode").value.trim();
    if (!raw) {
      toast("Paste an answer code first.", "error");
      return;
    }
    let data;
    try {
      data = JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch (_) {
      toast("That code could not be read.", "error");
      return;
    }
    if (!data || !data.slug) {
      toast("That code has no girl attached.", "error");
      return;
    }
    const ok = await appendResponse(data);
    if (ok) {
      $("importCode").value = "";
      await loadResponses();
      await loadGirls();
      toast("Answer saved.", "ok");
    } else {
      toast(`No girl folder named "${data.slug}".`, "error");
    }
  }

  async function appendResponse(r) {
    if (!r || !r.slug) return false;
    let assetsDir;
    try {
      assetsDir = await getDir(["assets", r.slug]);
    } catch (_) {
      return false;
    }
    let text = await readTextFile(assetsDir, "responses.xml");
    if (!text || !text.includes("</responses>")) {
      text = '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n';
    }
    const snippet = responseSnippet(r);
    text = text.replace("</responses>", `${snippet}\n</responses>`);
    await writeTextFile(assetsDir, "responses.xml", text);
    return true;
  }

  function responseSnippet(r) {
    return `  <response>
    <submittedAt>${xmlEsc(r.submittedAt || new Date().toISOString())}</submittedAt>
    <answer>${xmlEsc(r.answer || "yes")}</answer>
    <date>${xmlEsc(r.date)}</date>
    <time>${xmlEsc(r.time)}</time>
    <treat>${xmlEsc(r.treat)}</treat>
    <mood>${xmlEsc(r.mood)}</mood>
    <note>${xmlEsc(r.note)}</note>
  </response>`;
  }

  /* ---------------- add a girl ---------------- */
  $("addName").addEventListener("input", () => {
    if (!$("addSlug").dataset.touched) {
      $("addSlug").value = slugify($("addName").value);
      updateSlugPreview();
    }
  });
  $("addSlug").addEventListener("input", () => {
    $("addSlug").dataset.touched = "1";
    $("addSlug").value = slugify($("addSlug").value);
    updateSlugPreview();
  });
  $("addImages").addEventListener("change", previewThumbs);

  function updateSlugPreview() {
    const slug = $("addSlug").value;
    $("slugPreview").textContent = slug ? `Link: ${girlLink(slug)}` : "Her link will be shown here.";
  }

  function previewThumbs() {
    const box = $("addThumbs");
    box.innerHTML = "";
    Array.from($("addImages").files).forEach((f) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      box.appendChild(img);
    });
  }

  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireRepo()) return;

    const name = $("addName").value.trim();
    const slug = slugify($("addSlug").value);
    const files = Array.from($("addImages").files);

    if (!name || !slug) {
      toast("Name and folder name are required.", "error");
      return;
    }
    if (!files.length) {
      toast("Please add at least one photo.", "error");
      return;
    }

    setStatus("Checking folder...");
    if (await slugExists(slug)) {
      setStatus("");
      toast(`A girl folder named "${slug}" already exists.`, "error");
      return;
    }

    $("addSubmit").disabled = true;
    try {
      setStatus("Saving images...");
      const assetsDir = await getDir(["assets", slug], true);
      const imageNames = [];
      for (const file of files) {
        const safe = safeFileName(file.name);
        await writeBlobFile(assetsDir, safe, file);
        imageNames.push(safe);
      }

      setStatus("Writing profile...");
      await writeTextFile(assetsDir, "profile.xml", buildProfileXml(name, slug, imageNames));
      await writeTextFile(assetsDir, "responses.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n');

      setStatus("Creating her page...");
      const templateHtml = await fetchTemplate();
      const pageDir = await getDir([slug], true);
      await writeTextFile(pageDir, "index.html", templateHtml);

      setStatus("");
      $("addForm").reset();
      $("addThumbs").innerHTML = "";
      $("addSlug").dataset.touched = "";
      toast(`${name}'s page is ready. Commit & push, then share the link.`, "ok");
      await loadGirls();
      const link = girlLink(slug);
      copyText(link);
      toast("Her link was copied to clipboard.", "ok");
    } catch (err) {
      setStatus("");
      toast("Something went wrong while saving.", "error");
    } finally {
      $("addSubmit").disabled = false;
    }
  });

  async function slugExists(slug) {
    try {
      const assets = await getDir(["assets"]);
      await assets.getDirectoryHandle(slug);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function fetchTemplate() {
    const res = await fetch("../../template/girl/index.html", { cache: "no-store" });
    if (!res.ok) throw new Error("template missing");
    return await res.text();
  }

  function buildProfileXml(name, slug, images) {
    const whatsapp = ($("addWhatsapp").value || "").replace(/[^\d]/g, "");
    const email = ($("addEmail").value || "").trim();
    const headline = ($("addHeadline").value || "").trim();
    const intro = ($("addIntro").value || "").trim();
    const question = ($("addQuestion").value || "").trim();

    const optional = (taggy, value) => (value ? `\n  <${taggy}>${xmlEsc(value)}</${taggy}>` : "");

    const imageTags = images.map((f) => `    <image>${xmlEsc(f)}</image>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<girl>
  <name>${xmlEsc(name)}</name>
  <slug>${xmlEsc(slug)}</slug>${optional("headline", headline)}${optional("intro", intro)}${optional("question", question)}
  <images>
${imageTags}
  </images>
  <contact>
    <whatsapp>${xmlEsc(whatsapp)}</whatsapp>
    <email>${xmlEsc(email)}</email>
  </contact>
</girl>
`;
  }

  /* ---------------- persistence of the folder handle ---------------- */
  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("tns-admin", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("handles");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function saveHandle(handle) {
    try {
      const db = await idb();
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "root");
    } catch (_) {
      /* ignore */
    }
  }
  async function restoreHandle() {
    try {
      const db = await idb();
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("root");
      req.onsuccess = async () => {
        const handle = req.result;
        if (!handle) return;
        if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") {
          rootHandle = handle;
          markConnected();
          await loadGirls();
          await loadResponses();
        }
      };
    } catch (_) {
      /* ignore */
    }
  }

  /* ---------------- small utilities ---------------- */
  function parseXml(text) {
    if (!text) return null;
    const xml = new DOMParser().parseFromString(text, "application/xml");
    return xml.querySelector("parsererror") ? null : xml;
  }
  function tag(xml, name) {
    const n = xml.querySelector(name);
    return n ? n.textContent.trim() : "";
  }
  function childText(parent, name) {
    const n = parent.querySelector(name);
    return n ? n.textContent.trim() : "";
  }
  function slugify(s) {
    return String(s)
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function safeFileName(name) {
    return name.replace(/[^\w.\-]/g, "_");
  }
  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }
  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }
  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function formatWhen(date, time) {
    if (!date && !time) return "-";
    let d = date;
    try {
      if (date) d = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (_) {}
    return `${d || ""}${time ? " at " + time : ""}`.trim();
  }
  function formatStamp(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return iso;
    }
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
  let toastTimer;
  function toast(msg, kind) {
    const el = $("toast");
    el.textContent = msg;
    el.className = `toast show ${kind || ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast"), 3200);
  }
})();
