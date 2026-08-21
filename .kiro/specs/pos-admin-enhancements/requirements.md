# Requirements Document

## Introduction

This document defines requirements for six enhancements to the Zunny Mini Mart POS admin panel.
The system has two frontends — a cashier POS (`client/index.html`) and an admin dashboard (`zunny-pos-backend/public/admin.html`) — backed by a Node.js/Express API with MongoDB. The enhancements cover reporting, stock visibility, sale management, filtering, and dashboard metrics.

---

## Glossary

- **Admin_Dashboard**: The admin panel served at `admin.html`; requires a valid JWT stored as `adminToken` in `localStorage`.
- **Cashier_POS**: The cashier-facing page at `client/index.html`; requires a valid JWT stored as `token` in `localStorage`.
- **Sales_API**: The Express router mounted at `/api/sales` in `salesRoutes.js`.
- **Products_API**: The Express router mounted at `/api/products` in `productRoutes.js`.
- **Report_Table**: The HTML table rendered in the Admin_Dashboard Sales History section showing Date, Transactions, Revenue, Profit, and Margin columns.
- **Recent_Sales_List**: The ordered list of individual sale cards rendered in the Admin_Dashboard by `loadRawSales()`.
- **Low_Stock_Threshold**: The configurable minimum stock level below which a product is considered low-stock; defaults to 10 units.
- **Low_Stock_Banner**: A full-width, visually prominent warning element shown to the user when at least one product is below the Low_Stock_Threshold.
- **Void_Sale**: The act of permanently deleting a sale record from the database while restoring the stock quantities of every item in that sale.
- **printReceipt**: The existing JavaScript function in `client/index.html` that opens a print window with a formatted thermal receipt.
- **CSV**: Comma-Separated Values file format used for spreadsheet-compatible export.

---

## Requirements

### Requirement 1: Daily Sales Report Export

**User Story:** As an admin, I want to export the currently displayed sales history as a CSV file, so that I can keep records and analyse sales data in a spreadsheet.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display an "Export CSV" button adjacent to the Sales History date-filter controls.
2. WHEN the Export CSV button is clicked, THE Admin_Dashboard SHALL generate a CSV file whose rows correspond exactly to the rows currently visible in the Report_Table.
3. THE Admin_Dashboard SHALL include a header row in the CSV with the columns: Date, Transactions, Revenue (NGN), Profit (NGN), Margin (%).
4. WHEN the Export CSV button is clicked, THE Admin_Dashboard SHALL trigger a browser file download named `sales-report-YYYY-MM-DD.csv`, where the date is the client's current local date.
5. IF the Report_Table contains no data rows, THEN THE Admin_Dashboard SHALL display a notification informing the admin that there is no data to export and SHALL NOT initiate a download.

---

### Requirement 2: Low Stock Alerts

**User Story:** As an admin and as a cashier, I want to see a prominent warning when any product is below the Low_Stock_Threshold, so that restocking action is taken before items run out.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a configurable Low_Stock_Threshold input field that accepts a positive integer value and persists the value in `localStorage` under the key `lowStockThreshold`.
2. WHEN the Admin_Dashboard dashboard tab is loaded, THE Admin_Dashboard SHALL fetch the current product list and evaluate each product's stock against the Low_Stock_Threshold.
3. WHEN at least one product's stock is strictly less than the Low_Stock_Threshold, THE Admin_Dashboard SHALL render the Low_Stock_Banner above the dashboard stats listing the names and stock counts of all affected products.
4. WHILE no product's stock is below the Low_Stock_Threshold, THE Admin_Dashboard SHALL NOT display the Low_Stock_Banner.
5. WHEN the Cashier_POS loads its product list, THE Cashier_POS SHALL evaluate each product's stock against the value stored in `localStorage` under `lowStockThreshold`, defaulting to 10 if not set.
6. WHEN at least one product's stock is strictly less than the Low_Stock_Threshold, THE Cashier_POS SHALL render the Low_Stock_Banner above the product grid listing the names and stock counts of all affected products.
7. WHILE no product's stock is below the Low_Stock_Threshold, THE Cashier_POS SHALL NOT display the Low_Stock_Banner.

