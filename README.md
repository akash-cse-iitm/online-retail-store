# Maa Annapurna Mart

A static grocery ordering site. Customers browse products, add them to a cart, fill in their name/phone/address, and the order is sent as a pre-filled WhatsApp message — no payment gateway involved, payment is Cash on Delivery. A password-gated admin dashboard lets the shop owner manage products, prices, discount badges, images (with in-browser upload), categories, and every shop-wide detail (name, WhatsApp number, address, delivery/payment notes, logo, open/closed status).

## Structure

- `index.html` / `style.css` / `script.js` — the storefront
- `data.json` — **all editable storefront content**: shop profile and product catalog
- `admin.html` / `admin.js` / `admin.css` — the admin dashboard
- `admin-config.json` — admin login password hash (used only by the login screen)
- `images/` — created automatically the first time you upload an image from the admin panel
- `image-credits.html` — attribution for the seed stock photos
- `.nojekyll` — tells GitHub Pages to serve files as-is (no Jekyll processing)
- `netlify.toml` — zero-config static-site settings for Netlify

## Run locally

The storefront and admin panel both load JSON via `fetch()`, so you need to serve the folder (opening the HTML files directly as `file://` URLs won't load the data):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## How content flows

1. **`data.json`** holds the shop profile and product catalog. The storefront (`script.js`) reads it with a plain, unauthenticated `fetch()` — same as any other static asset.
2. **The admin panel** (`admin.html`) edits that same data in your browser, then **publishes** by committing straight to `data.json` in your GitHub repo via the GitHub REST API, authenticated with a Personal Access Token you provide. There's no server or database — GitHub *is* the database, and your host (GitHub Pages / Vercel / Netlify / Render) just serves whatever's in the repo.
3. **Uploaded images** work the same way: the admin panel compresses the photo in your browser, then commits it into an `images/` folder in the repo. Because it becomes a normal file in the repo, it shows up on whichever host you use — no third-party image host or API key needed.

## Admin dashboard

Visit `/admin.html` (linked in the storefront footer). It's a three-step flow:

1. **Login** — password only, checked against `admin-config.json`.
   - Default password: **password12345**
   - **Change this immediately** via the Account tab once you're connected to GitHub (see below) — no code editing or terminal needed.
   - This is a convenience lock on the *screen*, not real security by itself (the hash lives in a public file, same as any static site with no backend). The GitHub token in step 2 is the real security boundary — only someone with that token can actually publish changes.
2. **Connect to GitHub** — paste a **Personal Access Token** scoped to your repo:
   - Go to [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta) → "Generate new token".
   - Scope it to **only this repository**.
   - Under Repository permissions, set **Contents: Read and write**.
   - The token is stored only in your browser's local storage — it is never committed to the repo. Treat it like a password.
3. **Edit**, across four tabs:
   - **🏪 Shop Profile** — logo (upload), store name, tagline, owner name, display phone, WhatsApp number, address, delivery note, payment note, and an Open/Closed toggle (shows a banner to customers when off).
   - **🗂️ Categories** — add, rename, reorder (↑/↓), or delete categories. Deleting one that still has products moves them to "Uncategorized" instead of losing them.
   - **📦 Products** — add, duplicate, search, or delete products. Each product has name, category, unit, selling price, MRP (optional — auto-computes a "% OFF" badge), a custom badge override (e.g. "Bestseller"), a fallback emoji, a description, an image (paste a URL or click **Upload** to pick a photo from your device), and an **In stock** toggle. Unticking "In stock" greys the product out on the storefront, labels it "Out of Stock", and blocks it from being added to a cart — it also gets removed from any customer's existing cart automatically, so you never receive an order for something you don't have.
   - **🔐 Account** — change the admin password. This rewrites `admin-config.json` in your repo through the same GitHub token, so it's fully self-service.
   - **Save & Publish** (bottom bar) commits `data.json`. Image/logo uploads and Account changes commit immediately when you make them (each is its own small commit); the rest of your edits only go live when you click Save & Publish.

The panel warns you before closing the tab if you have unsaved changes, and validates the form (valid prices, a real WhatsApp number, etc.) before publishing.

## Product images

You have three ways to set a product's image, all editable from the Products tab:

- **Upload a photo (recommended)** — click **Upload**, pick a photo from your device. It's automatically resized/compressed in your browser, then committed to `images/` in your repo and referenced by path. Works identically on all four hosting options below.
- **Paste a direct image URL** — must point straight at the image bytes (e.g. `https://.../photo.jpg`), not a viewer/gallery page.
- **Hand-edit `data.json`** — for bulk changes, edit the file directly and commit/push.

Note: re-uploading a product's photo doesn't delete the old file from `images/` — it just stops being referenced. Harmless, but you can clean out old files from GitHub's web UI occasionally if you want to.

The seed catalog ships with free Creative Commons stock photos (see `image-credits.html`) — swap them for real photos of your shop's stock whenever you like.

## WhatsApp ordering

Orders use **WhatsApp Click-to-Chat** (`wa.me` links) — the free, no-approval way to receive orders on a static site: tapping "Order Now on WhatsApp" opens a pre-filled message (items, total, customer name/phone/address, and "Payment: Cash on Delivery") in WhatsApp, which the customer sends themselves. This is different from the paid **WhatsApp Business Platform API** (used for automated bot replies), which requires a Meta Business account and a backend server — out of scope for a static, no-backend site like this one. If a pop-up blocker prevents the WhatsApp tab from opening, a fallback link appears so the order is never lost.

## Deploy

Pick any one of these — all of them just serve the repo's static files, no build step required.

### GitHub Pages

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Then on GitHub: **Settings → Pages** → Source: `Deploy from a branch` → Branch `main`, folder `/ (root)` → **Save**. Live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

### Vercel

Push to GitHub as above, then [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Leave all build settings blank (no framework, no build command) → **Deploy**.

### Netlify

Push to GitHub, then [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → pick the repo. Build command: leave empty. Publish directory: `.` (the included `netlify.toml` already sets this, so the defaults just work).

### Render

Push to GitHub, then [dashboard.render.com](https://dashboard.render.com) → **New → Static Site** → connect the repo. Build command: leave empty. Publish directory: `.` (repo root).

### After deploying

Use the admin panel exactly the same way regardless of host — connect with your GitHub token, edit, Save & Publish. Every commit the admin panel makes (data, images, credentials) triggers a fresh redeploy on all four platforms automatically. Changes are typically live within about a minute; if you still see old data, hard-refresh (the storefront also fetches `data.json` with caching disabled, but your host's CDN may cache briefly).
