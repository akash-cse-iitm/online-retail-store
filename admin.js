// ---------- Config ----------
const DATA_PATH = "data.json";
const CONFIG_PATH = "admin-config.json";
const IMAGES_DIR = "images";

// ---------- State ----------
let storeData = null;
let adminConfig = null; // { passwordHash }
let shas = { data: null, config: null };
let ghConfig = null; // { owner, repo, branch, token }
let dirty = false;

const $ = (id) => document.getElementById(id);

const loginPanel = $("loginPanel");
const connectPanel = $("connectPanel");
const editorPanel = $("editorPanel");

function markDirty() {
  dirty = true;
}

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------- Pure-JS SHA-256 (no crypto.subtle dependency) ----------
// Works over plain http:// / file:// too, since crypto.subtle needs a secure context.
function sha256Hex(str) {
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

  const bytes = new TextEncoder().encode(str);
  const bitLen = bytes.length * 8;
  const withOne = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 4, bitLen >>> 0);
  dv.setUint32(withOne.length - 8, Math.floor(bitLen / 4294967296));

  const w = new Uint32Array(64);
  for (let offset = 0; offset < withOne.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [H[0]+a, H[1]+b, H[2]+c, H[3]+d, H[4]+e, H[5]+f, H[6]+g, H[7]+h].map((x) => x | 0);
  }

  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

// ---------- Unicode-safe base64 ----------
function b64Encode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode("0x" + p1)));
}
function b64Decode(str) {
  return decodeURIComponent(atob(str).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function slugify(str) {
  const s = String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return s || "file";
}

// ---------- Admin config (public read, for the login screen) ----------
async function loadAdminConfig() {
  try {
    const res = await fetch(CONFIG_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error("missing");
    adminConfig = await res.json();
  } catch (err) {
    console.warn("Could not load admin-config.json — falling back to built-in default password.", err);
    adminConfig = {
      passwordHash: "3700adf1f25fab8202c1343c4b0b4e3fec706d57cad574086467b8b3ddf273ec", // default: password12345
    };
  }
}

(async function initAuth() {
  await loadAdminConfig();
  const btn = $("loginSubmitBtn");
  btn.disabled = false;
  btn.textContent = "Unlock";
  if (sessionStorage.getItem("annapurna_admin_unlocked") === "1") {
    loginPanel.classList.add("hidden");
    showConnectOrEditor();
  }
})();

// ---------- Password gate ----------
$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = $("loginPassword").value;
  const errEl = $("loginError");
  errEl.classList.add("hidden");

  const hash = sha256Hex(pw);

  if (hash === adminConfig.passwordHash) {
    sessionStorage.setItem("annapurna_admin_unlocked", "1");
    loginPanel.classList.add("hidden");
    showConnectOrEditor();
  } else {
    errEl.textContent = "Incorrect password.";
    errEl.classList.remove("hidden");
  }
});

function showConnectOrEditor() {
  const saved = localStorage.getItem("annapurna_gh_config");
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      $("ghOwner").value = cfg.owner || "";
      $("ghRepo").value = cfg.repo || "";
      $("ghBranch").value = cfg.branch || "main";
    } catch (_) {}
  }
  const rememberedToken = localStorage.getItem("annapurna_gh_token");
  if (rememberedToken) $("ghToken").value = rememberedToken;
  connectPanel.classList.remove("hidden");
}

$("disconnectBtn").addEventListener("click", () => {
  if (dirty && !confirm("You have unsaved changes. Disconnect anyway?")) return;
  sessionStorage.removeItem("annapurna_admin_unlocked");
  localStorage.removeItem("annapurna_gh_config");
  localStorage.removeItem("annapurna_gh_token");
  location.reload();
});

// ---------- GitHub API helpers ----------
async function ghGet(path) {
  const res = await fetch(
    `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${path}?ref=${encodeURIComponent(ghConfig.branch)}`,
    { headers: { Authorization: `Bearer ${ghConfig.token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub error ${res.status}`);
  }
  return res.json();
}

async function ghPut(path, { content, sha, message }) {
  const body = { message, content, branch: ghConfig.branch };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${path}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${ghConfig.token}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const body2 = await res.json().catch(() => ({}));
    throw new Error(body2.message || `GitHub error ${res.status}`);
  }
  return res.json();
}

