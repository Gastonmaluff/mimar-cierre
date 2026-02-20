const MONEY = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0
});

const state = {
  products: load("products", []),
  currentItems: [],
  orders: [],
  orderInProgress: false,
  productsVisible: false,
  closures: load("closures", [])
};

const el = {
  productForm: document.getElementById("product-form"),
  productId: document.getElementById("product-id"),
  productName: document.getElementById("product-name"),
  productProvider: document.getElementById("product-provider"),
  productCost: document.getElementById("product-cost"),
  productGaston: document.getElementById("product-gaston"),
  productMaria: document.getElementById("product-maria"),
  salePricePreview: document.getElementById("sale-price-preview"),
  clearForm: document.getElementById("clear-form"),
  toggleProducts: document.getElementById("toggle-products"),
  productsList: document.getElementById("products-list"),
  orderBuilder: document.getElementById("order-builder"),
  orderName: document.getElementById("order-name"),
  saleProduct: document.getElementById("sale-product"),
  saleQty: document.getElementById("sale-qty"),
  addItem: document.getElementById("add-item"),
  addOrder: document.getElementById("add-order"),
  finishClose: document.getElementById("finish-close"),
  currentOrder: document.getElementById("current-order"),
  ordersList: document.getElementById("orders-list"),
  closeResult: document.getElementById("close-result"),
  closuresHistory: document.getElementById("closures-history"),
  fromDate: document.getElementById("from-date"),
  toDate: document.getElementById("to-date")
};

bindEvents();
renderAll();

function bindEvents() {
  el.productForm.addEventListener("submit", onSaveProduct);
  el.clearForm.addEventListener("click", resetProductForm);
  el.toggleProducts.addEventListener("click", onToggleProducts);
  el.addItem.addEventListener("click", onAddItemToCurrentOrder);
  el.addOrder.addEventListener("click", onAddOrder);
  el.finishClose.addEventListener("click", onFinishClose);

  [el.productCost, el.productGaston, el.productMaria].forEach((input) => {
    input.addEventListener("input", renderProductSalePreview);
  });
}

function onToggleProducts() {
  state.productsVisible = !state.productsVisible;
  renderProductsVisibility();
}

function onSaveProduct(event) {
  event.preventDefault();

  const product = {
    id: el.productId.value || crypto.randomUUID(),
    name: el.productName.value.trim(),
    provider: el.productProvider.value.trim(),
    cost: Number(el.productCost.value),
    gaston: Number(el.productGaston.value),
    maria: Number(el.productMaria.value)
  };

  if (!product.name || !product.provider) return;
  if ([product.cost, product.gaston, product.maria].some((n) => Number.isNaN(n) || n < 0)) return;

  const existing = state.products.findIndex((p) => p.id === product.id);
  if (existing >= 0) state.products[existing] = product;
  else state.products.push(product);

  save("products", state.products);
  resetProductForm();
  renderAll();
}

function resetProductForm() {
  el.productId.value = "";
  el.productForm.reset();
  renderProductSalePreview();
}

function onEditProduct(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  el.productId.value = product.id;
  el.productName.value = product.name;
  el.productProvider.value = product.provider;
  el.productCost.value = product.cost;
  el.productGaston.value = product.gaston;
  el.productMaria.value = product.maria;
  renderProductSalePreview();
}

function onDeleteProduct(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;

  const confirmed = confirm(`Eliminar producto "${product.name}"?`);
  if (!confirmed) return;

  state.products = state.products.filter((p) => p.id !== id);
  state.currentItems = state.currentItems.filter((item) => item.productId !== id);
  state.orders = state.orders
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => item.productId !== id)
    }))
    .filter((order) => order.items.length > 0);

  save("products", state.products);
  renderAll();
}

function onRemoveCurrentItem(index) {
  state.currentItems.splice(index, 1);
  renderCurrentOrder();
}

