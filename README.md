# The Next Step of My Life

A private, file-based collection of personalized "will you go on a date with me?" pages.
Each girl gets her **own folder and her own link**, so no one can see anyone else's page.
The whole thing is **static** and runs on **GitHub Pages** — there is no server and no database.

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

Because a static site cannot write back to the repo from a visitor's phone, a girl's answer is
**delivered to you** when she submits (WhatsApp or email if you set them, plus a downloadable file),
and her message includes a short **answer code**.

In **Admin → Responses** you can:

- **Refresh** to read every girl's `responses.xml` and see who submitted, what they chose, and when.
- **Export CSV** of all responses.
- **Import answers from this browser** (handy when you tested on your own machine).
- **Save this answer** by pasting the **answer code** from a girl's message into the box and clicking save — it appends to her `responses.xml`.

After importing answers, **commit & push** to keep them in the repo:

```bash
git add .
git commit -m "Save responses"
git push
```

---

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