// ---------- GitHub connect ----------
$("connectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const owner = $("ghOwner").value.trim();
  const repo = $("ghRepo").value.trim();
  const branch = $("ghBranch").value.trim() || "main";
  const token = $("ghToken").value.trim();
  const remember = $("ghRemember").checked;

  const errEl = $("connectError");
  errEl.classList.add("hidden");
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Connecting…";

  ghConfig = { owner, repo, branch, token };

  try {
    const dataFile = await ghGet(DATA_PATH);
    shas.data = dataFile.sha;
    storeData = JSON.parse(b64Decode(dataFile.content));
    storeData.categories = storeData.categories || [];
    storeData.products = storeData.products || [];
    storeData.profile = storeData.profile || {};

    try {
      const cfgFile = await ghGet(CONFIG_PATH);
      shas.config = cfgFile.sha;
      adminConfig = JSON.parse(b64Decode(cfgFile.content));
    } catch (_) {
      shas.config = null; // doesn't exist in the repo yet — will be created on first Account save
    }

    if (remember) {
      localStorage.setItem("annapurna_gh_config", JSON.stringify({ owner, repo, branch }));
      localStorage.setItem("annapurna_gh_token", token);
    } else {
      localStorage.removeItem("annapurna_gh_config");
      localStorage.removeItem("annapurna_gh_token");
    }

    connectPanel.classList.add("hidden");
    editorPanel.classList.remove("hidden");
    dirty = false;
    populateEditor();
  } catch (err) {
    errEl.textContent = "Could not load data.json — " + err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Load Store Data";
  }
});

// ---------- Tabs ----------
document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-panel").forEach((t) => t.classList.add("hidden"));
    btn.classList.add("active");
    $(`tab-${btn.dataset.tab}`).classList.remove("hidden");
  });
});

// ---------- Image upload (compress client-side, commit straight to the repo) ----------
function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image file.")); };
    img.src = url;
  });
}

async function compressImage(file, { maxDim = 1000, mimeType = "image/jpeg", maxBytes = 900000 } = {}) {
  const { img, url } = await readFileAsImage(file);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL(mimeType, quality);
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.3) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL(mimeType, quality);
  }
  if (dataUrl.length * 0.75 > maxBytes) {
    throw new Error("Image is too large even after compression — try a smaller photo.");
  }
  const base64 = dataUrl.split(",")[1];
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return { base64, ext };
}

async function uploadImageToRepo(file, nameHint, opts = {}) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const mimeType = opts.mimeType || (file.type === "image/png" ? "image/png" : "image/jpeg");
  const { base64, ext } = await compressImage(file, { mimeType });
  const filename = `${slugify(nameHint)}-${Date.now().toString(36)}.${ext}`;
  const path = `${IMAGES_DIR}/${filename}`;
  await ghPut(path, { content: base64, message: `Upload image via admin panel: ${filename}` });
  return path;
}

// ---------- Editor: populate ----------
function populateEditor() {
  const p = storeData.profile;
  $("fStoreName").value = p.storeName || "";
  $("fTagline").value = p.tagline || "";
  $("fOwnerName").value = p.ownerName || "";
  $("fPhone").value = p.phone || "";
  $("fWhatsapp").value = p.whatsappNumber || "";
  $("fAddress").value = p.address || "";
  $("fDeliveryNote").value = p.deliveryNote || "";
  $("fPaymentNote").value = p.paymentNote || "Cash on Delivery — pay when your order arrives";
  $("fIsOpen").checked = p.isOpen !== false;
  if (p.logo) {
    $("logoPreview").src = p.logo;
    $("logoPreview").classList.remove("hidden");
  } else {
    $("logoPreview").classList.add("hidden");
  }

  wireProfileFormOnce();
  renderCategoryRows();
  renderProductRows();
}

