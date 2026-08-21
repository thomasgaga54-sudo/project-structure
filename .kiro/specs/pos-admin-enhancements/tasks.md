# Implementation Tasks: POS Admin Enhancements

## Tasks

- [x] 1. Add DELETE /api/sales/:id route with stock restoration
  - Add admin-only `DELETE /api/sales/:id` route to `salesRoutes.js`
  - Find sale by `_id`; return 404 if not found
  - For each item in `sale.items`, find product by `item._id` and increment `product.stock` by `item.qty`; skip silently if product no longer exists
  - Delete the sale document after stock is restored
  - Return `{ message: "Sale voided and stock restored" }` on success
  - **File**: `zunny-pos-backend/routes/salesRoutes.js`
  - **Requirement**: 4 (AC 4, 5, 6, 7)

- [x] 2. Add Transactions Today stat card to admin dashboard
  - Add a 4th stat card `<div class="stat-card">` to the Today's Performance `.stats` row with id `todayTransactions` and label "Transactions Today"
  - Set placeholder `...` on the element before fetch, `–` in the catch block
  - In the existing `perfRes.ok` block inside `loadDashboard()`, read `perf.transactionsToday` and set `todayTransactions` text content
  - **File**: `zunny-pos-backend/public/admin.html`
  - **Requirement**: 6 (AC 1, 2, 3, 4, 5)

- [x] 3. Add Low Stock Alerts to admin dashboard
  - Add a configurable threshold `<input type="number">` with id `lowStockThresholdInput` above the Inventory stats, with `onchange="saveLowStockThreshold()"` that persists to `localStorage` under key `lowStockThreshold`
  - Add a hidden `#lowStockBanner` div above the Inventory stats
  - Implement `checkLowStock(products)` that reads threshold from `localStorage` (default 10), filters products with `stock < threshold`, shows/hides the banner with affected product names and counts
  - Call `checkLowStock(productsData)` inside `loadDashboard()` after the products fetch
  - Implement `saveLowStockThreshold()` that writes to `localStorage` and calls `loadDashboard()`
  - **File**: `zunny-pos-backend/public/admin.html`
  - **Requirement**: 2 (AC 1, 2, 3, 4)

- [x] 4. Add Low Stock Banner to cashier POS
  - Add a hidden `#lowStockBanner` div and `#lowStockItems` span above `#productGrid` inside the `.products` div in `client/index.html`
  - Implement `checkLowStockCashier()` that reads `localStorage.lowStockThreshold` (default 10), filters `products` array for `stock < threshold`, and shows/hides the banner with product names and counts
  - Call `checkLowStockCashier()` at the end of `loadProducts()` after `renderProducts()`
  - **File**: `client/index.html`
  - **Requirement**: 2 (AC 5, 6, 7)

- [x] 5. Add CSV Export button and function to admin dashboard
  - Add `<button class="btn btn-sm" style="background:#16a34a" onclick="exportCSV()">Export CSV</button>` adjacent to the date-filter controls in the Sales History section
  - Implement `exportCSV()`: query all `<tr>` rows in `#reportBody`; if no data rows show "No data to export" notification and return; build CSV string with header `Date,Transactions,Revenue (NGN),Profit (NGN),Margin (%)` and one row per table row (stripping `₦` and `,` from currency cells); trigger download named `sales-report-YYYY-MM-DD.csv` using a Blob and a temporary `<a>` element
  - **File**: `zunny-pos-backend/public/admin.html`
  - **Requirement**: 1 (AC 1, 2, 3, 4, 5)

- [x] 6. Add Reprint, Void buttons and Cashier Filter to Recent Sales
  - Add `data-cashier="${sale.cashier}"` attribute to each `<li>` element rendered by `loadRawSales()`
  - Add `🖨️ Reprint` button to each sale card calling `reprintReceipt(sale)`
  - Add `🗑️ Void` button to each sale card calling `voidSale(sale._id, btn)`
  - Add cashier filter `<select id="cashierFilter">` with "All Cashiers" default above `#rawSalesList`
  - Implement `reprintReceipt(sale)`: open a print window using the same HTML layout as `printReceipt` in `client/index.html`, using `sale.date` for the timestamp and `sale._id` as the receipt number
  - Implement `voidSale(id, btn)`: confirm prompt → `DELETE /api/sales/:id` with admin JWT → remove `btn.closest("li")` from DOM → call `rebuildCashierDropdown()` and `loadDashboard()` → show success message; show error message on failure
  - Store full sales array in module-level `allRawSales`; implement `rebuildCashierDropdown()` that rebuilds options from `allRawSales`; implement `applyCashierFilter()` that shows/hides `<li>` elements by matching `data-cashier` against the selected value
  - **File**: `zunny-pos-backend/public/admin.html`
  - **Requirements**: 3 (AC 1, 2, 3, 4), 4 (AC 1, 2, 3, 8), 5 (AC 1, 2, 3, 4, 5)
