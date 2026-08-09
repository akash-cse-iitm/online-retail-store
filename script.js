// ---------- State ----------
let STORE = null; // { profile, categories, products } loaded from data.json
let cart = JSON.parse(localStorage.getItem("annapurna_cart") || "{}"); // { productId: qty }
let searchQuery = "";

const productGrid = document.getElementById("productGrid");
const noResultsEl = document.getElementById("noResults");
const searchInput = document.getElementById("searchInput");

// ---------- Helpers ----------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function digitsOnly(str) {
  return String(str || "").replace(/[^0-9]/g, "");
}

function saveCart() {
  localStorage.setItem("annapurna_cart", JSON.stringify(cart));
}

function getProduct(id) {
  return STORE.products.find((p) => p.id === id);
}

// Drop cart entries for products the admin has since deleted or marked out of
// stock, so the cart badge/total never silently drift from what's actually
// orderable. Returns how many entries were dropped for stock reasons.
function pruneCart() {
  let changed = false;
  let removedOos = 0;
  Object.keys(cart).forEach((id) => {
    const p = getProduct(id);
    if (!p) {
      delete cart[id];
      changed = true;
    } else if (p.inStock === false) {
      delete cart[id];
      changed = true;
      removedOos++;
    }
  });
  if (changed) saveCart();
  return removedOos;
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
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2000);
}

// Build an <img> with a safe JS-driven fallback to the emoji icon
// (avoids fragile inline onerror="..." string-building that breaks if
// a name/icon ever contains a quote character).
function buildMediaEl(product, className) {
  const wrap = document.createElement("div");
  wrap.className = className;
  if (product.image) {
    const img = document.createElement("img");
    img.src = product.image;
    img.alt = product.name || "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      wrap.innerHTML = "";
      const fallback = document.createElement("div");
      fallback.className = className.includes("cart-item") ? "cart-item-icon" : "product-icon-fallback";
      fallback.textContent = product.icon || "📦";
      wrap.appendChild(fallback);
    }, { once: true });
    wrap.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = className.includes("cart-item") ? "cart-item-icon" : "product-icon-fallback";
    fallback.textContent = product.icon || "📦";
    wrap.appendChild(fallback);
  }
  return wrap;
}

function badgeText(product) {
  if (product.badge) return product.badge;
  if (product.originalPrice && Number(product.originalPrice) > Number(product.price)) {
    const pct = product.discountPercent || Math.round((1 - product.price / product.originalPrice) * 100);
    if (pct > 0) return `${pct}% OFF`;
  }
  return "";
}

// ---------- Loading / error states ----------
function setLoadingState(state) {
  const loadingEl = document.getElementById("catalogLoading");
  const errorEl = document.getElementById("catalogError");
  loadingEl.classList.toggle("hidden", state !== "loading");
  errorEl.classList.toggle("hidden", state !== "error");
  productGrid.classList.toggle("hidden", state !== "ready");
}

// ---------- Profile ----------
function renderProfile() {
  const p = STORE.profile || {};
  const storeName = p.storeName || "Our Store";
  document.title = `${storeName} — Order Groceries Online`;
  document.getElementById("storeName").textContent = storeName;
  document.getElementById("heroStoreName").textContent = storeName;
  document.getElementById("heroTagline").textContent = p.tagline || "";
  document.getElementById("storeTagline").textContent = p.tagline || "";
  document.getElementById("footerStoreName").textContent = storeName;
  document.getElementById("footerOwnerName").textContent = p.ownerName || "";
  document.getElementById("footerPhone").textContent = p.phone || "";

  const addressEl = document.getElementById("footerAddress");
  if (p.address) {
    addressEl.textContent = p.address;
    addressEl.classList.remove("hidden");
  } else {
    addressEl.classList.add("hidden");
  }

  const deliveryEl = document.getElementById("footerDelivery");
  if (p.deliveryNote) {
    deliveryEl.textContent = p.deliveryNote;
    deliveryEl.classList.remove("hidden");
  } else {
    deliveryEl.classList.add("hidden");
  }

  // The hero eyebrow surfaces the shop's own delivery promise rather than
  // repeating the generic trust chips below it.
  const eyebrowEl = document.getElementById("heroEyebrow");
  if (p.deliveryNote) {
    eyebrowEl.textContent = `🛵 ${p.deliveryNote}`;
    eyebrowEl.classList.remove("hidden");
  } else {
    eyebrowEl.classList.add("hidden");
  }

  const paymentEl = document.getElementById("footerPayment");
  paymentEl.textContent = p.paymentNote || "Order online, pay on delivery. No card or online payment needed.";

  const wa = digitsOnly(p.whatsappNumber);
  const waLink = document.getElementById("whatsappQuickLink");
  waLink.href = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${storeName}, I'd like to know more about your products.`)}`
    : "#";

  // Logo swap: use uploaded logo image if set, otherwise keep the emoji icon.
  const brandIcon = document.getElementById("brandIcon");
  if (p.logo) {
    brandIcon.innerHTML = "";
    const img = document.createElement("img");
    img.src = p.logo;
    img.alt = storeName;
    img.className = "brand-logo-img";
    img.addEventListener("error", () => { brandIcon.textContent = "🛒"; }, { once: true });
    brandIcon.appendChild(img);
  }

  const closedBanner = document.getElementById("closedBanner");
  closedBanner.classList.toggle("hidden", p.isOpen !== false);
}