let profileWired = false;
function wireProfileFormOnce() {
  if (profileWired) return;
  profileWired = true;

  const textMap = {
    fStoreName: "storeName",
    fTagline: "tagline",
    fOwnerName: "ownerName",
    fPhone: "phone",
    fAddress: "address",
    fDeliveryNote: "deliveryNote",
    fPaymentNote: "paymentNote",
  };
  Object.entries(textMap).forEach(([elId, key]) => {
    $(elId).addEventListener("input", (e) => {
      storeData.profile[key] = e.target.value;
      markDirty();
    });
  });

  $("fWhatsapp").addEventListener("input", (e) => {
    storeData.profile.whatsappNumber = e.target.value.replace(/[^0-9]/g, "");
    markDirty();
  });

  $("fIsOpen").addEventListener("change", (e) => {
    storeData.profile.isOpen = e.target.checked;
    markDirty();
  });

  $("fLogoFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = $("logoUploadStatus");
    statusEl.textContent = "Uploading…";
    statusEl.className = "upload-status uploading";
    try {
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const path = await uploadImageToRepo(file, "logo", { mimeType });
      storeData.profile.logo = path;
      $("logoPreview").src = path;
      $("logoPreview").classList.remove("hidden");
      statusEl.textContent = "Uploaded ✓";
      statusEl.className = "upload-status success";
      markDirty();
    } catch (err) {
      statusEl.textContent = "Failed — " + err.message;
      statusEl.className = "upload-status error";
    } finally {
      e.target.value = "";
    }
  });

  $("accountForm").addEventListener("submit", saveAccountSettings);
}

// ---------- Categories ----------
function renderCategoryRows() {
  const container = $("categoriesEditor");
  container.innerHTML = "";
  storeData.categories.forEach((cat, idx) => {
    const count = storeData.products.filter((p) => p.category === cat.id).length;
    const row = document.createElement("div");
    row.className = "category-row";
    row.dataset.id = cat.id;
    row.innerHTML = `
      <input type="text" class="c-icon" value="${escapeHtml(cat.icon || "")}" maxlength="4" placeholder="🛒" />
      <input type="text" class="c-label" value="${escapeHtml(cat.label)}" placeholder="Category name" />
      <span class="category-count">${count} item${count === 1 ? "" : "s"}</span>
      <div class="category-actions">
        <button type="button" class="icon-btn cat-up" title="Move up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="icon-btn cat-down" title="Move down" ${idx === storeData.categories.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="icon-btn cat-remove" title="Delete category">🗑️</button>
      </div>
    `;
    row.querySelector(".c-icon").addEventListener("input", (e) => { cat.icon = e.target.value; markDirty(); });
    row.querySelector(".c-label").addEventListener("input", (e) => { cat.label = e.target.value; markDirty(); });
    row.querySelector(".cat-up").addEventListener("click", () => moveCategory(idx, -1));
    row.querySelector(".cat-down").addEventListener("click", () => moveCategory(idx, 1));
    row.querySelector(".cat-remove").addEventListener("click", () => removeCategory(cat.id, count));
    container.appendChild(row);
  });
}

function moveCategory(idx, dir) {
  const arr = storeData.categories;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  markDirty();
  renderCategoryRows();
}

function ensureUncategorized() {
  if (!storeData.categories.find((c) => c.id === "uncategorized")) {
    storeData.categories.push({ id: "uncategorized", label: "Uncategorized", icon: "🗂️" });
  }
}

function removeCategory(id, count) {
  if (storeData.categories.length === 1) {
    alert("You need at least one category.");
    return;
  }
  if (count > 0) {
    const ok = confirm(`${count} product(s) use this category. They'll be moved to "Uncategorized". Continue?`);
    if (!ok) return;
    ensureUncategorized();
    storeData.products.forEach((p) => {
      if (p.category === id) p.category = "uncategorized";
    });
  }
  storeData.categories = storeData.categories.filter((c) => c.id !== id);
  markDirty();
  renderCategoryRows();
  renderProductRows();
}

$("addCategoryBtn").addEventListener("click", () => {
  const id = "cat_" + Date.now().toString(36);
  storeData.categories.push({ id, label: "New Category", icon: "🏷️" });
  markDirty();
  renderCategoryRows();
  renderProductRows();
  requestAnimationFrame(() => {
    const row = document.querySelector(`.category-row[data-id="${id}"] .c-label`);
    if (row) { row.focus(); row.select(); }
  });
});