function onAddItemToCurrentOrder() {
  if (!state.orderInProgress) {
    alert("Primero toca 'Cargar nuevo pedido' para iniciar un pedido.");
    return;
  }

  const productId = el.saleProduct.value;
  const qty = Number(el.saleQty.value);
  if (!productId || Number.isNaN(qty) || qty <= 0) return;

  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  state.currentItems.push({ productId, qty });
  renderCurrentOrder();
}

function onAddOrder() {
  if (!validateDates()) return;

  if (state.products.length === 0) {
    alert("Primero carga al menos un producto.");
    return;
  }

  if (!state.orderInProgress) {
    state.orderInProgress = true;
    state.currentItems = [];
    el.orderName.value = "";
    el.saleQty.value = "1";
    renderOrderFlow();
    renderCurrentOrder();
    return;
  }

  if (state.currentItems.length === 0) {
    alert("Agrega al menos un producto al pedido actual.");
    return;
  }

  state.orders.push({
    id: crypto.randomUUID(),
    name: el.orderName.value.trim(),
    items: structuredClone(state.currentItems)
  });

  state.currentItems = [];
  state.orderInProgress = false;
  renderOrderFlow();
  renderCurrentOrder();
  renderOrders();
}

function onFinishClose() {
  if (!validateDates()) return;
  if (state.orders.length === 0) {
    alert("No hay pedidos cargados para cerrar.");
    return;
  }

  const totals = getTotalsFromOrders(state.orders);
  const providerTotals = getProviderTotalsFromOrders(state.orders);
  const providerTotalsHtml = Object.entries(providerTotals)
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(
      ([provider, total]) =>
        `<li>${escapeHtml(provider)}: ${MONEY.format(total)}</li>`
    )
    .join("");
  const closure = {
    id: crypto.randomUUID(),
    fromDate: el.fromDate.value,
    toDate: el.toDate.value,
    createdAt: new Date().toISOString(),
    ordersCount: state.orders.length,
    providerTotals,
    totals
  };
  state.closures.unshift(closure);
  save("closures", state.closures);

  el.closeResult.innerHTML = `
    <div class="box">
      <h3>Cierre del ${fmtDate(el.fromDate.value)} al ${fmtDate(el.toDate.value)}</h3>
      <p class="total-line">Pago por proveedor:</p>
      <ul>${providerTotalsHtml}</ul>
      <p class="total-line">Total Gaston: ${MONEY.format(totals.gaston)}</p>
      <p class="total-line">Total Maria: ${MONEY.format(totals.maria)}</p>
      <p class="total-line">Total venta: ${MONEY.format(totals.sale)}</p>
    </div>
  `;
  renderClosuresHistory();
}

function validateDates() {
  const from = el.fromDate.value;
  const to = el.toDate.value;

  if (!from || !to) {
    alert("Selecciona fecha desde y fecha hasta.");
    return false;
  }

  if (from > to) {
    alert("La fecha desde no puede ser mayor que fecha hasta.");
    return false;
  }

  return true;
}

function renderAll() {
  renderProducts();
  renderProductsVisibility();
  renderProductOptions();
  renderOrderFlow();
  renderCurrentOrder();
  renderOrders();
  renderProductSalePreview();
  renderClosuresHistory();
}

function renderClosuresHistory() {
  if (state.closures.length === 0) {
    el.closuresHistory.innerHTML = "<p class='small'>Todavia no hay cierres guardados.</p>";
    return;
  }

  el.closuresHistory.innerHTML = state.closures
    .map((closure, index) => {
      const providerLine = Object.entries(closure.providerTotals)
        .sort((a, b) => a[0].localeCompare(b[0], "es"))
        .map(([provider, total]) => `${escapeHtml(provider)}: ${MONEY.format(total)}`)
        .join(" | ");

      return `
        <div class="box">
          <h3>Cierre ${state.closures.length - index}</h3>
          <p><strong>Periodo:</strong> ${fmtDate(closure.fromDate)} al ${fmtDate(closure.toDate)}</p>
          <p><strong>Pedidos:</strong> ${closure.ordersCount}</p>
          <p class="total-line">TOTAL PEDIDO: ${MONEY.format(closure.totals.sale)} | TOTAL GASTON: ${MONEY.format(closure.totals.gaston)} | TOTAL MARIA: ${MONEY.format(closure.totals.maria)}</p>
          <p><strong>Proveedores:</strong> ${providerLine || "Sin proveedores"}</p>
          <p class="small">Guardado: ${fmtDateTime(closure.createdAt)}</p>
        </div>
      `;
    })
    .join("");
}

