# Maa Annapurna Mart

A simple, static grocery ordering page. Customers browse products by category, add items to a cart, fill in their name/phone/address, and the order is sent as a pre-filled WhatsApp message — no payment gateway involved.

## Structure

- `index.html` — page markup
- `style.css` — styling
- `products.js` — product catalog (edit this to add/remove/change items)
- `script.js` — cart logic, search, and WhatsApp order handoff

## Before you go live

Open `script.js` and update the store's real WhatsApp number:

```js
const STORE_WHATSAPP_NUMBER = "919876543210"; // country code + number, no + or spaces
const STORE_OWNER_NAME = "Person DHN";
```

Also update the contact line in `index.html`'s footer.

## Run locally

Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
```

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
