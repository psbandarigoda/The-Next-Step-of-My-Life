// Renders a single girl's invitation page. The profile (text + photo URLs) is
// loaded live from the Supabase "girls" Edge Function by slug, so a new girl is
// instantly available at /<slug> the moment she is added in Admin - no files,
// no commits. The shared 404.html hosts this script for every slug.
(function () {
  const app = document.getElementById("app");
  const missing = document.getElementById("missing");
  const loader = document.getElementById("pageLoading");
  const loadingText = document.getElementById("loadingText");

  const slug = resolveSlug();
  document.body.classList.add("surprise-locked");

  if (!slug) {
    hideLoading();
    showMissing();
    return;
  }

  showLoading("Opening something made just for you&hellip;");

  const promise =
    window.TNS && window.TNS.profilePromise
      ? window.TNS.profilePromise
      : fetchProfile(slug);

  promise
    .then((data) => {
      if (!data || !data.ok || !data.girl) throw new Error("not found");
      if (data.fromCache) setLoadingText("Almost ready&hellip;");
      else setLoadingText("Preparing your surprise&hellip;");
      renderPage(buildProfile(data.girl), hideLoading);
    })
    .catch(() => {
      hideLoading();
      showMissing();
    });

  function fetchProfile(s) {
    const endpoint = (window.TNS && window.TNS.girlUrl) || "";
    const anon = (window.TNS && window.TNS.anonKey) || "";
    return fetch(`${endpoint}?slug=${encodeURIComponent(s)}`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      cache: "default",
    }).then((res) => (res.ok ? res.json() : Promise.reject(new Error("not found"))));
  }

  function setLoadingText(html) {
    if (loadingText) loadingText.innerHTML = html;
  }

  function showLoading(text) {
    document.body.classList.add("page-loading");
    if (loader) {
      loader.classList.remove("hidden", "is-done");
      loader.setAttribute("aria-busy", "true");
    }
    if (text) setLoadingText(text);
  }

  function hideLoading() {
    document.body.classList.remove("page-loading");
    if (!loader) return;
    loader.setAttribute("aria-busy", "false");
    loader.classList.add("is-done");
    setTimeout(() => loader.classList.add("hidden"), 480);
  }

  function resolveSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length && parts[parts.length - 1].toLowerCase().endsWith(".html")) parts.pop();
    // Lowercase so shared links stay case-insensitive (e.g. /Kavindya-Dodangoda).
    return parts.length ? decodeURIComponent(parts[parts.length - 1]).toLowerCase() : "";
  }

  function showMissing() {
    document.body.classList.remove("surprise-locked");
    if (app) app.classList.add("hidden");
    if (missing) missing.classList.remove("hidden");
  }

  // Lets stored sentences use a {name} placeholder that becomes her real name.
  function withName(value, name) {
    return String(value == null ? "" : value).replace(/\{name\}/gi, name);
  }

  function buildProfile(g) {
    const name = (g.name || "you").trim();
    const fill = (value, fallback) => withName(String(value || "").trim() || fallback, name);

    return {
      slug,
      name,
      images: Array.isArray(g.images) ? g.images.filter(Boolean) : [],
      eyebrow: fill(g.eyebrow, "A tiny surprise invitation"),
      headline: fill(g.headline, `${name}, your smile deserves a beautiful date.`),
      intro: fill(
        g.intro,
        "I made this little page just for you, because asking you normally felt too small for someone this lovely."
      ),
      polaroidCaption: fill(g.polaroidCaption, "My favorite view"),
      question: fill(g.question, "Will you go on a date with me?"),
      questionSub: fill(
        g.questionSub,
        "One evening. Good food. A little walk. A lot of smiles. And me trying my best to make you feel special."
      ),
      planTitle: fill(g.planTitle, `When are you free, ${name}?`),
      finaleTitle: fill(g.finaleTitle, "I will make it sweet, simple, and unforgettable."),
      finaleMessage: fill(
        g.finaleMessage,
        "If you say yes, I will bring the smile, the care, and a little surprise just for you."
      ),
      reasons: (Array.isArray(g.reasons) ? g.reasons : []).map((r) => ({
        title: withName(r.title || "", name),
        text: withName(r.text || "", name),
      })),
      whatsapp: (g.whatsapp || "").trim(),
      email: (g.email || "").trim(),
    };
  }

  // Photos are full Supabase Storage URLs, so they are used as-is.
  function imgUrl(profile, file) {
    return file;
  }

  function renderPage(profile, onReady) {
    document.title = `For ${profile.name}`;
    missing.classList.add("hidden");
    app.classList.remove("hidden");

    document.querySelectorAll("[data-field]").forEach((el) => {
      const key = el.dataset.field;
      if (profile[key] != null) el.textContent = profile[key];
    });

    renderPhotos(profile);
    renderReasons(profile);
    wireInteractions(profile);

    // Keep the loading screen until the hero photo appears (or a short timeout).
    setLoadingText("Loading her photo&hellip;");
    const finish = () => {
      if (onReady) onReady();
    };
    const mainImg = document.querySelector(".portrait-main");
    if (!mainImg) {
      finish();
      return;
    }
    if (mainImg.complete && mainImg.naturalWidth > 0) finish();
    else {
      mainImg.addEventListener("load", finish, { once: true });
      mainImg.addEventListener("error", finish, { once: true });
      setTimeout(finish, 6000);
    }
  }

  function renderPhotos(profile) {
    const stage = document.getElementById("photoStage");
    const imgs = profile.images.length ? profile.images : [];
    const main = imgs[0];
    const floatA = imgs[1] || imgs[0];
    const floatB = imgs[2] || imgs[0];
    const polaroid = imgs[3] || imgs[0];
    const finale = imgs[4] || imgs[0];

    if (main) {
      stage.innerHTML = `
        <img class="portrait portrait-main is-loading" src="${imgUrl(profile, main)}" alt="${escapeAttr(profile.name)}" decoding="async" fetchpriority="high">
        ${floatA ? `<img class="portrait portrait-float one" src="${imgUrl(profile, floatA)}" alt="" decoding="async" loading="lazy">` : ""}
        ${floatB ? `<img class="portrait portrait-float two" src="${imgUrl(profile, floatB)}" alt="" decoding="async" loading="lazy">` : ""}
      `;
      const hero = stage.querySelector(".portrait-main");
      if (hero) hero.addEventListener("load", () => hero.classList.remove("is-loading"), { once: true });
    }
    const polaroidImg = document.getElementById("polaroidImg");
    const finaleImg = document.getElementById("finaleImg");
    if (polaroid) {
      polaroidImg.src = imgUrl(profile, polaroid);
      polaroidImg.alt = profile.name;
      polaroidImg.loading = "lazy";
      polaroidImg.decoding = "async";
    }
    if (finale) {
      finaleImg.src = imgUrl(profile, finale);
      finaleImg.alt = profile.name;
      finaleImg.loading = "lazy";
      finaleImg.decoding = "async";
    }
  }

  function renderReasons(profile) {
    const grid = document.getElementById("memoryGrid");
    const reasons = profile.reasons.length
      ? profile.reasons
      : [
          { title: "Your laugh", text: "It feels like the whole day becomes softer when you smile." },
          { title: "Your eyes", text: "They make even a small moment feel like a scene from a love story." },
          { title: "Your presence", text: "I want one evening where the only plan is making you happy." },
        ];
    grid.innerHTML = reasons
      .map(
        (r, i) => `
        <article>
          <span>${String(i + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(r.title)}</h3>
          <p>${escapeHtml(r.text)}</p>
        </article>`
      )
      .join("");
  }

  function wireInteractions(profile) {
    const yesBtn = document.getElementById("yesBtn");
    const noBtn = document.getElementById("noBtn");
    const teaseText = document.getElementById("teaseText");
    const datePlan = document.getElementById("datePlan");
    const finalCard = document.getElementById("finalCard");
    const planForm = document.getElementById("planForm");
    const replyLink = document.getElementById("replyLink");
    const downloadBtn = document.getElementById("downloadBtn");
    const finalMessage = document.getElementById("finalMessage");
    const restartBtn = document.getElementById("restartBtn");

    const answers = { treat: "coffee and a sweet dessert", mood: "soft, calm, and romantic" };
    const teasing = [
      "Are you sure? My heart is already dressed nicely.",
      "That button is shy. Try the pink one.",
      `No is currently unavailable for ${profile.name}.`,
      "I made this whole page, so please think again.",
      "The universe says the answer is yes.",
    ];
    let noAttempts = 0;

    document.querySelectorAll("[data-scroll-to]").forEach((b) => {
      b.addEventListener("click", () => {
        document.body.classList.remove("surprise-locked");
        document.getElementById(b.dataset.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    yesBtn.addEventListener("click", () => {
      datePlan.classList.remove("hidden");
      datePlan.classList.add("reveal");
      teaseText.textContent = "Best answer. Now let us choose the perfect little plan.";
      burstHearts(window.innerWidth / 2, yesBtn.getBoundingClientRect().top);
      setTimeout(() => datePlan.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
    });

    noBtn.addEventListener("mouseenter", moveNo);
    noBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moveNo();
    });
    function moveNo() {
      const box = document.querySelector(".invitation").getBoundingClientRect();
      const maxX = Math.max(box.width - noBtn.offsetWidth - 36, 80);
      const maxY = Math.max(box.height - noBtn.offsetHeight - 36, 80);
      const x = Math.random() * maxX - maxX / 2;
      const y = Math.random() * maxY - maxY / 2;
      noBtn.style.transform = `translate(${x}px, ${y}px) rotate(${Math.random() * 18 - 9}deg)`;
      teaseText.textContent = teasing[noAttempts % teasing.length];
      noAttempts += 1;
      if (noAttempts > 3) noBtn.textContent = "Maybe yes?";
    }

    document.querySelectorAll(".choice-grid").forEach((group) => {
      group.querySelector("button")?.classList.add("selected");
      group.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        group.querySelectorAll("button").forEach((i) => i.classList.remove("selected"));
        btn.classList.add("selected");
        answers[group.dataset.choiceGroup] = btn.dataset.value;
        burstHearts(e.clientX, e.clientY);
      });
    });

    planForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const date = document.getElementById("dateInput").value;
      const time = document.getElementById("timeInput").value;
      const whatsapp = document.getElementById("whatsappInput").value.trim();
      const note = document.getElementById("noteInput").value.trim();
      const readableDate = date
        ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : "your favorite day";
      const readableTime = time || "your favorite time";

      const response = {
        slug: profile.slug,
        name: profile.name,
        answer: "yes",
        date,
        time,
        readableDate,
        readableTime,
        treat: answers.treat,
        mood: answers.mood,
        whatsapp,
        note,
        submittedAt: new Date().toISOString(),
      };

      saveResponseLocally(response);
      sendResponseToRepo(response);

      document.querySelector("[data-field='finaleTitle']").textContent = "Yes, our date is beautifully secured.";
      finalMessage.textContent = `Beautiful. Our date is secured for ${readableDate} at ${readableTime}. We will meet for ${answers.treat}, keep it ${answers.mood}, and I promise to make that day feel special for you.`;

      setupDelivery(profile, response, replyLink, downloadBtn);

      document.body.classList.add("response-complete");
      finalCard.classList.remove("hidden");
      finalCard.classList.add("reveal");
      confettiHearts();
      setTimeout(() => finalCard.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
    });

    restartBtn.addEventListener("click", () => {
      document.body.classList.remove("response-complete");
      document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
    });
  }

  function setupDelivery(profile, response, replyLink, downloadBtn) {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(response))));
    const human =
      `Yes! I will go on a date with you. ` +
      `Let's make it ${response.mood} with ${response.treat} on ${response.readableDate} at ${response.readableTime}.` +
      (response.whatsapp ? ` My WhatsApp: ${response.whatsapp}.` : "") +
      (response.note ? ` Note: ${response.note}` : "");
    const message = `${human}\n\n(Answer code for ${profile.name}: ${code})`;

    if (profile.whatsapp) {
      const num = profile.whatsapp.replace(/[^\d]/g, "");
      replyLink.href = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
      replyLink.classList.remove("hidden");
      replyLink.textContent = "Send me your answer on WhatsApp";
    } else if (profile.email) {
      replyLink.href = `mailto:${profile.email}?subject=${encodeURIComponent(
        `My answer (${profile.name})`
      )}&body=${encodeURIComponent(message)}`;
      replyLink.classList.remove("hidden");
      replyLink.textContent = "Send me your answer";
    } else {
      replyLink.classList.add("hidden");
    }

    downloadBtn.classList.remove("hidden");
    downloadBtn.textContent = "Secured Most Valuable Date";
    downloadBtn.onclick = async () => {
      await copyText(code);
      downloadBtn.textContent = "Our date is safely secured";
      setTimeout(() => {
        downloadBtn.textContent = "Secured Most Valuable Date";
      }, 2200);
    };
  }

  // Saves her answer to Supabase (via the date-response Edge Function) so it is
  // stored instantly and visible in Admin from any device/country. The local
  // save above stays as a fallback if the network is unavailable.
  function sendResponseToRepo(response) {
    const url = (window.TNS && window.TNS.responseUrl) || "";
    const anon = (window.TNS && window.TNS.anonKey) || "";
    if (!url) return;
    try {
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify(response),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {
      /* network blocked; local copy still kept */
    }
  }

  function saveResponseLocally(response) {
    try {
      const key = "tns:responses";
      const all = JSON.parse(localStorage.getItem(key) || "[]");
      all.push(response);
      localStorage.setItem(key, JSON.stringify(all));
      localStorage.setItem(`tns:last:${response.slug}`, JSON.stringify(response));
    } catch (_) {
      /* storage unavailable; delivery link still works */
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
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

  function burstHearts(x, y) {
    for (let i = 0; i < 9; i += 1) {
      const h = document.createElement("span");
      h.className = "heart";
      h.innerHTML = "&hearts;";
      h.style.left = `${x + Math.random() * 70 - 35}px`;
      h.style.top = `${y + Math.random() * 30 - 15}px`;
      h.style.animationDelay = `${i * 35}ms`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1100);
    }
  }
  function confettiHearts() {
    for (let i = 0; i < 32; i += 1) {
      setTimeout(() => {
        const h = document.createElement("span");
        h.className = "heart";
        h.innerHTML = "&hearts;";
        h.style.left = `${Math.random() * window.innerWidth}px`;
        h.style.top = `${window.innerHeight - 80}px`;
        document.body.appendChild(h);
        setTimeout(() => h.remove(), 1100);
      }, i * 55);
    }
  }
})();