// ---------- Products ----------
function badgePreviewText(product) {
  if (product.badge) return product.badge;
  if (product.originalPrice && Number(product.originalPrice) > Number(product.price)) {
    const pct = Math.round((1 - product.price / product.originalPrice) * 100);
    return pct > 0 ? `${pct}% OFF badge` : "No badge";
  }
  return "No badge (set MRP or a custom badge)";
}

function thumbHtml(product) {
  if (product.image) return `<img src="${escapeHtml(product.image)}" alt="" />`;
  return `<div class="thumb-fallback">${escapeHtml(product.icon || "📦")}</div>`;
}

function wireThumbFallback(thumbEl, product) {
  const img = thumbEl.querySelector("img");
  if (img) {
    img.addEventListener("error", () => {
      thumbEl.innerHTML = `<div class="thumb-fallback">${escapeHtml(product.icon || "📦")}</div>`;
    }, { once: true });
  }
}

function categoryOptionsHtml(selected) {
  return storeData.categories
    .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === selected ? "selected" : ""}>${escapeHtml(c.icon || "")} ${escapeHtml(c.label)}</option>`)
    .join("");
}

function buildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card-admin" + (product.inStock === false ? " is-oos" : "");
  card.dataset.id = product.id;
  card.dataset.name = (product.name || "").toLowerCase();

  card.innerHTML = `
    <div class="pc-thumb" data-thumb>${thumbHtml(product)}</div>
    <div class="pc-fields">
      <div class="pc-row">
        <label class="pc-field pc-field-name"><span>Product name</span>
          <input type="text" class="f-name" value="${escapeHtml(product.name)}" placeholder="Product name" />
        </label>
        <label class="pc-field"><span>Category</span>
          <select class="f-category">${categoryOptionsHtml(product.category)}</select>
        </label>
      </div>
      <div class="pc-row pc-row-3">
        <label class="pc-field"><span>Unit</span>
          <input type="text" class="f-unit" value="${escapeHtml(product.unit || "")}" placeholder="e.g. 1 kg" />
        </label>
        <label class="pc-field"><span>Selling price ₹</span>
          <input type="number" class="f-price" value="${product.price}" min="0" step="1" />
        </label>
        <label class="pc-field"><span>MRP ₹ <em>(optional)</em></span>
          <input type="number" class="f-original-price" value="${product.originalPrice || ""}" min="0" step="1" />
        </label>
      </div>
      <div class="pc-row pc-row-3">
        <label class="pc-field"><span>Custom badge</span>
          <input type="text" class="f-badge" value="${escapeHtml(product.badge || "")}" placeholder="e.g. Bestseller" />
        </label>
        <label class="pc-field"><span>Fallback emoji</span>
          <input type="text" class="f-icon" value="${escapeHtml(product.icon || "")}" placeholder="📦" maxlength="4" />
        </label>
        <label class="stock-toggle">
          <input type="checkbox" class="f-in-stock" ${product.inStock === false ? "" : "checked"} />
          <span>In stock</span>
        </label>
      </div>
      <span class="badge-preview" data-badge-preview>${badgePreviewText(product)}</span>
      <label class="pc-field"><span>Description</span>
        <textarea class="f-description" placeholder="Short description shown on the card" rows="2">${escapeHtml(product.description || "")}</textarea>
      </label>
      <div class="pc-row pc-image-row">
        <label class="pc-field pc-field-name"><span>Image</span>
          <input type="text" class="f-image" value="${escapeHtml(product.image || "")}" placeholder="Paste an image URL, or upload →" />
        </label>
        <label class="admin-btn ghost small upload-btn-label">
          Upload
          <input type="file" accept="image/*" class="f-image-file hidden" />
        </label>
        <span class="upload-status" data-upload-status></span>
      </div>
    </div>
    <div class="pc-actions">
      <button type="button" class="icon-btn dup-btn" title="Duplicate product">⧉</button>
      <button type="button" class="icon-btn remove-btn" title="Delete product">🗑️</button>
    </div>
  `;
  wireProductCard(card, product);
  return card;
}

function wireProductCard(card, product) {
  const thumbEl = card.querySelector("[data-thumb]");
  wireThumbFallback(thumbEl, product);

  const badgePreviewEl = card.querySelector("[data-badge-preview]");
  const updateBadgePreview = () => { badgePreviewEl.textContent = badgePreviewText(product); };

  card.querySelector(".f-name").addEventListener("input", (e) => {
    product.name = e.target.value;
    card.dataset.name = e.target.value.toLowerCase();
    markDirty();
  });
  card.querySelector(".f-category").addEventListener("change", (e) => {
    product.category = e.target.value;
    markDirty();
  });
  card.querySelector(".f-unit").addEventListener("input", (e) => { product.unit = e.target.value; markDirty(); });
  card.querySelector(".f-price").addEventListener("input", (e) => {
    product.price = Number(e.target.value) || 0;
    updateBadgePreview();
    markDirty();
  });
  card.querySelector(".f-original-price").addEventListener("input", (e) => {
    const v = e.target.value.trim();
    if (v && Number(v) > 0) product.originalPrice = Number(v);
    else delete product.originalPrice;
    updateBadgePreview();
    markDirty();
  });
  card.querySelector(".f-badge").addEventListener("input", (e) => {
    product.badge = e.target.value.trim();
    updateBadgePreview();
    markDirty();
  });
  card.querySelector(".f-icon").addEventListener("input", (e) => { product.icon = e.target.value.trim(); markDirty(); });
  card.querySelector(".f-in-stock").addEventListener("change", (e) => {
    // Only persist the flag when it's false; absent means in stock.
    if (e.target.checked) delete product.inStock;
    else product.inStock = false;
    card.classList.toggle("is-oos", !e.target.checked);
    markDirty();
  });
  card.querySelector(".f-description").addEventListener("input", (e) => { product.description = e.target.value; markDirty(); });
  card.querySelector(".f-image").addEventListener("change", (e) => {
    product.image = e.target.value.trim();
    thumbEl.innerHTML = thumbHtml(product);
    wireThumbFallback(thumbEl, product);
    markDirty();
  });

  card.querySelector(".f-image-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = card.querySelector("[data-upload-status]");
    statusEl.textContent = "Uploading…";
    statusEl.className = "upload-status uploading";
    try {
      const path = await uploadImageToRepo(file, product.name || "product");
      product.image = path;
      card.querySelector(".f-image").value = path;
      thumbEl.innerHTML = thumbHtml(product);
      wireThumbFallback(thumbEl, product);
      statusEl.textContent = "Uploaded ✓";
      statusEl.className = "upload-status success";
      markDirty();
    } catch (err) {
      statusEl.textContent = "Failed — " + err.message;
      statusEl.className = "upload-status error";
    } finally {
      e.target.value = "";
    }
  });

  card.querySelector(".dup-btn").addEventListener("click", () => duplicateProduct(product.id));
  card.querySelector(".remove-btn").addEventListener("click", () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    storeData.products = storeData.products.filter((p) => p.id !== product.id);
    markDirty();
    renderProductRows();
  });
}

function duplicateProduct(id) {
  const p = storeData.products.find((x) => x.id === id);
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = "p_" + Date.now().toString(36);
  copy.name = p.name + " (Copy)";
  const idx = storeData.products.indexOf(p);
  storeData.products.splice(idx + 1, 0, copy);
  markDirty();
  renderProductRows();
}

function renderProductRows() {
  const container = $("productsEditor");
  container.innerHTML = "";
  storeData.products.forEach((p) => container.appendChild(buildProductCard(p)));
  $("productCount").textContent = storeData.products.length;
  applyProductSearch();
}

function applyProductSearch() {
  const q = $("productSearch").value.trim().toLowerCase();
  document.querySelectorAll("#productsEditor .product-card-admin").forEach((card) => {
    card.classList.toggle("hidden", !!q && !card.dataset.name.includes(q));
  });
}
$("productSearch").addEventListener("input", applyProductSearch);

$("addProductBtn").addEventListener("click", () => {
  const id = "p_" + Date.now().toString(36);
  const newProduct = {
    id,
    category: storeData.categories[0]?.id || "uncategorized",
    name: "New Product",
    unit: "1 pc",
    price: 0,
    icon: "📦",
    image: "",
  };
  if (newProduct.category === "uncategorized") ensureUncategorized();
  storeData.products.unshift(newProduct);
  markDirty();
  renderProductRows();
  document.querySelector('.admin-tab-btn[data-tab="products"]').click();
  requestAnimationFrame(() => {
    const card = document.querySelector(`.product-card-admin[data-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      const nameInput = card.querySelector(".f-name");
      nameInput.focus();
      nameInput.select();
    }
  });
});

