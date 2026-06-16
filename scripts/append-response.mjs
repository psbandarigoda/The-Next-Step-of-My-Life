// Runs inside the "Save response" GitHub Action.
// Reads the submitted answer from RESPONSE_JSON and appends it to:
//   - assets/responses.xml            (central list the Admin reads)
//   - assets/<slug>/responses.xml     (that girl's own backup copy)
// The XML shape is identical to what the Admin panel writes, so it just works.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const EMPTY = '<?xml version="1.0" encoding="UTF-8"?>\n<responses>\n</responses>\n';

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let payload;
try {
  payload = JSON.parse(process.env.RESPONSE_JSON || "{}");
} catch {
  console.log("Payload was not valid JSON; nothing to do.");
  process.exit(0);
}

if (!payload || !payload.slug) {
  console.log("No slug in payload; skipping.");
  process.exit(0);
}

// Only allow safe folder names so the payload can't point outside assets/.
const slug = String(payload.slug)
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "");

if (!slug) {
  console.log("Slug became empty after sanitizing; skipping.");
  process.exit(0);
}

const submittedAt = String(payload.submittedAt || new Date().toISOString());

const snippet = `  <response>
    <name>${esc(payload.name)}</name>
    <slug>${esc(slug)}</slug>
    <submittedAt>${esc(submittedAt)}</submittedAt>
    <answer>${esc(payload.answer || "yes")}</answer>
    <date>${esc(payload.date)}</date>
    <time>${esc(payload.time)}</time>
    <whatsapp>${esc(payload.whatsapp)}</whatsapp>
    <treat>${esc(payload.treat)}</treat>
    <mood>${esc(payload.mood)}</mood>
    <note>${esc(String(payload.note || "").slice(0, 2000))}</note>
  </response>`;

function appendTo(file) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : EMPTY;
  if (!text.includes("</responses>")) text = EMPTY;

  // ISO timestamps carry millisecond precision, so this reliably blocks
  // accidental double-submits / retries from creating duplicate entries.
  if (text.includes(`<submittedAt>${esc(submittedAt)}</submittedAt>`)) {
    console.log(`Already present in ${file}; skipping.`);
    return;
  }

  text = text.replace("</responses>", `${snippet}\n</responses>`);
  writeFileSync(file, text);
  console.log(`Appended response to ${file}`);
}

appendTo(join("assets", "responses.xml"));

const girlDir = join("assets", slug);
if (!existsSync(girlDir)) mkdirSync(girlDir, { recursive: true });
appendTo(join(girlDir, "responses.xml"));
