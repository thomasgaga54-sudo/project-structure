# Design Document: POS Admin Enhancements

## Overview

Six targeted enhancements to the Zunny Mini Mart POS system. All changes are contained to three files:

- `zunny-pos-backend/routes/salesRoutes.js` — new DELETE route
- `zunny-pos-backend/public/admin.html` — all admin UI + logic changes
- `client/index.html` — low stock banner for cashier

No new dependencies, no schema changes, no new files required.

---

## Architecture

```
client/index.html          admin.html                salesRoutes.js
─────────────────          ──────────────────        ──────────────────────
Low Stock Banner    ←──    Low Stock Banner     ←──  GET /api/sales/recent
                           Export CSV button         (existing, unchanged)
                           Reprint button      ←──  GET /api/sales/today-performance
                           Void button         ──►  DELETE /api/sales/:id  (NEW)
                           Cashier filter            GET /api/products
                           Transactions Today  ←──  (transactionsToday already in response)
```

---

## Enhancement 1: Daily Sales Report Export (CSV)

### UI Change — `admin.html`

Add an **Export CSV** button in the Sales History date-filter controls row, after the existing Clear button:

```html
<button class="btn btn-sm" style="background:#16a34a" onclick="exportCSV()">Export CSV</button>
```

### JavaScript — `exportCSV()`

```
function exportCSV() {
  1. Query all <tr> rows from #reportBody
  2. If no data rows → showMessage("No data to export", "error") and return
  3. Build CSV string:
     - Header: "Date,Transactions,Revenue (NGN),Profit (NGN),Margin (%)"
     - Each row: read the 5 <td> text values, strip "₦" and "," from currency cells
  4. Create a Blob("text/csv"), make an <a> with download="sales-report-YYYY-MM-DD.csv"
  5. Programmatically click the link, then revoke the object URL
}
```

No backend change needed — all data is already rendered in the DOM table.

---

## Enhancement 2: Low Stock Alerts

### localStorage key: `lowStockThreshold` (default: 10)

### Admin Dashboard — `admin.html`

**Threshold input** — placed above the Inventory stat cards:

```html
<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
  <label style="font-weight:600;color:#555">Low Stock Threshold:</label>
  <input type="number" id="lowStockThresholdInput" min="1" value="10"
         style="width:80px;padding:6px 10px;border:2px solid #e9ecef;border-radius:8px"
         onchange="saveLowStockThreshold()">
</div>
```

**Low Stock Banner** — inserted above the `.stats` Inventory row, hidden by default:

```html
<div id="lowStockBanner" style="display:none;background:#fee2e2;border:1px solid #fca5a5;
     border-radius:8px;padding:14px;margin-bottom:16px;color:#dc2626;font-weight:600">
  ⚠️ Low Stock Alert: <span id="lowStockItems"></span>
</div>
```

**JavaScript additions:**

```
function saveLowStockThreshold() {
  const val = parseInt(document.getElementById("lowStockThresholdInput").value) || 10;
  localStorage.setItem("lowStockThreshold", val);
  loadDashboard(); // re-evaluate
}

function checkLowStock(products) {
  const threshold = parseInt(localStorage.getItem("lowStockThreshold")) || 10;
  // restore threshold input to saved value on load
  document.getElementById("lowStockThresholdInput").value = threshold;
  const low = products.filter(p => (p.stock || 0) < threshold);
  const banner = document.getElementById("lowStockBanner");
  if (low.length) {
    document.getElementById("lowStockItems").textContent =
      low.map(p => `${p.name} (${p.stock})`).join(", ");
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}
```

Call `checkLowStock(productsData)` inside `loadDashboard()` after fetching products.

### Cashier POS — `client/index.html`

**Low Stock Banner** — inserted above `#productGrid` (inside `.products` div):

```html
<div id="lowStockBanner" style="display:none;background:#fee2e2;border-left:4px solid #dc2626;
     padding:10px 14px;margin:0 16px 8px;border-radius:6px;color:#dc2626;font-size:13px;font-weight:600">
  ⚠️ Low Stock: <span id="lowStockItems"></span>
</div>
```

**JavaScript** — call after `renderProducts()` inside `loadProducts()`:

```
function checkLowStockCashier() {
  const threshold = parseInt(localStorage.getItem("lowStockThreshold")) || 10;
  const low = products.filter(p => (p.stock || 0) < threshold);
  const banner = document.getElementById("lowStockBanner");
  const items = document.getElementById("lowStockItems");
  if (low.length) {
    items.textContent = low.map(p => `${p.name} (${p.stock})`).join(", ");
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}
```

---

## Enhancement 3: Receipt Reprint

### UI Change — `admin.html`

Each sale card in `loadRawSales()` gains a Reprint button. The card currently renders into `#rawSalesList`. Modify the `li` HTML template in `loadRawSales()`:

```html
<button class="btn btn-sm" onclick="reprintReceipt(sale)">🖨️ Reprint</button>
```

### JavaScript — `reprintReceipt(sale)`

Mirrors `printReceipt` in `client/index.html` exactly. Key differences:
- Uses `sale.date` for the receipt date (not `new Date()`)
- Uses `sale._id` as the receipt number

