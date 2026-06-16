// -----------------------------------------------------------------------------
// Supabase connection for saving + reading responses.
// These two values are safe to be public (the anon key only allows calling the
// Edge Functions; it cannot read your database directly).
// -----------------------------------------------------------------------------
window.TNS = window.TNS || {};

window.TNS.responseUrl =
  "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/date-response";

window.TNS.girlUrl =
  "https://pjzhwnztlqbfyjnrqvrl.supabase.co/functions/v1/girls";

window.TNS.anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqemh3bnp0bHFiZnlqbnJxdnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY1NzIsImV4cCI6MjA5NzE2MjU3Mn0.feyDSuD951TGndME1dElGikBZ8lwzSctpE7xbQUH-tM";

// Start loading her profile as soon as this file runs (before girl.js), so the
// network request overlaps with CSS + script parsing.
(function bootProfileFetch() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length && parts[parts.length - 1].toLowerCase().endsWith(".html")) parts.pop();
  const slug = parts.length ? decodeURIComponent(parts[parts.length - 1]).toLowerCase() : "";
  if (!slug || !window.TNS.girlUrl || !window.TNS.anonKey) return;

  const CACHE_KEY = "tns:profile:" + slug;
  const CACHE_MS = 30 * 60 * 1000;
  const headers = { apikey: window.TNS.anonKey, Authorization: "Bearer " + window.TNS.anonKey };
  const url = `${window.TNS.girlUrl}?slug=${encodeURIComponent(slug)}`;

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const pack = JSON.parse(raw);
      if (!pack || !pack.girl || Date.now() - pack.t > CACHE_MS) return null;
      return pack.girl;
    } catch (_) {
      return null;
    }
  }

  function writeCache(girl) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), girl }));
    } catch (_) {
      /* storage full or blocked */
    }
  }

  function preloadHero(girl) {
    if (!girl || !girl.images || !girl.images[0]) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = girl.images[0];
    document.head.appendChild(link);
  }

  function fetchProfile() {
    return fetch(url, { headers, cache: "default" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not found"))))
      .then((data) => {
        if (data && data.ok && data.girl) {
          writeCache(data.girl);
          preloadHero(data.girl);
        }
        return data;
      });
  }

  const cached = readCache();
  if (cached) {
    window.TNS.profilePromise = Promise.resolve({ ok: true, girl: cached, fromCache: true });
    preloadHero(cached);
    fetchProfile().catch(() => {});
  } else {
    window.TNS.profilePromise = fetchProfile();
  }
})();