// ---------- Validation ----------
function validateStoreData() {
  const errors = [];
  if (!storeData.profile.storeName?.trim()) errors.push("Store name is required.");

  const wa = String(storeData.profile.whatsappNumber || "").replace(/[^0-9]/g, "");
  if (!/^\d{10,15}$/.test(wa)) errors.push("WhatsApp number must be 10-15 digits including country code (e.g. 919876543210).");
  storeData.profile.whatsappNumber = wa;

  if (!storeData.categories.length) errors.push("At least one category is required.");
  storeData.categories.forEach((c, i) => {
    if (!c.label?.trim()) errors.push(`Category #${i + 1} needs a name.`);
  });

  storeData.products.forEach((p, i) => {
    const label = p.name?.trim() || `Product #${i + 1}`;
    if (!p.name?.trim()) errors.push(`Product #${i + 1} needs a name.`);
    if (p.price == null || Number(p.price) < 0) errors.push(`"${label}" needs a valid price.`);
  });

  return errors;
}

// ---------- Save & Publish ----------
$("saveBtn").addEventListener("click", async () => {
  const errors = validateStoreData();
  if (errors.length) {
    alert("Please fix the following before saving:\n\n" + errors.join("\n"));
    return;
  }

  const statusEl = $("saveStatus");
  const btn = $("saveBtn");
  statusEl.textContent = "Saving…";
  statusEl.className = "save-status";
  btn.disabled = true;

  try {
    const content = b64Encode(JSON.stringify(storeData, null, 2));
    const json = await ghPut(DATA_PATH, { content, sha: shas.data, message: "Update store data via admin panel" });
    shas.data = json.content.sha;
    dirty = false;
    statusEl.textContent = "Saved! Live on the site in about a minute.";
    statusEl.className = "save-status success";
    renderCategoryRows(); // refresh product counts per category
  } catch (err) {
    statusEl.textContent = "Save failed — " + err.message;
    statusEl.className = "save-status error";
  } finally {
    btn.disabled = false;
  }
});

