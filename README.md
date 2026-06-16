# The Next Step of My Life

A private, file-based collection of personalized "will you go on a date with me?" pages.
Each girl gets her **own folder and her own link**, so no one can see anyone else's page.
The pages are **static** and run on **GitHub Pages**. Responses are saved instantly to a small, isolated
**Supabase** backend (its own `nextstep` schema), so you see them in Admin from any device — automatically.

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

When a girl submits — **from any phone, any country** — her answer is saved **instantly** to a small
**Supabase** backend (a private `nextstep` table reached through one secure Edge Function called
`date-response`). It appears in **Admin → Responses** within seconds, with no manual import and no git push.

In **Admin → Responses** you can see every response (who, what they chose, when), **Export CSV**, and
**Reset** any row (which deletes it from Supabase too). The page also auto-refreshes every ~20 seconds.

**This is already set up and live — nothing for you to configure.** It works the moment your site is online.

### How it stays isolated and safe

- The dating data lives in its **own `nextstep` schema** — completely separate from your other Supabase
  tables, which are never touched.
- That table has **no public access**. A girl's page can only *send* an answer; it cannot read anything.
- Only the **Admin page** can read/delete, using a secret key (`x-admin-key`) that lives only in the
  Admin's JavaScript — never in a girl's page.

### Want the answers as XML files too?

Optional. If you connect the repo in **Admin** (the folder picker) and use **Backup & restore →
Download full backup**, you keep offline copies. The XML files (`assets/responses.xml`, etc.) still work
as a secondary/fallback store and are merged into the Admin view, but Supabase is now the live source.

### The keys (already filled in)

- `assets/config.js` holds the public Edge Function URL + anon key (safe to be public).
- `assets/js/admin.js` holds the same URL plus the admin secret key. To rotate the secret, change
  `ADMIN_KEY` in the `date-response` Edge Function and the `SUPABASE.adminKey` value in `admin.js` to match.

---

## Keeping your data safe (girls + responses)

**Responses** are stored in **Supabase** (the live source) — pushing code can never delete them.

The **girl/profile data** lives in committed XML files so GitHub Pages can serve it:

- `assets/girls.xml` — the list of girls
- `assets/<girl>/profile.xml` and her photos
- `assets/responses.xml`, `assets/<girl>/responses.xml` — optional offline copies / fallback

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
