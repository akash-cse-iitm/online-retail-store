// ---------- Config ----------
// Default password is "annapurna123". To change it, compute a new SHA-256 hex hash
// (e.g. `python3 -c "import hashlib; print(hashlib.sha256(b'yourpassword').hexdigest())"`) and replace the value below.
const ADMIN_PASSWORD_HASH = "1bd087830866af7b6f1dc0f144d3e096eef4d9072219356716d430c6f3bca7c5";
const DATA_PATH = "data.json";

// ---------- State ----------
let storeData = null;
let currentSha = null;
let ghConfig = null; // { owner, repo, branch, token }

const loginPanel = document.getElementById("loginPanel");
const connectPanel = document.getElementById("connectPanel");
const editorPanel = document.getElementById("editorPanel");

// ---------- Password gate ----------
// Pure-JS SHA-256 (no Web Crypto dependency) so login works even without a
// secure context (crypto.subtle is unavailable on plain http:// / file://).
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

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = document.getElementById("loginPassword").value;
  const hash = sha256Hex(pw);
  if (hash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem("annapurna_admin_unlocked", "1");
    loginPanel.classList.add("hidden");
    showConnectOrEditor();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
});

function showConnectOrEditor() {
  const saved = localStorage.getItem("annapurna_gh_config");
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      document.getElementById("ghOwner").value = cfg.owner || "";
      document.getElementById("ghRepo").value = cfg.repo || "";
      document.getElementById("ghBranch").value = cfg.branch || "main";
    } catch (_) {}
  }
  connectPanel.classList.remove("hidden");
}

if (sessionStorage.getItem("annapurna_admin_unlocked") === "1") {
  loginPanel.classList.add("hidden");
  showConnectOrEditor();
}

// ---------- GitHub connect ----------
document.getElementById("connectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const owner = document.getElementById("ghOwner").value.trim();
  const repo = document.getElementById("ghRepo").value.trim();
  const branch = document.getElementById("ghBranch").value.trim() || "main";
  const token = document.getElementById("ghToken").value.trim();
  const remember = document.getElementById("ghRemember").checked;

  const errEl = document.getElementById("connectError");
  errEl.classList.add("hidden");

  ghConfig = { owner, repo, branch, token };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${DATA_PATH}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `GitHub error ${res.status}`);
    }
    const json = await res.json();
    currentSha = json.sha;
    const decoded = decodeURIComponent(escape(atob(json.content)));
    storeData = JSON.parse(decoded);

    if (remember) {
      localStorage.setItem("annapurna_gh_config", JSON.stringify({ owner, repo, branch }));
      localStorage.setItem("annapurna_gh_token", token);
    } else {
      localStorage.removeItem("annapurna_gh_config");
      localStorage.removeItem("annapurna_gh_token");
    }

    connectPanel.classList.add("hidden");
    editorPanel.classList.remove("hidden");
    populateEditor();
  } catch (err) {
    errEl.textContent = "Could not load data.json — " + err.message;
    errEl.classList.remove("hidden");
  }
});

// Auto-fill remembered token
const rememberedToken = localStorage.getItem("annapurna_gh_token");
if (rememberedToken) {
  document.getElementById("ghToken").value = rememberedToken;
}

document.getElementById("disconnectBtn").addEventListener("click", () => {
  sessionStorage.removeItem("annapurna_admin_unlocked");
  localStorage.removeItem("annapurna_gh_config");
  localStorage.removeItem("annapurna_gh_token");
  location.reload();
});

// ---------- Editor ----------
function populateEditor() {
  document.getElementById("fStoreName").value = storeData.profile.storeName;
  document.getElementById("fTagline").value = storeData.profile.tagline;
  document.getElementById("fOwnerName").value = storeData.profile.ownerName;
  document.getElementById("fPhone").value = storeData.profile.phone;
  document.getElementById("fWhatsapp").value = storeData.profile.whatsappNumber;

  renderProductRows();
}