// ---------- Account settings ----------
async function saveAccountSettings(e) {
  e.preventDefault();
  const statusEl = $("accountStatus");
  const pw = $("accPassword").value;
  const pwConfirm = $("accPasswordConfirm").value;

  if (!pw || pw.length < 6) { statusEl.textContent = "Password must be at least 6 characters."; statusEl.className = "save-status error"; return; }
  if (pw !== pwConfirm) { statusEl.textContent = "Passwords do not match."; statusEl.className = "save-status error"; return; }

  const newConfig = { passwordHash: sha256Hex(pw) };

  statusEl.textContent = "Saving…";
  statusEl.className = "save-status";
  $("accountSaveBtn").disabled = true;

  try {
    const content = b64Encode(JSON.stringify(newConfig, null, 2));
    const json = await ghPut(CONFIG_PATH, { content, sha: shas.config, message: "Update admin password via admin panel" });
    shas.config = json.content.sha;
    adminConfig = newConfig;
    $("accPassword").value = "";
    $("accPasswordConfirm").value = "";
    statusEl.textContent = "Password updated — use it next time you log in.";
    statusEl.className = "save-status success";
  } catch (err) {
    statusEl.textContent = "Update failed — " + err.message;
    statusEl.className = "save-status error";
  } finally {
    $("accountSaveBtn").disabled = false;
  }
}
