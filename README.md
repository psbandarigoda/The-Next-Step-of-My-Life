# The Next Step of My Life

A collection of personalized "will you go on a date with me?" pages. Each girl gets her **own private link**,
and no one can see anyone else's page. The site is **static** (GitHub Pages), but everything dynamic — every
girl's profile, her photos, and her answers — lives in **Supabase**. So you add, edit, or remove a girl
entirely from the **Admin** page, and her link works **instantly** with no files to edit and no git push.

Live base URL: `https://psbandarigoda.github.io/The-Next-Step-of-My-Life/`

---

## How the links work

| Link | What it shows |
| --- | --- |
| `…/The-Next-Step-of-My-Life/` | A clean **general** landing page (no girl's data). |
| `…/The-Next-Step-of-My-Life/<her-slug>` | That girl's personal invitation page (loaded from the database). |
| `…/The-Next-Step-of-My-Life/Third-Eye/Admin/` | The **Admin** panel (login `root` / `root`). |
| Any unknown link | The clean general "open your personal link" page. |

Example: `…/The-Next-Step-of-My-Life/Kavindya-Dodangoda`

> Links are **case-insensitive** (`Kavindya-Dodangoda` and `kavindya-dodangoda` both work). The Admin shows
> you the exact link to copy for each girl.

### How one page serves every girl

There are **no per-girl folders**. GitHub Pages serves `404.html` for any path that isn't a real file, so
`…/The-Next-Step-of-My-Life/<her-slug>` lands on `404.html`, which reads the slug from the URL and loads that
girl's profile from the database. Add a girl in Admin → her link is live the same second.

---

## Folder structure

```
/
├─ index.html                  general landing page (the base URL)
├─ 404.html                    universal girl page (renders any /<slug> from the database)
├─ .nojekyll                   serve files as-is on GitHub Pages
├─ assets/
│  ├─ config.js                public Supabase URLs + anon key (safe to be public)
│  ├─ css/main.css
│  ├─ js/effects.js            falling-hearts background
│  ├─ js/girl.js               loads a girl by slug from the database and renders her page
│  └─ js/admin.js              the Admin logic (girls CRUD + responses)
└─ Third-Eye/Admin/index.html  admin panel
```

That's the whole repo — just static code. No data is stored in git anymore.

---

## Where everything lives (Supabase)

Everything is in **one isolated `nextstep` schema** plus a public Storage bucket, reached only through two
secure Edge Functions:

- **`nextstep.girls`** table — every girl's profile (name, all sentences, photo URLs, your contact).
- **`nextstep.responses`** table — every answer a girl submits.
- **`girl-photos`** Storage bucket — the uploaded photos (publicly readable so pages can show them).
- **`girls` Edge Function** — public "get one girl by slug" for the page; admin-only list / add / edit /
  delete and photo upload.
- **`date-response` Edge Function** — public "save an answer"; admin-only list / delete.

The tables have **no public database access** (RLS on, no policies). A girl's page can only *fetch her own
profile* and *send an answer*; it can never read the database directly or see other girls. Admin actions are
gated by a secret key (`x-admin-key`) that lives only in `admin.js`.

---

## Managing girls (all from the Admin page)

Open `…/Third-Eye/Admin/` and log in with `root` / `root`. Works in **any modern browser, on phone or
desktop** — there is nothing to install or connect.

**Girls** tab:

- See every girl as a card with her cover photo, name, link (with a **Copy** button), **Open**, **Edit**,
  and **Delete**.
- **+ Add a girl** opens the editor with every sentence **pre-filled** with sweet default wording you can
  edit. Write `{name}` in any sentence and it becomes her real name on the page.
- Add up to **5 photos** (used as: big hero photo, two floating photos, the polaroid close-up, the finale
  photo). When editing, the current photo shows under each slot — pick a new file only for the ones you want
  to replace.
- Optionally set **your WhatsApp / email** for her reply, and the three little "reasons".
- Click **Save her page** — photos upload, the profile saves, and her link is live immediately.
- **Delete** removes her profile and her photos.

That's it — no folders, no commits, no template copying.

---

## Seeing responses

When a girl submits — **from any phone, any country** — her answer is saved **instantly** to Supabase and
shows in **Admin → Responses** within seconds. There you can see who answered, what they chose, and when,
**Export CSV**, and **Reset** (permanently delete) any row.

---

## Configuration (already done)

- `assets/config.js` holds the public Edge Function URLs + anon key (safe to be public).
- `assets/js/admin.js` holds the same URLs plus the admin secret key. To rotate the secret, change
  `ADMIN_KEY` in **both** Edge Functions (`girls` and `date-response`) and the `adminKey` value in
  `admin.js` to match.

---

## First-time publish to GitHub Pages

```bash
git add .
git commit -m "Database-driven girls + admin"
git branch -M main
git remote add origin https://github.com/psbandarigoda/The-Next-Step-of-My-Life.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` /
root**, and save. The site appears at `https://psbandarigoda.github.io/The-Next-Step-of-My-Life/` within a
minute or two.

---

## Notes & limits

- The Admin login (`root` / `root`) is a light gate for a private link, **not real security**. Keep the
  Admin URL private; change the credentials in `assets/js/admin.js` if you like.
- Because all data is in Supabase, **pushing code can never delete a girl or a response.**
- For local testing, open the site through a small web server (e.g. VS Code "Live Server") so the pages can
  call the Edge Functions. Note the `404.html` routing trick only works on GitHub Pages, so locally open a
  girl page via the Admin "Open" link or by hitting the Edge Function — on the live site every `/<slug>`
  works automatically.
