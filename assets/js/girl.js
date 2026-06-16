// Renders a single girl's invitation page from her own profile.xml.
// Every girl folder shares this exact script; the slug is derived from the
// folder name, so the same template works for everyone.
(function () {
  const app = document.getElementById("app");
  const missing = document.getElementById("missing");

  const slug = resolveSlug();
  if (!slug) {
    showMissing();
    return;
  }

  fetch(`../assets/${encodeURIComponent(slug)}/profile.xml`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("not found");
      return res.text();
    })
    .then((text) => {
      const xml = new DOMParser().parseFromString(text, "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("bad xml");
      renderPage(buildProfile(xml));
    })
    .catch(() => showMissing());

  function resolveSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length && parts[parts.length - 1].toLowerCase().endsWith(".html")) parts.pop();
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : "";
  }

  function showMissing() {
    if (app) app.classList.add("hidden");
    if (missing) missing.classList.remove("hidden");
  }

  function text(xml, tag) {
    const node = xml.querySelector(tag);
    return node ? node.textContent.trim() : "";
  }

  function buildProfile(xml) {
    const name = text(xml, "name") || "you";
    const images = Array.from(xml.querySelectorAll("images > image"))
      .map((n) => n.textContent.trim())
      .filter(Boolean);

    const fill = (tag, fallback) => text(xml, tag) || fallback;

    return {
      slug,
      name,
      images,
      eyebrow: fill("eyebrow", "A tiny surprise invitation"),
      headline: fill("headline", `${name}, your smile deserves a beautiful date.`),
      intro: fill(
        "intro",
        "I made this little page just for you, because asking you normally felt too small for someone this lovely."
      ),
      polaroidCaption: fill("polaroidCaption", "My favorite view"),
      question: fill("question", "Will you go on a date with me?"),
      questionSub: fill(
        "questionSub",
        "One evening. Good food. A little walk. A lot of smiles. And me trying my best to make you feel special."
      ),
      planTitle: fill("planTitle", `When are you free, ${name}?`),
      finaleTitle: fill("finaleTitle", "I will make it sweet, simple, and unforgettable."),
      finaleMessage: fill(
        "finaleMessage",
        "If you say yes, I will bring the smile, the care, and a little surprise just for you."
      ),
      reasons: Array.from(xml.querySelectorAll("reasons > reason")).map((r) => ({
        title: (r.querySelector("title") || {}).textContent || "",
        text: (r.querySelector("text") || {}).textContent || "",
      })),
      whatsapp: text(xml, "contact > whatsapp"),
      email: text(xml, "contact > email"),
    };
  }

  function imgUrl(profile, file) {
    return `../assets/${encodeURIComponent(profile.slug)}/${file}`;
  }

  function renderPage(profile) {
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
        <img class="portrait portrait-main" src="${imgUrl(profile, main)}" alt="${escapeAttr(profile.name)}">
        ${floatA ? `<img class="portrait portrait-float one" src="${imgUrl(profile, floatA)}" alt="">` : ""}
        ${floatB ? `<img class="portrait portrait-float two" src="${imgUrl(profile, floatB)}" alt="">` : ""}
      `;
    }
    const polaroidImg = document.getElementById("polaroidImg");
    const finaleImg = document.getElementById("finaleImg");
    if (polaroid) {
      polaroidImg.src = imgUrl(profile, polaroid);
      polaroidImg.alt = profile.name;
    }
    if (finale) {
      finaleImg.src = imgUrl(profile, finale);
      finaleImg.alt = profile.name;
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
        note,
        submittedAt: new Date().toISOString(),
      };

      saveResponseLocally(response);

      finalMessage.textContent = `So it is a ${answers.mood} date on ${readableDate} at ${readableTime}, with ${answers.treat}. I promise to make ${profile.name} smile from the first minute to the last.`;

      setupDelivery(profile, response, replyLink, downloadBtn);

      finalCard.classList.remove("hidden");
      finalCard.classList.add("reveal");
      confettiHearts();
      setTimeout(() => finalCard.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
    });

    restartBtn.addEventListener("click", () => {
      document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
    });
  }

  function setupDelivery(profile, response, replyLink, downloadBtn) {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(response))));
    const human =
      `Yes! I will go on a date with you. ` +
      `Let's make it ${response.mood} with ${response.treat} on ${response.readableDate} at ${response.readableTime}.` +
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
    downloadBtn.onclick = () => downloadResponse(response);
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

  function downloadResponse(response) {
    const xml = responseToXml(response);
    const blob = new Blob([xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `response-${response.slug}-${Date.now()}.xml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function responseToXml(r) {
    const esc = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    return `  <response>
    <submittedAt>${esc(r.submittedAt)}</submittedAt>
    <answer>${esc(r.answer)}</answer>
    <date>${esc(r.date)}</date>
    <time>${esc(r.time)}</time>
    <treat>${esc(r.treat)}</treat>
    <mood>${esc(r.mood)}</mood>
    <note>${esc(r.note)}</note>
  </response>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
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