```
function reprintReceipt(sale) {
  const date = new Date(sale.date).toLocaleString("en-NG");
  const rows = (sale.items || []).map(i => {
    const amt = (i.price * i.qty).toLocaleString();
    return `<tr><td>${i.name}${i.qty > 1 ? ' x' + i.qty : ''}</td><td>&#8358;${amt}</td></tr>`;
  }).join("");
  // Build same HTML as printReceipt in index.html
  // Open window, write, print, close
}
```

---

## Enhancement 4: Stock Restore on Sale Void

### Backend — `salesRoutes.js`

Add a new route **before** `module.exports`:

```
DELETE /api/sales/:id
- Auth: required, admin role only
- Flow:
  1. Find sale by _id → 404 if not found
  2. For each item in sale.items:
     a. Find product by item._id
     b. If product exists: product.stock += item.qty; await product.save()
     c. If product not found: log warning, skip (do not abort)
  3. await Sale.findByIdAndDelete(req.params.id)
  4. Return 200 { message: "Sale voided and stock restored" }
- Errors: 404 (sale not found), 500 (unexpected)
```

### UI Change — `admin.html`

Each sale card gains a Void button alongside Reprint:

```html
<button class="btn btn-danger btn-sm" onclick="voidSale('${sale._id}', this)">🗑️ Void</button>
```

### JavaScript — `voidSale(id, btn)`

```
async function voidSale(id, btn) {
  if (!confirm("Void this sale? Stock will be restored.")) return;
  try {
    const res = await fetch(`/api/sales/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!res.ok) throw new Error((await res.json()).message);
    // Remove the sale card from the DOM
    btn.closest("li").remove();
    // Rebuild cashier dropdown after removal
    rebuildCashierDropdown();
    // Refresh dashboard stats
    loadDashboard();
    showMessage("✅ Sale voided and stock restored");
  } catch (err) {
    showMessage(err.message || "Error voiding sale", "error");
  }
}
```

---

## Enhancement 5: Sales Filter by Cashier

### UI Change — `admin.html`

Add a cashier dropdown **above** the Load Recent Sales button and `#rawSalesList`:

```html
<div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
  <label style="font-weight:600;color:#555">Filter by Cashier:</label>
  <select id="cashierFilter" onchange="applyCashierFilter()"
          style="padding:7px 12px;border:2px solid #e9ecef;border-radius:8px;font-size:14px">
    <option value="">All Cashiers</option>
  </select>
</div>
```

### JavaScript

```
let allRawSales = []; // module-level cache

// At end of loadRawSales(), after rendering:
allRawSales = sales; // cache the full list
rebuildCashierDropdown();

function rebuildCashierDropdown() {
  const select = document.getElementById("cashierFilter");
  const current = select.value;
  const names = [...new Set(allRawSales.map(s => s.cashier).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All Cashiers</option>' +
    names.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`).join("");
}

function applyCashierFilter() {
  const val = document.getElementById("cashierFilter").value;
  const list = document.getElementById("rawSalesList");
  list.querySelectorAll("li[data-cashier]").forEach(li => {
    li.style.display = (!val || li.dataset.cashier === val) ? "" : "none";
  });
}
```

Each `<li>` in `loadRawSales()` gets `data-cashier="${sale.cashier}"` attribute.

---

## Enhancement 6: Transactions Today Stat Card

### UI Change — `admin.html`

Add a 4th stat card to the Today's Performance `.stats` row:

```html
<div class="stat-card">
  <div class="stat-number" id="todayTransactions" style="color:#8b5cf6">...</div>
  <div class="stat-label">Transactions Today</div>
</div>
```

### JavaScript — `loadDashboard()`

`GET /api/sales/today-performance` already returns `transactionsToday`. In the existing `perfRes.ok` block, add:

```js
document.getElementById("todayTransactions").textContent = perf.transactionsToday ?? "–";
```

Set placeholder `...` in HTML (already shown above) and `–` on fetch failure — both handled by the existing try/catch pattern:

```js
// Before fetch:
document.getElementById("todayTransactions").textContent = "...";

// In catch block:
document.getElementById("todayTransactions").textContent = "–";
```

No backend change needed — `transactionsToday` is already in the response.

---

## Implementation Order

The tasks should be implemented in this order to minimise merge conflicts in `admin.html`:

1. **Backend** — Add `DELETE /api/sales/:id` to `salesRoutes.js`
2. **Transactions Today stat card** — smallest, self-contained UI + JS change
3. **Low Stock Alerts** — admin dashboard + cashier POS
4. **CSV Export** — reads existing DOM, no side effects
5. **Reprint + Void + Cashier Filter** — all modify `loadRawSales()` card template together

Tasks 5 items (Reprint, Void, Cashier Filter) should be done in a single edit to `loadRawSales()` to avoid repeated modifications to the same function.

---

## Security Considerations

- `DELETE /api/sales/:id` uses the existing `auth` middleware and checks `req.user.role === "admin"` — consistent with all other admin-only routes.
- Stock restoration uses `findById` + individual `save()` calls (not `updateMany`) so Mongoose validators run on each save.
- CSV export is client-side only — no sensitive data is sent to a third party.

---

## File Change Summary

| File | Changes |
|------|---------|
| `salesRoutes.js` | Add `DELETE /api/sales/:id` route (~25 lines) |
| `admin.html` | Low stock banner + threshold input, Export CSV button + function, Reprint button + function, Void button + function, Cashier filter dropdown + functions, Transactions Today stat card |
| `client/index.html` | Low stock banner element + `checkLowStockCashier()` function called after product load |