// ---------- Category nav (desktop dropdown + mobile chip bar) ----------
function categoriesWithProducts() {
  return STORE.categories.filter((cat) => STORE.products.some((p) => p.category === cat.id));
}

function scrollToCategory(catId) {
  const target = document.getElementById(`cat-${catId}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderShopDropdown() {
  const menu = document.getElementById("shopDropdownMenu");
  menu.innerHTML = "";
  categoriesWithProducts().forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${cat.icon || ""} ${cat.label}`.trim();
    btn.addEventListener("click", () => {
      dropdown.classList.remove("open");
      scrollToCategory(cat.id);
    });
    menu.appendChild(btn);
  });

  const dropdown = document.querySelector(".nav-dropdown");
  const dropdownBtn = document.getElementById("shopDropdownBtn");

  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) dropdown.classList.remove("open");
  });
}

function renderCategoryChips() {
  const wrap = document.getElementById("categoryChips");
  wrap.innerHTML = "";
  categoriesWithProducts().forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip";
    chip.textContent = `${cat.icon || ""} ${cat.label}`.trim();
    chip.addEventListener("click", () => scrollToCategory(cat.id));
    wrap.appendChild(chip);
  });
}

function renderSiteMenuCategories() {
  const wrap = document.getElementById("siteMenuCategories");
  wrap.innerHTML = "";
  categoriesWithProducts().forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "site-menu-link site-menu-category";
    btn.textContent = `${cat.icon || ""} ${cat.label}`.trim();
    btn.addEventListener("click", () => {
      closeMenu();
      scrollToCategory(cat.id);
    });
    wrap.appendChild(btn);
  });
}

// ---------- Search ----------
// The search field now lives in the hero, so the header icon scrolls up to it
// and focuses it rather than toggling a second, duplicate input.
function initSearchToggle() {
  document.getElementById("searchToggleBtn").addEventListener("click", () => {
    document.querySelector(".hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => searchInput.focus({ preventScroll: true }), 350);
  });
}

// ---------- Product grid ----------
function renderProducts() {
  productGrid.innerHTML = "";

  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (p) =>
    !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);

  if (!q) {
    // Group by category, in admin-defined order. Any product whose category
    // was deleted/renamed still needs a home so it never silently disappears.
    const knownIds = new Set();
    STORE.categories.forEach((cat) => {
      const items = STORE.products.filter((p) => p.category === cat.id);
      knownIds.add(cat.id);
      if (!items.length) return;
      appendCategorySection(cat.id, cat.label, items);
    });
    const orphaned = STORE.products.filter((p) => !knownIds.has(p.category));
    if (orphaned.length) appendCategorySection("other", "Other", orphaned);

    noResultsEl.classList.toggle("hidden", STORE.products.length > 0);
  } else {
    const list = STORE.products.filter(matchesSearch);
    list.forEach((p) => productGrid.appendChild(renderCard(p)));
    noResultsEl.classList.toggle("hidden", list.length > 0);
  }
}

function appendCategorySection(id, label, items) {
  const heading = document.createElement("div");
  heading.className = "category-heading";
  heading.id = `cat-${id}`;
  heading.textContent = label;
  productGrid.appendChild(heading);
  items.forEach((p) => productGrid.appendChild(renderCard(p)));
}

