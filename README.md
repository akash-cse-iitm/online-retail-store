# Maa Annapurna Mart

A simple, static grocery ordering page. Customers browse products by category, add items to a cart, fill in their name/phone/address, and the order is sent as a pre-filled WhatsApp message — no payment gateway involved. Includes a password-gated admin panel for editing products, prices, images, and store profile.

## Structure

- `index.html` — storefront markup
- `style.css` — storefront + shared styling
- `script.js` — loads `data.json`, cart logic, search, and WhatsApp order handoff
- `data.json` — **all editable content**: store profile (name, tagline, owner, phone) and product catalog
- `admin.html` / `admin.js` / `admin.css` — admin panel to edit `data.json`
- `image-credits.html` — attribution for the free stock photos used on product cards

## Run locally

Because the storefront loads `data.json` via `fetch()`, you need to serve the folder (opening `index.html` directly as a `file://` URL won't load the data):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Editing content

You can edit products/prices/images/profile two ways:

1. **Directly** — edit `data.json` by hand and commit/push.
2. **Via the admin panel** — see below.

## Admin panel

Visit `/admin.html` (linked in the storefront footer).

1. **Password screen** — default password is `annapurna123`. This only gates the screen in your own browser; it is not real security by itself. To change it, compute a new SHA-256 hex hash of your password (e.g. `python3 -c "import hashlib; print(hashlib.sha256(b'yourpassword').hexdigest())"`) and replace `ADMIN_PASSWORD_HASH` in `admin.js`.
2. **Connect to GitHub** — since this is a static site with no backend, saving changes works by committing straight to `data.json` in your GitHub repo via the GitHub API. You'll need a **Personal Access Token**:
   - Go to [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta) → "Generate new token".
   - Scope it to **only this repository**.
   - Under Repository permissions, set **Contents: Read and write**.
   - Copy the token and paste it into the admin panel along with your GitHub username, repo name, and branch (`main`).
   - The token is stored only in your browser's local storage — it is never committed to the repo. Treat it like a password; anyone with it (and repo access) can push to your repo.
3. **Edit** store profile and products, then **Save & Publish** — this commits directly to `main`, and GitHub Pages redeploys automatically (~1 minute).

The real security boundary here is the GitHub token itself (only someone with write access to your repo can save changes) — the password screen is just a convenience lock on top.

## Product images

Product photos are free, Creative Commons–licensed images sourced via [Openverse](https://openverse.org). Since these are generic stock photos (not real photography of your actual store's stock), swap in your own anytime via the admin panel's Image URL field. Attribution for the current photos is listed in `image-credits.html`.

You have three options for the Image URL field:

- **A direct link to an image already on the web** (Imgur, Cloudinary, another CDN, etc.) — must point straight at the image bytes, e.g. `https://.../photo.jpg`, not a viewer/gallery page.
- **Google Drive** — works, but isn't reliable for a live storefront. A normal share link (`.../file/d/FILE_ID/view`) is an HTML page and won't render as an image; you'd need to rewrite it to `https://drive.google.com/uc?export=view&id=FILE_ID`, and Google frequently rate-limits or blocks that kind of public hotlinking, so images can break unpredictably for customers. Avoid it for anything customer-facing.
- **Host the image in this repo (recommended)** — create an `images/` folder, drag-and-drop your photos in via the GitHub web UI (no git commands needed), then set the Image URL field to `images/your-file.jpg`. This is permanent, free, fast, and never rate-limited, since it's served by the same host as the rest of the site.

## Deploy to GitHub Pages

1. Create a new repo on GitHub (e.g. `maa-annapurna-mart`), then from this folder:

   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```

2. On GitHub: go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
4. Choose branch `main` and folder `/ (root)`, then **Save**.
5. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.
6. To use the admin panel against the live repo, generate a GitHub token as described above and connect via `/admin.html`.

## Alternative: deploy to Vercel

You still need the GitHub repo either way — the admin panel saves by committing to it directly. Vercel just replaces GitHub Pages as the *hosting* layer, and auto-redeploys on every commit (including ones the admin panel makes), no config needed for a plain HTML/CSS/JS site like this:

1. Push this repo to GitHub as described above.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import that GitHub repo.
3. Leave all build settings blank/default (no framework, no build command) and click **Deploy**.
4. Your site is live at `https://<project-name>.vercel.app`. Every future push (manual or via the admin panel) redeploys automatically.
