// ---------- State ----------
let STORE = null; // { profile, categories, products } loaded from data.json
let cart = JSON.parse(localStorage.getItem("annapurna_cart") || "{}"); // { productId: qty }
let activeCategory = "all";
let searchQuery = "";

const productGrid = document.getElementById("productGrid");
const tabsEl = document.getElementById("tabs");
const noResultsEl = document.getElementById("noResults");
const searchInput = document.getElementById("searchInput");

// ---------- Helpers ----------
function saveCart() {
  localStorage.setItem("annapurna_cart", JSON.stringify(cart));
}

function getProduct(id) {
  return STORE.products.find((p) => p.id === id);
}

function cartCountTotal() {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

function cartPriceTotal() {
  return Object.entries(cart).reduce((sum, [id, q]) => {
    const p = getProduct(id);
    return sum + (p ? p.price * q : 0);
  }, 0);
}

function formatPrice(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 1500);
}

// ---------- Profile ----------
function renderProfile() {
  const { storeName, tagline, ownerName, phone } = STORE.profile;
  document.title = `${storeName} — Order Groceries Online`;
  document.getElementById("storeName").textContent = storeName;
  document.getElementById("storeTagline").textContent = tagline;
  document.getElementById("footerStoreName").textContent = storeName;
  document.getElementById("footerOwnerName").textContent = ownerName;
  document.getElementById("footerPhone").textContent = phone;
}

// ---------- Tabs ----------
function renderTabs() {
  STORE.categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.category = cat.id;
    btn.textContent = `${cat.icon} ${cat.label}`;
    tabsEl.appendChild(btn);
  });

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.category;
    renderProducts();
  });
}

// ---------- Product grid ----------
function renderProducts() {
  productGrid.innerHTML = "";

  const q = searchQuery.trim().toLowerCase();
  let list = STORE.products.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch = !q || p.name.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  noResultsEl.classList.toggle("hidden", list.length > 0);

  if (activeCategory === "all" && !q) {
    // group by category with headings
    STORE.categories.forEach((cat) => {
      const items = STORE.products.filter((p) => p.category === cat.id);
      if (!items.length) return;
      const heading = document.createElement("div");
      heading.className = "category-heading";
      heading.textContent = `${cat.icon} ${cat.label}`;
      productGrid.appendChild(heading);
      items.forEach((p) => productGrid.appendChild(renderCard(p)));
    });
  } else {
    list.forEach((p) => productGrid.appendChild(renderCard(p)));
  }
}

function renderCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;

  const qty = cart[product.id] || 0;

  card.innerHTML = `
    <div class="product-image">
      ${product.image ? `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'product-icon-fallback',textContent:'${product.icon}'}))" />` : `<div class="product-icon-fallback">${product.icon}</div>`}
    </div>
    <p class="product-name">${product.name}</p>
    <p class="product-unit">${product.unit}</p>
    <p class="product-price">${formatPrice(product.price)}</p>
    <div class="card-action"></div>
  `;

  const actionEl = card.querySelector(".card-action");
  renderCardAction(actionEl, product.id, qty);

  return card;
}

function renderCardAction(container, productId, qty) {
  if (qty === 0) {
    container.innerHTML = `<button class="add-btn">Add to Cart</button>`;
    container.querySelector(".add-btn").addEventListener("click", () => {
      updateQty(productId, 1);
    });
  } else {
    container.innerHTML = `
      <div class="qty-control">
        <button class="dec">−</button>
        <span>${qty}</span>
        <button class="inc">+</button>
      </div>
    `;
    container.querySelector(".dec").addEventListener("click", () => updateQty(productId, -1));
    container.querySelector(".inc").addEventListener("click", () => updateQty(productId, 1));
  }
}

function updateQty(productId, delta) {
  const newQty = (cart[productId] || 0) + delta;
  if (newQty <= 0) {
    delete cart[productId];
  } else {
    cart[productId] = newQty;
  }
  saveCart();

  // update just the affected card in-place
  const card = productGrid.querySelector(`.product-card[data-id="${productId}"]`);
  if (card) {
    renderCardAction(card.querySelector(".card-action"), productId, cart[productId] || 0);
  }

  updateCartUI();
}

// ---------- Cart UI (badge, bar, drawer) ----------
function updateCartUI() {
  const count = cartCountTotal();
  const total = cartPriceTotal();

  document.getElementById("cartCount").textContent = count;

  const checkoutBar = document.getElementById("checkoutBar");
  checkoutBar.classList.toggle("hidden", count === 0);
  document.getElementById("checkoutBarCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
  document.getElementById("checkoutBarTotal").textContent = formatPrice(total);

  document.getElementById("cartTotal").textContent = formatPrice(total);

  renderCartItems();
}

function renderCartItems() {
  const cartItemsEl = document.getElementById("cartItems");
  const emptyMsg = document.getElementById("emptyCartMsg");
  const summary = document.getElementById("cartSummary");
  const form = document.getElementById("orderForm");

  const entries = Object.entries(cart);
  cartItemsEl.innerHTML = "";

  if (entries.length === 0) {
    emptyMsg.classList.remove("hidden");
    summary.classList.add("hidden");
    form.classList.add("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  summary.classList.remove("hidden");
  form.classList.remove("hidden");

  entries.forEach(([id, qty]) => {
    const p = getProduct(id);
    if (!p) return;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-image">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cart-item-icon',textContent:'${p.icon}'}))" />` : `<div class="cart-item-icon">${p.icon}</div>`}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${p.name}</p>
        <p class="cart-item-unit">${p.unit} · ${formatPrice(p.price)}</p>
        <div class="cart-item-price">${formatPrice(p.price * qty)}</div>
      </div>
      <div class="qty-control">
        <button class="dec">−</button>
        <span>${qty}</span>
        <button class="inc">+</button>
      </div>
      <button class="cart-item-remove" title="Remove">🗑️</button>
    `;
    row.querySelector(".dec").addEventListener("click", () => updateQty(id, -1));
    row.querySelector(".inc").addEventListener("click", () => updateQty(id, 1));
    row.querySelector(".cart-item-remove").addEventListener("click", () => {
      delete cart[id];
      saveCart();
      renderProducts();
      updateCartUI();
    });
    cartItemsEl.appendChild(row);
  });
}

// ---------- Drawer open/close ----------
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.remove("hidden");
}
function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.add("hidden");
}

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("checkoutBarBtn").addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

// ---------- Search ----------
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderProducts();
});

// ---------- WhatsApp order ----------
document.getElementById("orderForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();

  if (!name || !phone || !address || Object.keys(cart).length === 0) {
    showToast("Please fill all details and add items to cart.");
    return;
  }

  const lines = [];
  lines.push(`🛒 *New Order — ${STORE.profile.storeName}*`);
  lines.push("");
  Object.entries(cart).forEach(([id, qty]) => {
    const p = getProduct(id);
    if (!p) return;
    lines.push(`• ${p.name} (${p.unit}) x${qty} = ${formatPrice(p.price * qty)}`);
  });
  lines.push("");
  lines.push(`*Total: ${formatPrice(cartPriceTotal())}*`);
  lines.push("");
  lines.push(`*Customer Details*`);
  lines.push(`Name: ${name}`);
  lines.push(`Phone: ${phone}`);
  lines.push(`Address: ${address}`);

  const message = encodeURIComponent(lines.join("\n"));
  const url = `https://wa.me/${STORE.profile.whatsappNumber}?text=${message}`;
  window.open(url, "_blank");
});

// ---------- Init ----------
async function init() {
  const res = await fetch("data.json", { cache: "no-store" });
  STORE = await res.json();
  renderProfile();
  renderTabs();
  renderProducts();
  updateCartUI();
}

init();