function isOutOfStock(product) {
  return product.inStock === false;
}

function renderCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;

  const qty = cart[product.id] || 0;
  const hasStrike = product.originalPrice && Number(product.originalPrice) > Number(product.price);
  const badge = badgeText(product);
  const oos = isOutOfStock(product);
  if (oos) card.classList.add("is-out-of-stock");

  const media = buildMediaEl(product, "product-image");
  if (oos) {
    const oosEl = document.createElement("span");
    oosEl.className = "stock-badge";
    oosEl.textContent = "Out of Stock";
    media.appendChild(oosEl);
  } else if (badge) {
    const badgeEl = document.createElement("span");
    badgeEl.className = "discount-badge";
    badgeEl.textContent = badge;
    media.appendChild(badgeEl);
  }
  card.appendChild(media);

  const nameEl = document.createElement("p");
  nameEl.className = "product-name";
  nameEl.textContent = product.name;
  if (product.unit) {
    const unitEl = document.createElement("span");
    unitEl.className = "product-unit-inline";
    unitEl.textContent = ` (${product.unit})`;
    nameEl.appendChild(unitEl);
  }
  card.appendChild(nameEl);

  const priceRow = document.createElement("div");
  priceRow.className = "price-row";
  const priceNow = document.createElement("span");
  priceNow.className = "price-now";
  priceNow.textContent = formatPrice(product.price);
  priceRow.appendChild(priceNow);
  if (hasStrike) {
    const priceWas = document.createElement("span");
    priceWas.className = "price-was";
    priceWas.textContent = formatPrice(product.originalPrice);
    priceRow.appendChild(priceWas);
  }
  card.appendChild(priceRow);

  if (product.description) {
    const desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = product.description;
    card.appendChild(desc);
  }

  const actionEl = document.createElement("div");
  actionEl.className = "card-action";
  card.appendChild(actionEl);
  renderCardAction(actionEl, product.id, qty);

  return card;
}

