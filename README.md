# The Next Step of My Life

A private, file-based collection of personalized "will you go on a date with me?" pages.
Each girl gets her **own folder and her own link**, so no one can see anyone else's page.
The whole thing is **static** and runs on **GitHub Pages** — no database. Responses are saved straight
into the repo's XML by a **GitHub Action** (rung by a tiny free relay), so you see them automatically.

Live base URL: `https://psbandarigoda.github.io/The-Next-Step-of-My-Life/`

---

## How the links work

| Link | What it shows |
| --- | --- |
| `…/The-Next-Step-of-My-Life/` | A clean **general** landing page (no girl's data). |
| `…/The-Next-Step-of-My-Life/<Folder-Name>/` | That girl's personal invitation page. |
| `…/The-Next-Step-of-My-Life/Third-Eye/Admin/` | The **Admin** panel (login `root` / `root`). |
| Any wrong/unknown link | Falls back to the clean general page. |

Example for one girl: `…/The-Next-Step-of-My-Life/Sanduni-Kamburadeniya/`

> Tip: folder/link names use hyphens instead of spaces (so `Sanduni-Kamburadeniya`, not `Sanduni Kamburadeniya`). The Admin builds this automatically and shows you the exact link to copy.

---

## Folder structure

```
/
├─ index.html                      general landing page
├─ 404.html                        catch-all (shows the general page)
├─ .nojekyll                       tells GitHub Pages to serve all folders as-is
├─ assets/
│  ├─ css/main.css
│  ├─ js/effects.js                falling-hearts background
│  ├─ js/girl.js                   renders any girl page from her profile.xml
│  ├─ js/admin.js                  the Admin logic
│  └─ <folder-name>/               one folder per girl: images + data
│     ├─ <her photos>.jpg/.png
│     ├─ profile.xml               her name, words, image list, your contact
│     └─ responses.xml             her submitted answers
├─ <folder-name>/
│  └─ index.html                   her page (a copy of the template)
├─ template/girl/index.html        master template copied for each new girl
└─ Third-Eye/Admin/index.html      admin panel
```

A girl's **page** lives at `/<folder-name>/` and her **data + photos** live at `/assets/<folder-name>/`.

---

## Adding a new girl (from the Admin page)

The Admin writes the real files into this repo folder on your computer, using your browser's
file access. **Use Chrome or Edge on desktop.**

1. Open `…/Third-Eye/Admin/` (or `Third-Eye/Admin/index.html` locally) and log in with `root` / `root`.
2. Click **Connect repository** and pick this project's folder. Allow edit access.
3. Go to **Add a girl**:
   - Enter her **name** and a **folder/link name** (auto-filled from the name).
   - Upload a few **jpg/png** photos (first photo = the big one).
   - Optionally set your **WhatsApp number / email** (used for her reply) and custom words.
4. Click **Create her page**. The Admin will:
   - create `assets/<folder-name>/` and save the photos there,
   - write `profile.xml` and an empty `responses.xml`,
   - create `<folder-name>/index.html` (a copy of the template),
   - copy her link to your clipboard.
5. **Commit & push** so the link goes live:

   ```bash
   git add .
   git commit -m "Add <name>"
   git push
   ```

6. Share her link.

Everything except name, photos, folder name and optional contact uses a shared **general template**.

---

## Seeing responses

When a girl submits — **from any phone, any country** — her answer is sent to a tiny **relay**
("doorbell") that rings a **GitHub Action** in this repo. The Action commits her answer into
`assets/responses.xml` (and her own `assets/<girl>/responses.xml`) automatically. A minute later it
shows up in **Admin → Responses** with no manual import.

In **Admin → Responses** you can **Refresh** to read every response (who, what they chose, when),
**Export CSV**, and **Reset** any row. Responses you tested on your own machine are also still merged
from your browser as a fallback.

> If you skip the one-time relay setup below, remote answers can't reach the repo — they only stay in
> the girl's own browser. Setup is required for cross-device saving.

---

## One-time setup: auto-save responses from any device

This is what makes a girl's answer reach your repo from another phone/country. You do it once.

**1. Create a GitHub token (the key the relay uses).**
On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
- **Repository access:** Only select repositories → `psbandarigoda/The-Next-Step-of-My-Life`
- **Permissions:** **Contents → Read and write** (this lets the Action run and commit)
- Generate and copy the token (starts with `github_pat_…`). Treat it like a password.

**2. Deploy the relay (free, no credit card) — `relay/cloudflare-worker.js`.**
- Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Worker**, give it a name (e.g. `tns-relay`), **Deploy**.
- Click **Edit code**, paste the contents of `relay/cloudflare-worker.js`, **Deploy** again.
- Open the worker's **Settings → Variables and Secrets → Add → Secret**:
  - **Name:** `GH_TOKEN`  **Value:** the token from step 1. Save.
- Copy the worker URL, e.g. `https://tns-relay.yourname.workers.dev`.

**3. Point the site at your relay.**
Open `assets/config.js` and paste your URL:

```js
window.TNS.relayUrl = "https://tns-relay.yourname.workers.dev";
```

Then commit & push:

```bash
git add .
git commit -m "Enable remote response saving"
git push
```

**4. Make sure the Action can push.**
On GitHub: **Settings → Actions → General → Workflow permissions → Read and write permissions** → Save.

That's it. Test by submitting from your phone; within ~1 minute the new commit "New response (auto-saved
from a girl's device)" appears and the answer shows in Admin.

> Prefer GitHub Actions only / a different relay host? Any small serverless function works — it just needs to
> POST `{ event_type: "new-response", client_payload: <the answer> }` to
> `https://api.github.com/repos/psbandarigoda/The-Next-Step-of-My-Life/dispatches` with the token in the
> `Authorization` header. The Cloudflare Worker is simply the easiest free option.

---

## Keeping your data safe (girls + responses)

Your data lives in committed XML files so GitHub Pages can serve it:

- `assets/girls.xml` — the list of girls
- `assets/responses.xml` — **all responses (your most important data)**
- `assets/<girl>/profile.xml`, `assets/<girl>/responses.xml`, and her photos

Because these are normal files in the repo, **pushing code does not delete them** — but you can overwrite
newer data by pushing an older copy. To stay safe:

1. **Before** editing code or pushing, open **Admin → Backup & restore → Download full backup**. Keep that
   JSON file somewhere safe (it holds every girl + every response). A rolling copy is also kept automatically
   in your browser.
2. Always **pull before you push**:

   ```bash
   git pull --rebase
   git add .
   git commit -m "Update"
   git push
   ```

3. If data is ever lost, open **Admin → Backup & restore → Restore from a backup file**, choose your backup,
   and it **merges** everything back (nothing is overwritten or duplicated). Then commit & push.

> The downloaded backup files (`next-step-backup-*.json`) and `responses-*.csv` are git-ignored on purpose —
> keep them outside the repo as your private safety copies. The actual data XML files stay tracked.

## First-time publish to GitHub Pages

```bash
git init
git add .
git commit -m "Redesign: per-girl folders + Third-Eye admin"
git branch -M main
git remote add origin https://github.com/psbandarigoda/The-Next-Step-of-My-Life.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / root**, and save.
The site appears at `https://psbandarigoda.github.io/The-Next-Step-of-My-Life/` within a minute or two.

---

## Notes & limits

- The Admin login (`root` / `root`) is a light gate for a private link, **not real security**. Anyone who finds the Admin URL and types the password can open it. Keep the link private; change the credentials in `assets/js/admin.js` if you like.
- Adding girls / saving responses needs **Chrome or Edge on desktop** (they support the File System Access API). Girl pages and the landing page work in any browser.
- For local testing, open the site through a small web server (e.g. VS Code "Live Server") rather than double-clicking the HTML, so the pages can read their XML files.
