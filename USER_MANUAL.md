# MedBill - User Manual

> **Medical Billing & Inventory Management System**  
> Version 1.0 | For Pharmacy Staff & Administrators

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Billing - Creating Sales Bills](#3-billing---creating-sales-bills)
4. [Inventory Management](#4-inventory-management)
5. [Add Stock (Purchases)](#5-add-stock-purchases)
6. [Add New Medicines](#6-add-new-medicines)
7. [Running Bills](#7-running-bills)
8. [Sales Returns](#8-sales-returns)
9. [Customer Management](#9-customer-management)
10. [Reports](#10-reports)
11. [Settings](#11-settings)

---

## 1. Getting Started

### Login
1. Open the MedBill application
2. Enter your **Username** and **Password**
3. Click **Sign In**

### Navigation
- Use the **left sidebar** to navigate between pages
- Click the **menu icon (☰)** to collapse/expand the sidebar
- Your current user name appears at the bottom of the sidebar

---

## 2. Dashboard Overview

The dashboard shows your pharmacy's key metrics at a glance:

| Metric | Description |
|--------|-------------|
| **Today's Sales** | Total sales amount for today |
| **Monthly Sales** | Total sales for the current month |
| **Monthly Profit** | Profit margin for the month |
| **Pending Credits** | Outstanding customer credits (udhar) |
| **Expiring Soon** | Medicines expiring within 30 days |
| **Low Stock** | Items below reorder level |
| **Non-Moving** | Items not sold in 30 days |

### Charts (Admin Only)
- **Sales Trend**: Daily sales for the last 14 days
- **Payment Mode Split**: Breakdown by Cash/Online/Credit

---

## 3. Billing - Creating Sales Bills

### Step-by-Step:

1. Go to **Billing** page from sidebar
2. **Search for medicine**: Type medicine name in the search bar
3. **Select batch**: Click on the medicine to see available batches
4. **Enter quantity**: 
   - **Strips**: Enter number of strips
   - **Pieces**: Enter loose pieces (optional)
5. Click **Add to Cart** or press Enter
6. Repeat for more items

### Complete the Sale:

7. Select **Payment Mode**:
   - **Cash** - Full payment in cash
   - **Online** - UPI/Card payment
   - **Credit** - Customer credit (udhar)
   - **Split** - Combination of above

8. Click **Complete Sale (Ctrl+S)**
9. Bill will be printed automatically

### Schedule H/H1 Drugs
- If selling schedule drugs, click **Patient Details**
- Fill required fields: Patient Name, Age, Gender, Doctor Name, Prescription
- These drugs require prescription records

### Bill Rounding
- Bill totals are rounded to the nearest rupee
- Rounding rule: < 50 paisa = down, ≥ 50 paisa = up
- Example: ₹149.49 → ₹149, ₹149.50 → ₹150

---

## 4. Inventory Management

Go to **Inventory** from sidebar.

### View Stock
- See all current stock with batch-wise details
- Filter by category: All Stock, Expiring Soon, Low Stock, Non-Moving, Schedule Drugs, Other Products

### Table Columns
| Column | Description |
|--------|-------------|
| Medicine | Medicine name |
| Batch | Batch number |
| Expiry | Expiry date |
| Tablets/Units | Current quantity |
| Strips/Packs | Quantity in strips |
| MRP | Maximum Retail Price |
| Location | Rack/Box location |
| Status | Expiry status (OK/Warning/Expired) |

### Quick Actions
- Click any row to view details
- Click **Edit** to modify batch details
- Click the **dropdown** to adjust stock or delete

---

## 5. Add Stock (Purchases)

### Method 1: Quick Add Stock

1. Go to **Inventory** page
2. Click **+ Add Stock** button
3. Toggle between **Medicine** or **Non-Medicine**

#### For Medicines:
4. Search and select medicine from database
5. Enter batch details:
   - **Batch No**: Supplier's batch number
   - **Expiry Date**: Format DD/MM/YYYY
   - **Strips**: Number of strips purchased
   - **Tabs/Strip**: Tablets per strip
   - **Free (tabs)**: Bonus tablets (if any)
   - **Purchase Price**: Per strip price
   - **MRP**: Per strip MRP
   - **GST %**: Select 0%, 5%, 12%, or 18%
6. Click **Add to Cart**
7. Review summary and click **Save Stock**

#### For Non-Medicines (Other Products):
4. Fill in product details:
   - **Product Name**: Name of the product
   - **Category**: Product category
   - **Pack Size**: Units per pack
   - **Free (pcs)**: Bonus pieces
   - Other details same as medicine
5. Click **Add to Cart**
6. Review and **Save Stock**

### Method 2: Full Purchase Entry

1. Go to **Purchases** from sidebar
2. Click **New Purchase**
3. Select **Supplier**
4. Add items similar to Add Stock
5. Enter invoice details
6. Save purchase

---

## 6. Add New Medicines

### Adding to Master Database:

1. Go to **Inventory** page
2. Click **+ Add Medicine** button
3. Fill in details:
   - **Medicine Name** (required)
   - **Generic Name** (salt composition)
   - **Manufacturer** (company name)
   - **HSN Code** (default: 3004)
   - **Category** (Tablets, Syrup, etc.)
   - **Schedule** (H, H1, or None)
   - **Default GST Rate**
4. Click **Save Medicine**

> **Note**: Adding a medicine only creates it in the database. You must add stock separately to sell it.

---

## 7. Running Bills

Running Bills are for selling medicines that are NOT yet in stock. The bill is created immediately, and stock is reconciled later.

### Create Running Bill:

1. Go to **Running Bills** from sidebar
2. Click **New Running Bill**
3. Enter customer details (optional)
4. Add items:
   - **Medicine Name**: Type the name
   - **Qty (pcs)**: Quantity in pieces
   - **MRP/pc**: Price per piece (including GST)
   - **GST %**: Tax rate
5. Click **Create Bill**
6. Print the bill

### Reconcile Stock Later:

1. When stock arrives, find the pending running bill
2. Click **Stock** button
3. Search and select the matching batch
4. Click **Link & Deduct Stock**

---

## 8. Sales Returns

When a customer returns medicine:

### Process a Return:

1. Go to **Returns** from sidebar
2. Click **Sales Return** tab
3. Click **New Sales Return**
4. Enter the **Bill Number** and click **Search**
5. Select items to return:
   - Check the box next to each item
   - Enter return quantity
6. Select **Refund Mode** (Cash/Credit Note/Adjustment)
7. Add reason (optional)
8. Click **Process Return**

### What Happens:
- Stock is automatically restored to inventory
- Dashboard totals are adjusted (returns are subtracted)
- Return record is saved for reports

---

## 9. Customer Management

### Add New Customer:

1. Go to **Customers** from sidebar
2. Click **+ Add Customer**
3. Enter details:
   - Name (required)
   - Phone
   - Email
   - GSTIN (for B2B)
   - Credit Limit
4. Click **Save**

### Customer Credits (Udhar):

- View customer's current balance
- Click on a customer to see credit history
- Record payments: Click **Receive Payment**

---

## 10. Reports

Go to **Reports** from sidebar.

### Available Reports:

| Report | Description |
|--------|-------------|
| **Sales Report** | Daily/Monthly sales with GST breakdown |
| **Purchase Report** | Stock purchases and expenses |
| **GST Report** | GSTR-1 compatible tax summary |
| **Stock Report** | Current inventory valuation |
| **Expiry Report** | Medicines expiring soon |
| **Credit Report** | Outstanding customer dues |

### Export Options:
- **Print** - Open print dialog
- **Excel** - Download as .xlsx
- **PDF** - Save as PDF

---

## 11. Settings

Go to **Settings** from sidebar.

### Shop Details:
- Shop Name
- Address
- Phone Number
- GSTIN
- Drug License Number

### Billing Settings:
- Bill Prefix (e.g., INV)
- Financial Year
- Printer Type (Thermal/A4/Dot Matrix)
- Auto-print on sale

### User Management (Admin Only):
- Add/Edit staff users
- Set permissions
- Reset passwords

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Complete Sale (in Billing) |
| `Enter` | Add item to cart |
| `Esc` | Close modal/dialog |

### GST Rates

| Medicine Type | GST Rate |
|---------------|----------|
| Essential medicines | 5% |
| General medicines | 12% |
| Vitamins, supplements | 18% |
| Exempt items | 0% |

### Stock Units

- **Strips**: Full strips of tablets
- **Pieces/Tabs**: Individual tablets/pieces
- **Pack Size**: Units per pack (for non-medicines)

---

## Support

For technical support, contact your software provider.

---

*Last Updated: January 2026*