function renderProductRows() {
  const container = document.getElementById("productsEditor");
  container.innerHTML = "";
  storeData.products.forEach((p) => container.appendChild(buildProductRow(p)));
  document.getElementById("productCount").textContent = storeData.products.length;
}

function buildProductRow(product) {
  const row = document.createElement("div");
  row.className = "product-row";
  row.dataset.id = product.id;

  const categoryOptions = storeData.categories
    .map((c) => `<option value="${c.id}" ${c.id === product.category ? "selected" : ""}>${c.label}</option>`)
    .join("");

  row.innerHTML = `
    <div class="row-thumb">
      ${product.image ? `<img src="${product.image}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'row-fallback-icon',textContent:'${product.icon || '📦'}'}))" />` : `<div class="row-fallback-icon">${product.icon || "📦"}</div>`}
    </div>
    <input type="text" class="f-name" value="${escapeAttr(product.name)}" placeholder="Product name" />
    <input type="text" class="f-unit" value="${escapeAttr(product.unit)}" placeholder="Unit (e.g. 1 kg)" />
    <input type="number" class="f-price" value="${product.price}" min="0" step="1" placeholder="Price" />
    <select class="f-category">${categoryOptions}</select>
    <input type="text" class="f-image" value="${escapeAttr(product.image || "")}" placeholder="Image URL" />
    <button type="button" class="row-remove" title="Remove product">🗑️</button>
  `;

  row.querySelector(".row-remove").addEventListener("click", () => {
    storeData.products = storeData.products.filter((p) => p.id !== product.id);
    renderProductRows();
  });

  const thumb = row.querySelector(".row-thumb");
  row.querySelector(".f-image").addEventListener("change", (e) => {
    const url = e.target.value.trim();
    thumb.innerHTML = url
      ? `<img src="${url}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'row-fallback-icon',textContent:'${product.icon || '📦'}'}))" />`
      : `<div class="row-fallback-icon">${product.icon || "📦"}</div>`;
  });

  return row;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

document.getElementById("addProductBtn").addEventListener("click", () => {
  const id = "p_" + Date.now().toString(36);
  storeData.products.push({
    id,
    category: storeData.categories[0]?.id || "",
    name: "New Product",
    unit: "1 pc",
    price: 0,
    icon: "📦",
    image: "",
  });
  renderProductRows();
});

// ---------- Save (collect + commit) ----------
function collectFormIntoStoreData() {
  storeData.profile.storeName = document.getElementById("fStoreName").value.trim();
  storeData.profile.tagline = document.getElementById("fTagline").value.trim();
  storeData.profile.ownerName = document.getElementById("fOwnerName").value.trim();
  storeData.profile.phone = document.getElementById("fPhone").value.trim();
  storeData.profile.whatsappNumber = document.getElementById("fWhatsapp").value.trim();

  document.querySelectorAll("#productsEditor .product-row").forEach((row) => {
    const id = row.dataset.id;
    const product = storeData.products.find((p) => p.id === id);
    if (!product) return;
    product.name = row.querySelector(".f-name").value.trim();
    product.unit = row.querySelector(".f-unit").value.trim();
    product.price = Number(row.querySelector(".f-price").value) || 0;
    product.category = row.querySelector(".f-category").value;
    product.image = row.querySelector(".f-image").value.trim();
  });
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  collectFormIntoStoreData();

  const statusEl = document.getElementById("saveStatus");
  statusEl.textContent = "Saving…";
  statusEl.className = "save-status";

  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(storeData, null, 2))));
    const res = await fetch(
      `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${DATA_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ghConfig.token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: "Update store data via admin panel",
          content,
          sha: currentSha,
          branch: ghConfig.branch,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `GitHub error ${res.status}`);
    }
    const json = await res.json();
    currentSha = json.content.sha;
    statusEl.textContent = "Saved! Live on the site in about a minute.";
    statusEl.className = "save-status success";
  } catch (err) {
    statusEl.textContent = "Save failed — " + err.message;
    statusEl.className = "save-status error";
  }
});
