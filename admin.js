// ---------- Config ----------
// Default password is "annapurna123". To change it, compute a new SHA-256 hex hash
// (e.g. in a browser console: crypto.subtle.digest(...) or any sha256 tool) and replace the value below.
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
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = document.getElementById("loginPassword").value;
  const hash = await sha256Hex(pw);
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
