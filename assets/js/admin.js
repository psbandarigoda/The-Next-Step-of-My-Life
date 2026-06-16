// Third Eye admin. Pure client-side. Uses the File System Access API so the
// owner can create girl folders, save images, and edit the XML files directly
// in the repository, then commit & push with git.
(function () {
  "use strict";

  // NOTE: This is a light gate for a private link, not real security.
  const CREDENTIALS = { user: "root", pass: "root" };
  const SEEDED_GIRLS = [{ name: "Sanduni", slug: "sanduni-kamburadeniya" }];

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
    loadGirls();
    loadResponses();
    restoreHandle();
  }

  /* ---------------- tabs ---------------- */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`panel-${tab.dataset.tab}`).classList.add("active");
      if (tab.dataset.tab === "girls") loadGirls();
      if (tab.dataset.tab === "responses") loadResponses();
    });
  });

  $("refreshGirls").addEventListener("click", () => loadGirls());

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
      await autoImportLocalResponses(true);
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
    const slugs = new Set();

    // 1) Always include everyone listed in the central registry (girls.xml).
    const registry = await fetchGirlRegistry();
    registry.forEach((g) => g.slug && slugs.add(g.slug));

    // 2) When the repository is connected, also include any girl folders on disk
    //    that have a profile.xml (covers ones added but not yet in the registry).
    if (rootHandle) {
      try {
        const assets = await getDir(["assets"]);
        for await (const [name, handle] of assets.entries()) {
          if (handle.kind === "directory") {
            const profile = await readTextFile(handle, "profile.xml");
            if (profile) slugs.add(name);
          }
        }
      } catch (_) {
        /* assets missing */
      }
    }

    return Array.from(slugs).sort();
  }

  async function fetchGirlRegistry() {
    try {
      const res = await fetch("../../assets/girls.xml", { cache: "no-store" });
      if (!res.ok) return SEEDED_GIRLS;
      const xml = parseXml(await res.text());
      if (!xml) return SEEDED_GIRLS;
      const girls = Array.from(xml.querySelectorAll("girl"))
        .map((girl) => ({
          name: childText(girl, "name"),
          slug: childText(girl, "slug"),
        }))
        .filter((girl) => girl.slug);
      return girls.length ? girls : SEEDED_GIRLS;
    } catch (_) {
      return SEEDED_GIRLS;
    }
  }

  /* ---------------- girls list ---------------- */
  async function loadGirls() {
    const list = $("girlsList");
    const empty = $("girlsEmpty");
    list.innerHTML = "";
    const slugs = await listGirlSlugs();
    const counter = $("girlsCount");
    if (counter) counter.textContent = `Existing girls (${slugs.length})`;
    if (!slugs.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const slug of slugs) {
      const xml = rootHandle
        ? parseXml(await readTextFile(await getDir(["assets", slug]), "profile.xml"))
        : await fetchProfile(slug);
      const name = xml ? tag(xml, "name") : slug;
      const images = xml ? Array.from(xml.querySelectorAll("images > image")).map((n) => n.textContent.trim()) : [];
      const count = await responseCountFor(slug);
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

  async function fetchProfile(slug) {
    try {
      const res = await fetch(`../../assets/${encodeURIComponent(slug)}/profile.xml`, { cache: "no-store" });
      if (!res.ok) return null;
      return parseXml(await res.text());
    } catch (_) {
      return null;
    }
  }

  async function responseCountFor(slug) {
    if (rootHandle) {
      const central = await readCentralResponses();
      return central.filter((r) => r.slug === slug).length;
    }
    const central = await readVisibleResponses();
    return central.filter((r) => r.slug === slug).length;
  }

  function girlLink(slug) {
    const base = location.pathname.replace(/Third-Eye\/Admin\/?(index\.html)?$/i, "");
    return `${location.origin}${base}${slug}/`;
  }

  /* ---------------- responses report ---------------- */
  $("refreshResponses").addEventListener("click", () => {
    loadResponses();
  });
  $("exportCsv").addEventListener("click", exportCsv);
  $("downloadBackup").addEventListener("click", downloadBackup);
  $("restoreBrowserBackup").addEventListener("click", restoreBrowserBackup);
  $("restoreBackup").addEventListener("click", onRestoreFile);
  window.addEventListener("storage", (event) => {
    if (event.key === "tns:responses") autoImportLocalResponses(true);
  });
  setInterval(() => {
    if (rootHandle && readLocalResponses().length) autoImportLocalResponses(true);
  }, 3000);

  let lastRows = [];

  async function loadResponses() {
    const tbody = $("responsesTable").querySelector("tbody");
    const empty = $("responsesEmpty");
    tbody.innerHTML = "";
    lastRows = await readVisibleResponses();

    lastRows.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    saveRollingBackup(lastRows);

    if (!lastRows.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    lastRows.forEach((r, index) => {
      const tr = document.createElement("tr");
      const when = formatWhen(r.date, r.time);
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.name)}</strong><br><span class="slug">${escapeHtml(r.slug)}</span></td>
        <td><span class="pill ${r.answer === "yes" ? "yes" : "no"}">${escapeHtml(r.answer || "-")}</span></td>
        <td>${escapeHtml(when)}</td>
        <td>${escapeHtml(r.whatsapp || "-")}</td>
        <td>${escapeHtml(r.treat || "-")}</td>
        <td>${escapeHtml(r.mood || "-")}</td>
        <td>${escapeHtml(r.note || "-")}</td>
        <td>${escapeHtml(formatStamp(r.submittedAt))}</td>
        <td><button class="reset-response" type="button" data-response-index="${index}">Reset</button></td>`;
      tr.querySelector("[data-response-index]").addEventListener("click", () => resetResponse(index));
      tbody.appendChild(tr);
    });
  }

  async function readVisibleResponses() {
    const saved = rootHandle ? await readCentralResponses() : await fetchCentralResponses();
    const local = readLocalResponses();
    const unique = new Map();
    saved.concat(local).forEach((row) => {
      const key = `${row.slug}|${row.submittedAt}|${row.date}|${row.time}|${row.whatsapp}|${row.treat}|${row.mood}|${row.note}`;
      unique.set(key, row);
    });
    return Array.from(unique.values());
  }

  async function readCentralResponses() {
    try {
      const assets = await getDir(["assets"]);
      return parseResponsesXml(await readTextFile(assets, "responses.xml"));
    } catch (_) {
      return [];
    }
  }

  async function fetchCentralResponses() {
    try {
      const res = await fetch("../../assets/responses.xml", { cache: "no-store" });
      if (!res.ok) return [];
      return parseResponsesXml(await res.text());
    } catch (_) {
      return [];
    }
  }

  function readLocalResponses() {
    try {
      return JSON.parse(localStorage.getItem("tns:responses") || "[]");
    } catch (_) {
      return [];
    }
  }

  function parseResponsesXml(text) {
    const xml = parseXml(text);
    if (!xml) return [];
    return Array.from(xml.querySelectorAll("response")).map((r) => ({
      name: childText(r, "name"),
      slug: childText(r, "slug"),
      answer: childText(r, "answer"),
      date: childText(r, "date"),
      time: childText(r, "time"),
      whatsapp: childText(r, "whatsapp"),
      treat: childText(r, "treat"),
      mood: childText(r, "mood"),
      note: childText(r, "note"),
      submittedAt: childText(r, "submittedAt"),
    }));
  }

  function exportCsv() {
    if (!lastRows.length) {
      toast("Nothing to export yet.", "error");
      return;
    }
    const headers = ["name", "slug", "answer", "date", "time", "whatsapp", "treat", "mood", "note", "submittedAt"];
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

  async function resetResponse(index) {
    const target = lastRows[index];
    if (!target) return;

    if (!rootHandle) {
      const local = readLocalResponses();
      const nextLocal = local.filter((row) => responseKey(row) !== responseKey(target));
      if (nextLocal.length !== local.length) {
        localStorage.setItem("tns:responses", JSON.stringify(nextLocal));
        await loadResponses();
        await loadGirls();
        toast("Local response reset.", "ok");
        return;
      }

      toast("Connect the repository first to reset saved XML responses.", "error");
      return;
    }

    const central = await readCentralResponses();
    const nextCentral = central.filter((row) => responseKey(row) !== responseKey(target));
    if (nextCentral.length === central.length) {
      toast("Response was not found in central XML.", "error");
      return;
    }

    const assetsDir = await getDir(["assets"], true);
    await writeResponsesXml(assetsDir, "responses.xml", nextCentral);

    try {
      const girlDir = await getDir(["assets", target.slug]);
      const girlRows = parseResponsesXml(await readTextFile(girlDir, "responses.xml"));
      await writeResponsesXml(
        girlDir,
        "responses.xml",
        girlRows.filter((row) => responseKey(row) !== responseKey(target))
      );
    } catch (_) {
      /* girl's backup response file may not exist yet */
    }

    const local = readLocalResponses().filter((row) => responseKey(row) !== responseKey(target));
    localStorage.setItem("tns:responses", JSON.stringify(local));

    await loadResponses();
    await loadGirls();
    toast("Response reset from XML.", "ok");
  }

  async function writeResponsesXml(dir, fileName, rows) {
    const body = rows.map((row) => responseSnippet(row)).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n${body}${body ? "\n" : ""}</responses>\n`;
    await writeTextFile(dir, fileName, xml);
  }

  /* ---------------- backup & restore ---------------- */
  const BACKUP_TYPE = "the-next-step-backup";

  function setBackupStatus(msg) {
    const el = $("backupStatus");
    if (el) el.textContent = msg || "";
  }

  async function readProfileText(slug) {
    if (rootHandle) {
      try {
        return await readTextFile(await getDir(["assets", slug]), "profile.xml");
      } catch (_) {
        return null;
      }
    }
    try {
      const res = await fetch(`../../assets/${encodeURIComponent(slug)}/profile.xml`, { cache: "no-store" });
      return res.ok ? await res.text() : null;
    } catch (_) {
      return null;
    }
  }

  async function buildBackup() {
    const slugs = await listGirlSlugs();
    const registry = await fetchGirlRegistry();
    const nameBySlug = {};
    registry.forEach((g) => {
      if (g.slug) nameBySlug[g.slug] = g.name;
    });

    const girls = [];
    for (const slug of slugs) {
      const profileXml = (await readProfileText(slug)) || "";
      let name = nameBySlug[slug] || slug;
      if (profileXml) {
        const x = parseXml(profileXml);
        if (x) name = tag(x, "name") || name;
      }
      girls.push({ slug, name, profileXml });
    }

    return {
      type: BACKUP_TYPE,
      version: 1,
      createdAt: new Date().toISOString(),
      girls,
      responses: await readVisibleResponses(),
    };
  }

  async function downloadBackup() {
    setBackupStatus("Building backup...");
    const backup = await buildBackup();
    saveRollingBackup(backup.responses);

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `next-step-backup-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);

    setBackupStatus(`Backup downloaded: ${backup.girls.length} girls, ${backup.responses.length} responses.`);
    toast("Backup downloaded.", "ok");
  }

  function saveRollingBackup(rows) {
    try {
      localStorage.setItem(
        "tns:backup",
        JSON.stringify({ type: BACKUP_TYPE, version: 1, createdAt: new Date().toISOString(), responses: rows || [] })
      );
    } catch (_) {
      /* storage full or unavailable */
    }
  }

  function mergeResponsesIntoLocal(rows) {
    const local = readLocalResponses();
    const keys = new Set(local.map(responseKey));
    let changed = false;
    (rows || []).forEach((r) => {
      if (r && r.slug && !keys.has(responseKey(r))) {
        local.push(r);
        keys.add(responseKey(r));
        changed = true;
      }
    });
    if (changed) localStorage.setItem("tns:responses", JSON.stringify(local));
    return changed;
  }

  async function onRestoreFile() {
    const file = $("restoreFile").files[0];
    if (!file) {
      toast("Choose a backup file first.", "error");
      return;
    }
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch (_) {
      toast("That file is not a valid backup.", "error");
      return;
    }
    await restoreFromBackup(backup);
  }

  function restoreBrowserBackup() {
    let backup;
    try {
      backup = JSON.parse(localStorage.getItem("tns:backup") || "null");
    } catch (_) {
      backup = null;
    }
    if (!backup) {
      toast("No browser backup found yet.", "error");
      return;
    }
    restoreFromBackup(backup);
  }

  async function restoreFromBackup(backup) {
    if (!backup || backup.type !== BACKUP_TYPE) {
      toast("That file is not a Next Step backup.", "error");
      return;
    }

    // Always keep responses safe locally so nothing is lost, even without the repo.
    mergeResponsesIntoLocal(backup.responses || []);

    if (!rootHandle) {
      await loadResponses();
      await loadGirls();
      setBackupStatus("Responses restored to this browser. Connect the repository to write them into the XML files.");
      toast("Restored to browser. Connect repository to save into XML.", "ok");
      return;
    }

    let profilesWritten = 0;
    for (const g of backup.girls || []) {
      if (!g || !g.slug) continue;
      await appendGirlRegistry({ name: g.name || g.slug, slug: g.slug });
      const dir = await getDir(["assets", g.slug], true);
      if (g.profileXml && !(await readTextFile(dir, "profile.xml"))) {
        await writeTextFile(dir, "profile.xml", g.profileXml);
        profilesWritten += 1;
      }
      if (!(await readTextFile(dir, "responses.xml"))) {
        await writeTextFile(dir, "responses.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n');
      }
    }

    let responsesWritten = 0;
    for (const r of backup.responses || []) {
      if (await appendResponse(r)) responsesWritten += 1;
    }

    await loadGirls();
    await loadResponses();
    setBackupStatus(
      `Restore complete: ${profilesWritten} profile(s) recreated, ${responsesWritten} new response(s) saved into XML. Commit & push to keep them.`
    );
    toast("Backup restored into the XML files.", "ok");
  }

  async function autoImportLocalResponses(silent) {
    if (!rootHandle) {
      await loadResponses();
      await loadGirls();
      return 0;
    }

    const stored = readLocalResponses();
    if (!stored.length) {
      if (!silent) toast("No new answers to save.", "ok");
      return 0;
    }

    // Only write the ones that are not already saved in the central XML.
    // We deliberately keep them in local storage so a submission never
    // disappears on refresh; it is only removed when you press Reset.
    const central = await readCentralResponses();
    const centralKeys = new Set(central.map(responseKey));
    const newOnes = stored.filter((r) => r.slug && !centralKeys.has(responseKey(r)));

    let added = 0;
    for (const r of newOnes) {
      if (await appendResponse(r)) added += 1;
    }

    if (added) {
      await loadResponses();
      await loadGirls();
    }

    if (added && !silent) {
      toast(`${added} answer${added === 1 ? "" : "s"} saved into the XML.`, "ok");
    } else if (!added && !silent) {
      toast("All answers are already saved.", "ok");
    }
    return added;
  }

  async function appendResponse(r) {
    if (!r || !r.slug) return false;

    // The central XML is the source of truth.
    const addedToCentral = await appendCentralResponse(r);

    // The girl's own folder keeps a backup copy (best effort).
    try {
      const assetsDir = await getDir(["assets", r.slug]);
      let text = await readTextFile(assetsDir, "responses.xml");
      if (!text || !text.includes("</responses>")) {
        text = '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n';
      }
      if (!parseResponsesXml(text).some((existing) => responseKey(existing) === responseKey(r))) {
        text = text.replace("</responses>", `${responseSnippet(r)}\n</responses>`);
        await writeTextFile(assetsDir, "responses.xml", text);
      }
    } catch (_) {
      /* girl's folder may not exist; the central XML still has the answer */
    }

    return addedToCentral;
  }

  async function appendCentralResponse(r) {
    const assetsDir = await getDir(["assets"], true);
    let text = await readTextFile(assetsDir, "responses.xml");
    if (!text || !text.includes("</responses>")) {
      text = '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n';
    }
    if (parseResponsesXml(text).some((existing) => responseKey(existing) === responseKey(r))) {
      return false;
    }
    text = text.replace("</responses>", `${responseSnippet(r)}\n</responses>`);
    await writeTextFile(assetsDir, "responses.xml", text);
    return true;
  }

  function responseSnippet(r) {
    return `  <response>
    <name>${xmlEsc(r.name)}</name>
    <slug>${xmlEsc(r.slug)}</slug>
    <submittedAt>${xmlEsc(r.submittedAt || new Date().toISOString())}</submittedAt>
    <answer>${xmlEsc(r.answer || "yes")}</answer>
    <date>${xmlEsc(r.date)}</date>
    <time>${xmlEsc(r.time)}</time>
    <whatsapp>${xmlEsc(r.whatsapp)}</whatsapp>
    <treat>${xmlEsc(r.treat)}</treat>
    <mood>${xmlEsc(r.mood)}</mood>
    <note>${xmlEsc(r.note)}</note>
  </response>`;
  }

  function responseKey(r) {
    return `${r.slug || ""}|${r.submittedAt || ""}|${r.date || ""}|${r.time || ""}|${r.whatsapp || ""}|${r.treat || ""}|${r.mood || ""}|${r.note || ""}`;
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
      await appendGirlRegistry({ name, slug });

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

  async function appendGirlRegistry(girl) {
    const assetsDir = await getDir(["assets"], true);
    let text = await readTextFile(assetsDir, "girls.xml");
    if (!text || !text.includes("</girls>")) {
      text = '<?xml version="1.0" encoding="UTF-8"?>\n<girls>\n</girls>\n';
    }
    if (text.includes(`<slug>${xmlEsc(girl.slug)}</slug>`)) return;
    const snippet = `  <girl>
    <name>${xmlEsc(girl.name)}</name>
    <slug>${xmlEsc(girl.slug)}</slug>
  </girl>`;
    text = text.replace("</girls>", `${snippet}\n</girls>`);
    await writeTextFile(assetsDir, "girls.xml", text);
  }

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