function renderCardAction(container, productId, qty) {
  const product = getProduct(productId);
  if (product && isOutOfStock(product)) {
    container.innerHTML = `<span class="oos-note">Currently unavailable</span>`;
    return;
  }
  if (qty === 0) {
    container.innerHTML = `<button class="add-btn">Add to Cart</button>`;
    container.querySelector(".add-btn").addEventListener("click", () => {
      updateQty(productId, 1);
      showToast("Added to cart");
    });
  } else {
    container.innerHTML = `
      <div class="qty-control">
        <button class="dec" aria-label="Decrease quantity">−</button>
        <span>${qty}</span>
        <button class="inc" aria-label="Increase quantity">+</button>
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

  const entries = Object.entries(cart).filter(([id]) => getProduct(id));
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
    const row = document.createElement("div");
    row.className = "cart-item";

    row.appendChild(buildMediaEl(p, "cart-item-image"));

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const nameEl = document.createElement("p");
    nameEl.className = "cart-item-name";
    nameEl.textContent = p.name;
    const unitEl = document.createElement("p");
    unitEl.className = "cart-item-unit";
    unitEl.textContent = `${p.unit || ""} · ${formatPrice(p.price)}`;
    const priceEl = document.createElement("div");
    priceEl.className = "cart-item-price";
    priceEl.textContent = formatPrice(p.price * qty);
    info.append(nameEl, unitEl, priceEl);
    row.appendChild(info);

    const qtyControl = document.createElement("div");
    qtyControl.className = "qty-control";
    qtyControl.innerHTML = `<button class="dec" aria-label="Decrease quantity">−</button><span>${qty}</span><button class="inc" aria-label="Increase quantity">+</button>`;
    qtyControl.querySelector(".dec").addEventListener("click", () => updateQty(id, -1));
    qtyControl.querySelector(".inc").addEventListener("click", () => updateQty(id, 1));
    row.appendChild(qtyControl);

    const removeBtn = document.createElement("button");
    removeBtn.className = "cart-item-remove";
    removeBtn.title = "Remove";
    removeBtn.textContent = "🗑️";
    removeBtn.addEventListener("click", () => {
      delete cart[id];
      saveCart();
      renderProducts();
      updateCartUI();
    });
    row.appendChild(removeBtn);

    cartItemsEl.appendChild(row);
  });
}

// ---------- Drawer / menu open-close (share one overlay) ----------
const cartDrawer = document.getElementById("cartDrawer");
const siteMenu = document.getElementById("siteMenu");
const overlay = document.getElementById("overlay");

function syncOverlay() {
  const anyOpen = cartDrawer.classList.contains("open") || siteMenu.classList.contains("open");
  overlay.classList.toggle("hidden", !anyOpen);
  document.body.classList.toggle("no-scroll", anyOpen);
}

function closeCart() {
  cartDrawer.classList.remove("open");
  syncOverlay();
}
function closeMenu() {
  siteMenu.classList.remove("open");
  syncOverlay();
}
function openCart() {
  closeMenu();
  cartDrawer.classList.add("open");
  syncOverlay();
}
function openMenu() {
  closeCart();
  siteMenu.classList.add("open");
  syncOverlay();
}

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("checkoutBarBtn").addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCart);
document.getElementById("menuBtn").addEventListener("click", openMenu);
document.getElementById("closeMenu").addEventListener("click", closeMenu);
document.getElementById("menuAboutLink").addEventListener("click", closeMenu);
overlay.addEventListener("click", () => { closeCart(); closeMenu(); });

// ---------- Search ----------
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderProducts();
});

// ---------- WhatsApp order ----------
const orderForm = document.getElementById("orderForm");
const whatsappFallback = document.getElementById("whatsappFallback");

orderForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("custName").value.trim();
  const phone = digitsOnly(document.getElementById("custPhone").value);
  const address = document.getElementById("custAddress").value.trim();

  const entries = Object.entries(cart).filter(([id]) => getProduct(id));

  if (!name || phone.length < 10 || !address || entries.length === 0) {
    showToast("Please fill all details and add items to cart.");
    return;
  }

  const wa = digitsOnly(STORE.profile.whatsappNumber);
  if (!wa) {
    showToast("This store hasn't set up WhatsApp ordering yet.");
    return;
  }

  const lines = [];
  lines.push(`🛒 *New Order — ${STORE.profile.storeName}*`);
  lines.push("");
  entries.forEach(([id, qty]) => {
    const p = getProduct(id);
    lines.push(`• ${p.name} (${p.unit || "1 pc"}) x${qty} = ${formatPrice(p.price * qty)}`);
  });
  lines.push("");
  lines.push(`*Total: ${formatPrice(cartPriceTotal())}*`);
  lines.push(`*Payment: ${STORE.profile.paymentNote || "Cash on Delivery"}*`);
  lines.push("");
  lines.push(`*Customer Details*`);
  lines.push(`Name: ${name}`);
  lines.push(`Phone: ${phone}`);
  lines.push(`Address: ${address}`);
  lines.push("");
  lines.push(`Order time: ${new Date().toLocaleString("en-IN")}`);

  const message = encodeURIComponent(lines.join("\n"));
  const url = `https://wa.me/${wa}?text=${message}`;

  const win = window.open(url, "_blank");
  whatsappFallback.classList.toggle("hidden", !!win);
  whatsappFallback.href = url;

  if (win) {
    showToast("Order sent! We'll confirm on WhatsApp shortly.");
    cart = {};
    saveCart();
    renderProducts();
    updateCartUI();
    orderForm.reset();
    closeCart();
  }
});

// ---------- Init ----------
async function init() {
  setLoadingState("loading");
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    STORE = await res.json();
    if (!STORE || !Array.isArray(STORE.products) || !Array.isArray(STORE.categories)) {
      throw new Error("Store data is malformed.");
    }
  } catch (err) {
    console.error("Failed to load store data:", err);
    setLoadingState("error");
    return;
  }

  const removedOos = pruneCart();
  renderProfile();
  renderShopDropdown();
  renderCategoryChips();
  renderSiteMenuCategories();
  initSearchToggle();
  renderProducts();
  updateCartUI();
  setLoadingState("ready");

  if (removedOos > 0) {
    showToast(`${removedOos} item${removedOos === 1 ? " is" : "s are"} out of stock and was removed from your cart.`);
  }
}

document.getElementById("retryLoadBtn")?.addEventListener("click", init);

init();
