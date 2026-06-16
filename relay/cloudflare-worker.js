// =============================================================================
// THE "DOORBELL" RELAY  (Cloudflare Worker — free, no credit card)
// -----------------------------------------------------------------------------
// A girl's phone POSTs her answer here. This worker holds your secret GitHub
// token (set as the GH_TOKEN secret) and uses it to ring your repo's
// "Save response" GitHub Action, which then writes her answer into the XML.
//
// The token NEVER appears in your public website — only here, on Cloudflare.
//
// Setup (one time):
//   1. Create a GitHub fine-grained token with ONLY:
//        Repository: psbandarigoda/The-Next-Step-of-My-Life
//        Permission: "Contents" = Read and write   (lets the Action run + commit)
//   2. https://dash.cloudflare.com  ->  Workers & Pages  ->  Create -> Worker
//   3. Paste this file as the worker code and Deploy.
//   4. In the worker: Settings -> Variables and Secrets -> add a SECRET
//        Name:  GH_TOKEN     Value: <the token from step 1>
//   5. Copy the worker URL (e.g. https://tns-relay.<you>.workers.dev) and put it
//      in assets/config.js as window.TNS.relayUrl.
// =============================================================================

const REPO = "psbandarigoda/The-Next-Step-of-My-Life";
const EVENT_TYPE = "new-response";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Use POST." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON." }, 400);
    }
    if (!body || !body.slug) {
      return json({ ok: false, error: "Missing slug." }, 400);
    }

    const s = (v) => (v == null ? "" : String(v));
    const payload = {
      name: s(body.name).slice(0, 200),
      slug: s(body.slug).slice(0, 100),
      answer: s(body.answer || "yes").slice(0, 20),
      date: s(body.date).slice(0, 40),
      time: s(body.time).slice(0, 40),
      whatsapp: s(body.whatsapp).slice(0, 40),
      treat: s(body.treat).slice(0, 200),
      mood: s(body.mood).slice(0, 200),
      note: s(body.note).slice(0, 2000),
      submittedAt: s(body.submittedAt) || new Date().toISOString(),
    };

    const gh = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tns-relay",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: EVENT_TYPE, client_payload: payload }),
    });

    if (gh.status === 204) return json({ ok: true }, 200);

    const detail = await gh.text();
    return json({ ok: false, error: `GitHub responded ${gh.status}`, detail }, 502);
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