function renderProductsVisibility() {
  el.productsList.hidden = !state.productsVisible;
  el.toggleProducts.textContent = state.productsVisible
    ? "Ocultar lista de productos"
    : "Mostrar lista de productos";
}

function renderProductSalePreview() {
  const cost = Number(el.productCost.value) || 0;
  const gaston = Number(el.productGaston.value) || 0;
  const maria = Number(el.productMaria.value) || 0;
  const salePrice = cost + gaston + maria;
  el.salePricePreview.textContent = `Precio venta del producto: ${MONEY.format(salePrice)}`;
}

function renderProducts() {
  if (state.products.length === 0) {
    el.productsList.innerHTML = "<p class='small'>Todavia no hay productos.</p>";
    return;
  }

  el.productsList.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Proveedor</th>
          <th>Costo</th>
          <th>Gaston</th>
          <th>Maria</th>
          <th>Precio venta</th>
          <th>Accion</th>
        </tr>
      </thead>
      <tbody>
        ${state.products
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.provider)}</td>
            <td>${MONEY.format(p.cost)}</td>
            <td>${MONEY.format(p.gaston)}</td>
            <td>${MONEY.format(p.maria)}</td>
            <td>${MONEY.format(getUnitSalePrice(p))}</td>
            <td>
              <button type="button" data-edit="${p.id}" class="secondary">Modificar</button>
              <button type="button" data-delete-product="${p.id}" class="danger">Eliminar</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  el.productsList.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => onEditProduct(btn.dataset.edit));
  });
  el.productsList.querySelectorAll("[data-delete-product]").forEach((btn) => {
    btn.addEventListener("click", () => onDeleteProduct(btn.dataset.deleteProduct));
  });
}

