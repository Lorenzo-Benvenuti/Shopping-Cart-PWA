/* app.js
   Persistence note:
   localStorage is used to keep the cart even after closing the browser,
   so users can find their shopping list again (and use it as a reminder).
*/
"use strict";

const state = {
  productsData: null,
  selectedCategory: null,
  quantities: {}, // Quantities selected in the UI (not yet in the cart)
  cart: {}, // { productId: { id, name, price, quantity } }
};

const els = {
  appView: document.getElementById("appView"),
  categorySelect: document.getElementById("categorySelect"),
  btnCart: document.getElementById("btnCart"),
  navHome: document.getElementById("navHome"),
  cartBadge: document.getElementById("cartBadge"),
  offlineBanner: document.getElementById("offlineBanner"),
};

function updateOnlineStatus() {
  if (!els.offlineBanner) return;
  els.offlineBanner.style.display = navigator.onLine ? "none" : "block";
}

function euros(value) {
  // Keep EUR formatting, but show English formatting.
  return value.toLocaleString("en-IE", { style: "currency", currency: "EUR" });
}

function loadCart() {
  try {
    const raw = localStorage.getItem("cart_v1");
    state.cart = raw ? JSON.parse(raw) : {};
  } catch {
    state.cart = {};
  }
}

function saveCart() {
  localStorage.setItem("cart_v1", JSON.stringify(state.cart));
}

function cartCount() {
  // Total quantity, not number of distinct rows.
  return Object.values(state.cart).reduce((acc, item) => acc + item.quantity, 0);
}

function updateCartBadge() {
  els.cartBadge.textContent = String(cartCount());
}

async function loadProducts() {
  const res = await fetch("/data/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Unable to load products.json");
  return res.json();
}

function buildCategoryOptions() {
  const { categories } = state.productsData;
  els.categorySelect.innerHTML = categories
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  state.selectedCategory = categories[0].id;
  els.categorySelect.value = state.selectedCategory;
}

function getProductsByCategory(catId) {
  return state.productsData.products.filter((p) => p.category === catId);
}

function ensureQuantity(productId) {
  if (typeof state.quantities[productId] !== "number") state.quantities[productId] = 0;
}

function renderProductsView() {
  const catId = state.selectedCategory;
  const products = getProductsByCategory(catId);

  const categoryLabel = state.productsData.categories.find((c) => c.id === catId)?.label ?? "";

  const cards = products
    .map((p) => {
      ensureQuantity(p.id);
      const q = state.quantities[p.id];

      return `
      <div class="col-12 col-sm-6 col-lg-4">
        <div class="card glass h-100 p-3">
          <img src="/${p.image}" class="w-100 product-img" alt="Photo: ${p.name}">
          <div class="mt-3">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="d-flex align-items-center gap-2">
                  <h2 class="h6 mb-0">${p.name}</h2>
                  <span class="badge badge-soft">${categoryLabel}</span>
                </div>
                <div class="text-secondary small">${p.description}</div>
              </div>
              <div class="fw-semibold">${euros(p.price)}</div>
            </div>

            <div class="mt-3 d-flex align-items-center gap-2">
              <button class="btn btn-outline-soft btn-sm" data-action="dec" data-testid="qty-dec" data-id="${
                p.id
              }" aria-label="Decrease quantity">
                <i class="bi bi-dash"></i>
              </button>

              <input class="form-control form-control-sm text-center" style="max-width: 90px;"
                     value="${q}" readonly aria-label="Selected quantity">

              <button class="btn btn-outline-soft btn-sm" data-action="inc" data-testid="qty-inc" data-id="${
                p.id
              }" aria-label="Increase quantity">
                <i class="bi bi-plus"></i>
              </button>

              <button class="btn btn-brand btn-sm ms-auto" data-action="addToCart" data-testid="add-to-cart" data-id="${
                p.id
              }">
                <i class="bi bi-cart-plus me-1"></i> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  els.appView.innerHTML = `
    <div class="row g-3">
      ${cards}
    </div>
  `;
}

function addToCart(productId) {
  const product = state.productsData.products.find((p) => p.id === productId);
  if (!product) return;

  const q = state.quantities[productId] ?? 0;
  if (q <= 0) return;

  if (!state.cart[productId]) {
    state.cart[productId] = {
      id: productId,
      name: product.name,
      price: product.price,
      quantity: 0,
    };
  }
  state.cart[productId].quantity += q;

  // Reset selection for a minimal UX
  state.quantities[productId] = 0;

  saveCart();
  updateCartBadge();
  renderProductsView();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveCart();
  updateCartBadge();
  renderCartView();
}

function cartRows() {
  const items = Object.values(state.cart);
  let total = 0;

  const rows = items
    .map((item, idx) => {
      const partial = item.price * item.quantity;
      total += partial;

      return `
      <tr>
        <td class="text-secondary">${idx + 1}</td>
        <td class="fw-semibold">${item.name}</td>
        <td>${euros(item.price)}</td>
        <td>${item.quantity}</td>
        <td class="fw-semibold">${euros(partial)}</td>
        <td class="text-end">
          <button class="btn btn-outline-soft btn-sm" data-action="removeFromCart" data-id="${
            item.id
          }" aria-label="Remove from cart">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  return { rows, total, countRows: items.length };
}

function renderCartView() {
  const { rows, total, countRows } = cartRows();

  els.appView.innerHTML = `
    <div class="card glass p-3 p-md-4">
      <div class="d-flex flex-column flex-md-row gap-2 justify-content-between align-items-md-center">
        <div>
          <h2 class="h5 mb-1">Cart</h2>
          <p class="mb-0 text-secondary small">Items added: ${countRows}</p>
        </div>

        <button class="btn btn-outline-soft" id="btnBackHome">
          <i class="bi bi-house-door me-1"></i> Home
        </button>
      </div>

      <div class="table-responsive mt-3">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Unit price</th>
              <th>Quantity</th>
              <th>Subtotal</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              `<tr><td colspan="6" class="text-center text-secondary py-4">Your cart is empty.</td></tr>`
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-end text-secondary fw-semibold">Total</td>
              <td class="fw-bold">${euros(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btnBackHome")?.addEventListener("click", () => renderProductsView());
}

function wireEvents() {
  els.categorySelect.addEventListener("change", (e) => {
    state.selectedCategory = e.target.value;
    renderProductsView();
  });

  els.btnCart.addEventListener("click", () => renderCartView());
  els.navHome.addEventListener("click", (e) => {
    e.preventDefault();
    renderProductsView();
  });

  // Event delegation for dynamic buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "inc") {
      ensureQuantity(id);
      state.quantities[id] += 1;
      renderProductsView();
    }
    if (action === "dec") {
      ensureQuantity(id);
      state.quantities[id] = Math.max(0, state.quantities[id] - 1);
      renderProductsView();
    }
    if (action === "addToCart") {
      addToCart(id);
    }
    if (action === "removeFromCart") {
      removeFromCart(id);
    }
  });
}

// Async init that loads the product dataset and boots the UI
async function init() {
  loadCart();
  updateCartBadge();

  // Online/offline banner (best-effort)
  updateOnlineStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  try {
    state.productsData = await loadProducts();
  } catch (err) {
    els.appView.innerHTML = `
      <div class="alert alert-danger">
        <div class="fw-semibold">Error</div>
        <div>Unable to load products. Please try again later.</div>
      </div>
    `;
    return;
  }

  buildCategoryOptions();
  wireEvents();
  renderProductsView();
}

init();