---

### Requirement 3: Receipt Reprint

**User Story:** As an admin, I want to reprint the receipt for any sale shown in the Recent_Sales_List, so that I can provide a copy to a customer who needs one.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render a "Reprint" button on each sale card in the Recent_Sales_List.
2. WHEN the Reprint button for a sale is clicked, THE Admin_Dashboard SHALL invoke a receipt-printing function using the same visual format as `printReceipt` in the Cashier_POS.
3. THE Admin_Dashboard receipt SHALL include: store name and address, receipt number (the sale's `_id`), date and time of the original sale, a line per item showing name, quantity, and line total, and the sale total.
4. WHEN the receipt print window is opened, THE Admin_Dashboard SHALL use the original `sale.date` timestamp for the receipt date, not the current time.

---

### Requirement 4: Stock Restore on Sale Void

**User Story:** As an admin, I want to void a sale from the Recent_Sales_List and have the stock automatically restored, so that inventory remains accurate after cancellations or errors.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render a "Void" button on each sale card in the Recent_Sales_List.
2. WHEN the Void button is clicked, THE Admin_Dashboard SHALL display a confirmation prompt before proceeding.
3. WHEN the admin confirms the void, THE Admin_Dashboard SHALL send a `DELETE /api/sales/:id` request with the admin JWT.
4. THE Sales_API SHALL expose a `DELETE /api/sales/:id` route accessible only to users with the `admin` role.
5. WHEN `DELETE /api/sales/:id` is called, THE Sales_API SHALL find the sale by its MongoDB `_id`, restore each item's stock in the Products_API by incrementing the product's stock field by the sold quantity, and then delete the sale document.
6. IF the sale with the given `_id` does not exist, THEN THE Sales_API SHALL return HTTP 404 with a descriptive error message.
7. IF a product referenced in the sale's items no longer exists in the database, THEN THE Sales_API SHALL skip restoring stock for that item and continue processing remaining items.
8. WHEN the void operation completes successfully, THE Admin_Dashboard SHALL remove the voided sale card from the Recent_Sales_List and refresh the dashboard statistics.

---

### Requirement 5: Sales Filter by Cashier

**User Story:** As an admin, I want to filter the Recent_Sales_List by cashier name, so that I can review the performance or activity of a specific cashier.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a cashier filter dropdown above the Recent_Sales_List.
2. WHEN the Recent_Sales_List is loaded, THE Admin_Dashboard SHALL populate the cashier dropdown with a default "All Cashiers" option plus one option per unique cashier name present in the loaded sales data.
3. WHEN a cashier is selected from the dropdown, THE Admin_Dashboard SHALL filter the Recent_Sales_List to display only sale cards whose `cashier` field matches the selected value.
4. WHEN "All Cashiers" is selected, THE Admin_Dashboard SHALL display all sale cards without filtering.
5. WHEN new sales data is loaded (e.g., on refresh), THE Admin_Dashboard SHALL rebuild the cashier dropdown options based on the newly loaded data.

---

### Requirement 6: Transactions Today Stat Card

**User Story:** As an admin, I want to see a count of today's transactions on the dashboard, so that I can quickly gauge the day's sales activity without scanning the report.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a fourth stat card in the Today's Performance stats row labelled "Transactions Today".
2. WHEN the Admin_Dashboard dashboard tab is loaded, THE Admin_Dashboard SHALL call `GET /api/sales/today-performance` and read the `transactionsToday` field from the response.
3. THE Admin_Dashboard SHALL display the `transactionsToday` value in the Transactions Today stat card.
4. WHILE the today-performance data is loading, THE Admin_Dashboard SHALL display "..." as a placeholder in the Transactions Today stat card.
5. IF the `GET /api/sales/today-performance` request fails, THEN THE Admin_Dashboard SHALL display "–" in the Transactions Today stat card.