function renderProductOptions() {
  if (state.products.length === 0) {
    el.saleProduct.innerHTML = "<option value=''>Primero crea productos</option>";
    return;
  }

  el.saleProduct.innerHTML = state.products
    .map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.name)} - ${escapeHtml(
          p.provider
        )} - ${MONEY.format(getUnitSalePrice(p))}</option>`
    )
    .join("");
}

function renderOrderFlow() {
  const show = state.orderInProgress;
  el.orderBuilder.hidden = !show;
  el.orderBuilder.classList.toggle("active", show);
  el.addOrder.textContent = state.orderInProgress ? "Guardar pedido" : "Cargar nuevo pedido";
}

function renderCurrentOrder() {
  if (!state.orderInProgress && state.currentItems.length === 0) {
    el.currentOrder.innerHTML = "<p class='small'>Todavia no iniciaste un pedido. Toca 'Cargar nuevo pedido'.</p>";
    return;
  }

  if (state.currentItems.length === 0) {
    el.currentOrder.innerHTML = "<p class='small'>Pedido actual iniciado. Agrega productos.</p>";
    return;
  }

  const resolved = resolveItems(state.currentItems);
  const totals = getTotals(resolved);
  const providerTotals = getProviderTotalsFromResolved(resolved);
  const totalLine = buildOrderTotalLine(totals, providerTotals);

  el.currentOrder.innerHTML = `
    <div class="box">
      <h3>Pedido actual (sin guardar)</h3>
      <ul>
        ${resolved
          .map((item, index) => {
            return `<li>${escapeHtml(item.product.name)} x ${item.qty} | Proveedor ${MONEY.format(item.provider)} | Gaston ${MONEY.format(item.gaston)} | Maria ${MONEY.format(item.maria)} | Venta ${MONEY.format(item.sale)} <button type="button" data-remove-current="${index}" class="danger">Quitar</button></li>`;
          })
          .join("")}
      </ul>
      <p class="total-line">${totalLine}</p>
    </div>
  `;

  el.currentOrder.querySelectorAll("[data-remove-current]").forEach((btn) => {
    btn.addEventListener("click", () => onRemoveCurrentItem(Number(btn.dataset.removeCurrent)));
  });
}

function renderOrders() {
  if (state.orders.length === 0) {
    el.ordersList.innerHTML = "<p class='small'>Todavia no hay pedidos guardados.</p>";
    return;
  }

  el.ordersList.innerHTML = state.orders
    .map((order, index) => {
      const resolved = resolveItems(order.items);
      const totals = getTotals(resolved);
      const providerTotals = getProviderTotalsFromResolved(resolved);
      const totalLine = buildOrderTotalLine(totals, providerTotals);
      const orderTitle = order.name
        ? `Pedido ${index + 1} - ${escapeHtml(order.name)}`
        : `Pedido ${index + 1}`;

      return `
        <div class="box">
          <h3>${orderTitle}</h3>
          <ul>
            ${resolved
              .map(
                (item) =>
                  `<li>${escapeHtml(item.product.name)} x ${item.qty} | Proveedor ${MONEY.format(item.provider)} | Gaston ${MONEY.format(item.gaston)} | Maria ${MONEY.format(item.maria)} | Venta ${MONEY.format(item.sale)}</li>`
              )
              .join("")}
          </ul>
          <p class="total-line">${totalLine}</p>
        </div>
      `;
    })
    .join("");
}

function resolveItems(items) {
  return items
    .map((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        product,
        qty: item.qty,
        provider: product.cost * item.qty,
        gaston: product.gaston * item.qty,
        maria: product.maria * item.qty,
        sale: getUnitSalePrice(product) * item.qty
      };
    })
    .filter(Boolean);
}

function getUnitSalePrice(product) {
  return product.cost + product.gaston + product.maria;
}

function getTotals(resolvedItems) {
  return resolvedItems.reduce(
    (acc, item) => {
      acc.provider += item.provider;
      acc.gaston += item.gaston;
      acc.maria += item.maria;
      acc.sale += item.sale;
      return acc;
    },
    { provider: 0, gaston: 0, maria: 0, sale: 0 }
  );
}

function getTotalsFromOrders(orders) {
  return orders.reduce(
    (acc, order) => {
      const totals = getTotals(resolveItems(order.items));
      acc.provider += totals.provider;
      acc.gaston += totals.gaston;
      acc.maria += totals.maria;
      acc.sale += totals.sale;
      return acc;
    },
    { provider: 0, gaston: 0, maria: 0, sale: 0 }
  );
}

function getProviderTotalsFromOrders(orders) {
  return orders.reduce((acc, order) => {
    const resolved = resolveItems(order.items);
    const orderProviderTotals = getProviderTotalsFromResolved(resolved);
    Object.entries(orderProviderTotals).forEach(([provider, total]) => {
      acc[provider] = (acc[provider] || 0) + total;
    });
    return acc;
  }, {});
}

function getProviderTotalsFromResolved(resolvedItems) {
  return resolvedItems.reduce((acc, item) => {
    const key = item.product.provider;
    acc[key] = (acc[key] || 0) + item.provider;
    return acc;
  }, {});
}

function buildOrderTotalLine(totals, providerTotals) {
  const providersText = Object.entries(providerTotals)
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(
      ([provider, total]) =>
        `TOTAL ${escapeHtml(provider.toUpperCase())}: ${MONEY.format(total)}`
    )
    .join(" | ");

  const parts = [
    `TOTAL PEDIDO: ${MONEY.format(totals.sale)}`,
    providersText,
    `TOTAL GASTON: ${MONEY.format(totals.gaston)}`,
    `TOTAL MARIA: ${MONEY.format(totals.maria)}`
  ].filter(Boolean);

  return parts.join(" | ");
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function fmtDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString("es-PY");
}

function fmtDateTime(dateString) {
  return new Date(dateString).toLocaleString("es-PY");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
