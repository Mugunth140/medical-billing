# MedBill - Medical Billing Software User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Billing Operations](#billing-operations)
5. [Running Bills (Non-Stock Items)](#running-bills-non-stock-items)
6. [Returns Management](#returns-management)
7. [Inventory Management](#inventory-management)
8. [Purchase Management](#purchase-management)
9. [Supplier Management](#supplier-management)
10. [Customer Management](#customer-management)
11. [Reports](#reports)
12. [Printing & Exporting](#printing--exporting)
13. [Settings](#settings)
14. [Application Workflow](#application-workflow)
15. [Data Flow Architecture](#data-flow-architecture)
16. [Troubleshooting](#troubleshooting)

---

## Introduction

MedBill is a comprehensive medical billing and inventory management software designed specifically for medical stores and pharmacies. It helps you manage:

- **Day-to-day billing** with GST compliance
- **Inventory tracking** with batch management and expiry alerts
- **Schedule H/H1 drug records** with patient details for regulatory compliance
- **Purchase management** for stock replenishment
- **Customer management** for loyalty programs
- **Comprehensive reports** for business insights

---

## Getting Started

### First-Time Setup

1. **Launch the Application**: Double-click the MedBill icon on your desktop
2. **Login**: Enter your username and password (default: admin/admin)
3. **Configure Shop Details**: Go to Settings → Shop Details and enter your:
   - Shop Name
   - Address
   - Phone Number
   - Email
   - GSTIN (15 characters)
   - Drug License Numbers

### Main Navigation

The left sidebar provides access to all modules:

| Icon | Module | Purpose |
|------|--------|---------|
| 🏠 | Dashboard | Overview of sales, alerts, and quick stats |
| 🛒 | Billing | Create new bills and process sales |
| 📋 | Bill History | View and reprint past bills |
| 📦 | Inventory | Manage medicines and stock |
| 🛍️ | Purchases | Record stock purchases |
| 👥 | Customers | Manage customer database |
| 📊 | Reports | View business reports |
| ⚙️ | Settings | Configure application settings |

---

## Dashboard Overview

The dashboard provides a quick snapshot of your business:

### Key Metrics
- **Today's Sales**: Total sales amount for today
- **Today's Bills**: Number of bills generated today
- **Low Stock Items**: Count of items below minimum stock level
- **Expiring Soon**: Items expiring within 90 days

### Quick Actions
- **New Bill**: Start a new billing session
- **Add Stock**: Quick access to purchase entry
- **View Reports**: Jump to reports section

### Alerts Section
- **Expiry Alerts**: Medicines expiring soon (highlighted in red/orange)
- **Stock Alerts**: Items that need reordering

---

## Billing Operations

### Creating a New Bill

1. **Navigate to Billing**: Click the Billing icon in the sidebar
2. **Search for Medicine**: 
   - Type the medicine name in the search box
   - Results show available batches with stock and expiry
3. **Select Batch**: Click on the desired batch to add to cart
4. **Enter Quantity**: 
   - Enter number of strips/units
   - Or enter individual pieces (tablets)
5. **Apply Discount** (Optional):
   - Enter discount percentage or amount
6. **Repeat** for additional items

### Cart Management

| Action | How To |
|--------|--------|
| Remove Item | Click the ❌ button next to the item |
| Change Quantity | Edit the quantity field directly |
| Clear Cart | Click "Clear All" button |

### Handling Schedule H/H1 Drugs

**Important**: Schedule H and H1 drugs require patient details for regulatory compliance.

When you add a Schedule H/H1 drug to the cart:

1. **Patient Details Card** appears automatically
2. **Required Information**:
   - Patient Name (mandatory)
   - Age (mandatory)
   - Gender (mandatory - Male/Female/Other)
3. **Optional Information**:
   - Phone Number
   - Address
   - Doctor's Name
   - Prescription Number

> ⚠️ **You cannot save a bill with Schedule H/H1 drugs without entering patient details!**

### Completing the Sale

1. **Select Customer** (or leave as "Walk-in Customer")
2. **Verify Total Amount**: Check subtotal, GST, and grand total
3. **Select Payment Mode**:
   - Cash
   - Card
   - UPI
   - Credit (if customer has credit limit)
4. **Enter Amount Received** (for cash payments)
5. **Click Save Bill**: Bill is generated and printed

### Bill Types and Prefixes

Bills are automatically numbered with your configured prefix:
- Example: `MED-0001`, `MED-0002`, etc.

---

## Running Bills (Non-Stock Items)

### What are Running Bills?

Running Bills are a special feature for handling medicines that are **not currently in stock** but the customer needs immediately. This is common when:

- A customer requests a medicine you don't stock
- The medicine is out of stock but you can arrange it
- You're waiting for a stock delivery but want to bill now

### How Running Bills Work

```
┌─────────────────────────────────────────────────────────────────┐
│                    RUNNING BILL WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Customer Request  ───►  2. Create Running Bill              │
│         │                          │                            │
│         ▼                          ▼                            │
│  Medicine NOT in stock      Enter medicine name, qty, price    │
│                                    │                            │
│                                    ▼                            │
│                            3. Bill Generated (PENDING)          │
│                                    │                            │
│                                    ▼                            │
│                            4. Stock Arrives                     │
│                                    │                            │
│                                    ▼                            │
│                            5. Link to Batch & Mark STOCKED      │
│                                    │                            │
│                                    ▼                            │
│                            6. Inventory Updated                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Creating a Running Bill

1. **Navigate to Running Bills**: Click "Running Bills" in the sidebar
2. **Click "Add Running Bill"**
3. **Enter Medicine Details**:
   - Medicine Name (as the customer describes it)
   - Quantity required
   - Unit Price (estimated or agreed upon)
   - GST Rate (usually 12% for medicines)
   - Notes (optional - e.g., "Urgent for patient")
4. **Select Customer** (optional)
5. **Click Save**

The system creates a bill with status **PENDING**.

### Managing Running Bills

#### Viewing Running Bills
The Running Bills page shows:
- **Pending**: Items still waiting for stock
- **Stocked**: Items that have been linked to inventory
- **Cancelled**: Cancelled running bills

#### Linking to Stock (When Medicine Arrives)

1. Go to **Purchases** → Add the medicine to your stock first
2. Return to **Running Bills**
3. Find the pending running bill
4. Click **"Link to Stock"**
5. Search and select the matching medicine/batch
6. The running bill status changes to **STOCKED**
7. Inventory is automatically deducted

#### Printing Running Bills

Each running bill can be printed in two formats:
- **Thermal (80mm)**: For receipt printers
- **Legal Paper**: For detailed invoices

#### Cancelling a Running Bill

1. Find the pending running bill
2. Click the **Cancel** button
3. Confirm cancellation
4. Status changes to **CANCELLED**

### Running Bill Best Practices

✅ **DO**:
- Record the customer's contact info for follow-up
- Note the expected delivery date
- Link to stock as soon as medicine arrives
- Print receipt for customer reference

❌ **DON'T**:
- Leave running bills pending indefinitely
- Forget to link to actual stock
- Create running bills for regularly stocked items

---

## Returns Management

MedBill supports two types of returns:

1. **Sales Returns**: Customer returns medicine to pharmacy
2. **Supplier Returns**: Pharmacy returns medicine to supplier

### Accessing Returns

Navigate via sidebar:
- **Returns** → **Sales Returns** (for customer returns)
- **Returns** → **Supplier Returns** (for supplier returns)

Or use direct navigation from the sidebar's Returns group.

---

### Sales Returns (Customer → Pharmacy)

#### When to Process a Sales Return

- Customer brings back unused medicines
- Dispensing error (wrong medicine given)
- Product quality issues
- Expired medicine sold by mistake

#### Step-by-Step: Processing a Sales Return

```
┌─────────────────────────────────────────────────────────────────┐
│                  SALES RETURN WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Customer brings medicine back                               │
│         │                                                       │
│         ▼                                                       │
│  2. Find Original Bill                                          │
│     └─► Search by bill number or date                          │
│         │                                                       │
│         ▼                                                       │
│  3. Select Items to Return                                      │
│     └─► Choose which items from the bill                       │
│     └─► Enter return quantity                                   │
│         │                                                       │
│         ▼                                                       │
│  4. Select Return Reason                                        │
│     ├─► EXPIRY: Product expired                                │
│     ├─► DAMAGE: Product damaged                                │
│     ├─► WRONG_ITEM: Wrong medicine given                       │
│     └─► OTHER: Other reasons                                   │
│         │                                                       │
│         ▼                                                       │
│  5. Choose Refund Mode                                          │
│     ├─► CASH: Cash refund to customer                          │
│     ├─► CREDIT_NOTE: Add to customer credit                    │
│     └─► ADJUSTMENT: Adjust against future purchase             │
│         │                                                       │
│         ▼                                                       │
│  6. Process Return                                              │
│     └─► Stock restored automatically                           │
│     └─► Customer credited/refunded                              │
│     └─► Return record created                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Creating a Sales Return

1. **Go to Returns → Sales Returns**
2. **Click "New Sales Return"**
3. **Search for Original Bill**:
   - Enter bill number (e.g., INV-2425-00001)
   - Or search by customer name
   - Or search by date range
4. **Select the Bill** from search results
5. **Select Items to Return**:
   - Check the items being returned
   - Enter the return quantity for each
6. **Select Reason**:
   - Expiry
   - Damage
   - Overstock
   - Other (with notes)
7. **Choose Refund Mode**:
   - Cash Refund
   - Credit Note
   - Adjustment
8. **Add Notes** (optional)
9. **Click "Process Return"**

#### What Happens After a Sales Return

| Action | Result |
|--------|--------|
| Stock Restored | Returned quantity added back to batch |
| Refund Processed | Based on selected refund mode |
| Return Record | Saved for audit trail |
| Customer Balance | Updated if using credit/adjustment |

#### Viewing Sales Return History

The Sales Returns tab shows:
- Return Number (auto-generated)
- Original Bill Number
- Customer Name
- Return Date
- Reason
- Amount
- Status

---

### Supplier Returns (Pharmacy → Supplier)

#### When to Process a Supplier Return

- Medicines received damaged
- Near-expiry stock (return to supplier)
- Wrong order received
- Expired medicines in stock
- Quality issues discovered

#### Step-by-Step: Processing a Supplier Return

```
┌─────────────────────────────────────────────────────────────────┐
│                 SUPPLIER RETURN WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Identify items to return to supplier                        │
│         │                                                       │
│         ▼                                                       │
│  2. Select Supplier                                             │
│     └─► Choose from active suppliers                           │
│         │                                                       │
│         ▼                                                       │
│  3. Select Batches to Return                                    │
│     └─► View batches from this supplier                        │
│     └─► Select items and quantities                            │
│         │                                                       │
│         ▼                                                       │
│  4. Choose Return Reason                                        │
│     ├─► EXPIRY: Near or past expiry                            │
│     ├─► DAMAGE: Damaged in transit/storage                     │
│     ├─► WRONG_ORDER: Not what was ordered                      │
│     └─► OTHER: Other reasons                                   │
│         │                                                       │
│         ▼                                                       │
│  5. Process Supplier Return                                     │
│     └─► Stock deducted from inventory                          │
│     └─► Supplier credit note expected                           │
│     └─► Return record created                                   │
│         │                                                       │
│         ▼                                                       │
│  6. Follow up with Supplier                                     │
│     └─► Get credit note or replacement                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Creating a Supplier Return

1. **Go to Returns → Supplier Returns**
2. **Click "New Supplier Return"**
3. **Select Supplier**:
   - Search by supplier name
   - View supplier's batches in your inventory
4. **Select Batches to Return**:
   - View all batches from this supplier
   - Check items to return
   - Enter return quantity
5. **Select Reason**:
   - Expiry
   - Damage
   - Wrong Order
   - Other
6. **Add Notes** (e.g., "Return pickup scheduled for Monday")
7. **Click "Process Return"**

#### What Happens After a Supplier Return

| Action | Result |
|--------|--------|
| Stock Deducted | Returned quantity removed from inventory |
| Return Record | Created with unique return number |
| Supplier Account | Flagged for credit adjustment |
| Status | Initially "PENDING" until supplier confirms |

#### Supplier Return Statuses

| Status | Meaning |
|--------|---------|
| PENDING | Return initiated, awaiting supplier pickup |
| APPROVED | Supplier confirmed the return |
| COMPLETED | Credit note received or replacement sent |
| REJECTED | Supplier rejected the return |

---

### Returns Best Practices

#### For Sales Returns
✅ Always verify the original bill before processing  
✅ Check product condition and packaging  
✅ Record accurate reason for compliance  
✅ Issue receipt/credit note to customer  
✅ Keep returned products separate until processed  

#### For Supplier Returns
✅ Document damage with photos if applicable  
✅ Contact supplier before initiating return  
✅ Keep track of expected credit notes  
✅ Follow up on pending returns weekly  
✅ Match credit notes with return records  

---

## Inventory Management

### Viewing Inventory

Navigate to Inventory to see:
- All medicines with current stock
- Batch details and expiry dates
- GST rates and HSN codes
- Schedule H/H1 indicators

### Adding a New Medicine

1. Click **"Add Medicine"** button
2. Fill in the details:
   - **Medicine Name** (required)
   - **HSN Code** (for GST classification)
   - **Category** (Tablet, Capsule, Syrup, etc.)
   - **GST Rate** (5%, 12%, 18%)
   - **Taxability** (Taxable, Exempt, Nil Rated)
   - **Manufacturer**
   - **Schedule H/H1 Drug** ✓ (Check if controlled substance)

3. Click **Save**

### Understanding Schedule H/H1 Drugs

Schedule H and H1 drugs are controlled substances that require:
- Prescription from a registered medical practitioner
- Patient details recording at the time of sale
- Separate register maintenance for regulatory inspection

When adding a new medicine, check the **"Schedule H/H1 Drug"** checkbox if it falls under:
- Schedule H: Tranquilizers, antibiotics, etc.
- Schedule H1: Narcotic substances with higher control

### Stock Management

#### Adding Stock (via Purchase)
1. Go to Purchases → Add Purchase
2. Select supplier and enter invoice details
3. Add medicine items with batch details:
   - Batch Number
   - Manufacturing Date
   - Expiry Date
   - Quantity
   - Purchase Rate
   - MRP (Maximum Retail Price)

#### Stock Adjustments
- View current stock levels in Inventory
- Adjust for damages or losses through manual adjustment

---

## Purchase Management

### Recording a New Purchase

1. Navigate to **Purchases**
2. Click **"Add Purchase"**
3. Enter purchase details:
   - **Supplier**: Select from existing or add new
   - **Invoice Number**: Supplier's invoice number
   - **Invoice Date**: Date on supplier's invoice
   - **Payment Status**: Paid/Pending/Partial

4. Add items:
   - Search and select medicine
   - Enter batch details
   - Enter quantity and rates

5. Click **Save Purchase**

### Viewing Purchase History

The Purchases page shows:
- All purchase records
- Invoice details
- Payment status
- Total amounts

---

## Customer Management

### Adding a Customer

1. Go to **Customers**
2. Click **"Add Customer"**
3. Enter details:
   - Name
   - Phone Number
   - Email (optional)
   - Address
   - GSTIN (for B2B customers)
   - Credit Limit (for credit sales)

### Customer Benefits

- **Credit Sales**: Allow customers to buy on credit
- **Bill History**: View all bills for a customer
- **Quick Billing**: Auto-fill customer details in billing

---

## Reports

MedBill provides comprehensive reports for business analysis:

### Available Reports

| Report | Description |
|--------|-------------|
| **Sales Report** | Daily/weekly/monthly sales summary |
| **Purchase Report** | Purchase history and supplier analysis |
| **Stock Report** | Current inventory levels |
| **Expiry Report** | Items expiring within selected period |
| **GST Report** | GST liability and input credit |
| **Scheduled Drugs Report** | Patient register for Schedule H/H1 sales |

### Scheduled Drugs Report (Special)

This report is **mandatory for regulatory compliance**. It shows:

- Date and time of sale
- Bill number
- Patient details (name, age, gender, address)
- Medicine name and quantity
- Prescribing doctor
- Prescription number

**How to use:**
1. Go to Reports → **Scheduled Drugs**
2. Select date range
3. View or export the register
4. Keep printed copies for regulatory inspection

### Exporting Reports

All reports can be:
- **Printed** directly
- **Exported to Excel** for further analysis
- **Exported to PDF** for sharing

---

## Printing & Exporting

### Bill Printing Options

MedBill supports multiple printing formats:

#### Thermal Printing (80mm Receipt)
- Compact format for receipt printers
- Quick and economical
- Ideal for regular customer bills

#### Legal Paper Printing
- Detailed format with full GST breakdown
- Professional invoice appearance
- Amount in words included
- Suitable for:
  - B2B customers needing detailed invoices
  - GST compliance records
  - Customer copies

### How to Print Bills

1. **From Billing**: After saving a bill, choose print option
2. **From Bill History**:
   - Find the bill
   - Click the Print dropdown
   - Select "Thermal (80mm)" or "Legal Paper"

### Report Export Options

All reports support:

| Format | Use Case |
|--------|----------|
| **Print** | Direct printing for records |
| **PDF** | Opens in browser for Save As PDF |
| **HTML** | Download as HTML file |

### Print Tips

- Ensure printer is connected before printing
- For thermal printers, install proper drivers
- Test print alignment with sample bill first
- Use "Save as PDF" option in browser for digital copies

---

## Supplier Management

### Accessing Supplier Management

Navigate to: **Purchases** → **Supplier Management**

### Adding a New Supplier

1. Click **"Add Supplier"**
2. Enter supplier details:
   - **Company Name** (required)
   - **Contact Person**
   - **Phone Number**
   - **Email**
   - **GSTIN** (for GST input credit)
   - **Address**
   - **City, State, PIN**
   - **Payment Terms** (default: 30 days)
3. Click **Save**

### Supplier Information Uses

| Feature | How Supplier Data is Used |
|---------|---------------------------|
| Purchases | Select supplier for stock entries |
| Batch Linking | Each batch links to its supplier |
| Returns | Process returns to specific supplier |
| Reports | Analyze purchases by supplier |
| Payments | Track payment terms and dues |

### Batch-Supplier Linking

When you add stock through Purchases:
- Each batch is linked to the supplier
- Enables supplier-specific returns
- Tracks purchase history per supplier
- Helps identify best price suppliers

---

## Settings

### Shop Details

Configure your pharmacy information:
- Shop Name
- Address (Line 1, Line 2, City, State, PIN)
- Contact (Phone, Email)
- GSTIN (15-digit GST number)
- Drug License Numbers (DL, State Drug License)

### Billing Settings

Customize billing behavior:
- **Bill Prefix**: Prefix for bill numbers (e.g., "MED-")
- **Default GST Rate**: Applied to new medicines
- **Low Stock Alert Threshold**: When to show stock warnings
- **Enable Discounts**: Allow discounts on bills
- **Require Customer for Bills**: Force customer selection

### User Management

- View existing users
- Add new users with roles
- Reset passwords

### Backup & Restore

- **Backup Database**: Create a backup of all data
- **Restore Database**: Restore from a previous backup

> 💡 **Tip**: Take regular backups to prevent data loss!

---

## Application Workflow

### Daily Operations Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY WORKFLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MORNING                                                        │
│  ────────                                                       │
│  1. Login to MedBill                                           │
│  2. Check Dashboard for alerts                                 │
│     └─► Low stock warnings                                     │
│     └─► Expiring items                                         │
│  3. Review pending running bills                               │
│                                                                 │
│  DURING THE DAY                                                 │
│  ──────────────                                                │
│  4. Process customer bills                                     │
│     └─► Regular bills for stocked items                        │
│     └─► Running bills for non-stock items                      │
│  5. Handle Schedule H/H1 drugs (with patient details)          │
│  6. Process any returns                                        │
│                                                                 │
│  WHEN STOCK ARRIVES                                            │
│  ──────────────────                                            │
│  7. Create Purchase entry                                      │
│  8. Link pending running bills to new stock                    │
│                                                                 │
│  END OF DAY                                                     │
│  ──────────                                                     │
│  9. Review daily sales in Dashboard                            │
│  10. Check pending payments                                    │
│  11. Generate end-of-day report if needed                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stock Replenishment Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              STOCK REPLENISHMENT WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Check Low Stock Items (Dashboard or Inventory)             │
│         │                                                       │
│         ▼                                                       │
│  2. Place order with supplier                                  │
│         │                                                       │
│         ▼                                                       │
│  3. Receive stock delivery                                     │
│         │                                                       │
│         ▼                                                       │
│  4. Go to Purchases → Stock Entry                              │
│         │                                                       │
│         ▼                                                       │
│  5. Select supplier, enter invoice details                     │
│         │                                                       │
│         ▼                                                       │
│  6. Add items with batch info:                                 │
│     ├─► Batch Number                                           │
│     ├─► Expiry Date                                            │
│     ├─► Quantity                                               │
│     ├─► Purchase Price                                         │
│     ├─► MRP                                                    │
│     └─► Selling Price                                          │
│         │                                                       │
│         ▼                                                       │
│  7. Save Purchase                                              │
│         │                                                       │
│         ▼                                                       │
│  8. Stock automatically updated in Inventory                   │
│         │                                                       │
│         ▼                                                       │
│  9. Check Running Bills for items to link                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### End-to-End Billing Scenario

```
Customer walks in with prescription
         │
         ▼
┌───────────────────────────────────────┐
│  Is medicine in stock?                │
└───────────────────────────────────────┘
         │
    ┌────┴────┐
   YES        NO
    │          │
    ▼          ▼
┌─────────┐  ┌──────────────────────┐
│ Regular │  │ Create Running Bill  │
│ Billing │  │ (for later delivery) │
└─────────┘  └──────────────────────┘
    │                   │
    ▼                   ▼
┌─────────────────┐  Customer pays/
│ Is it Schedule  │  gets receipt
│ H/H1 Drug?      │       │
└─────────────────┘       │
    │                     │
   YES                    │
    │                     │
    ▼                     │
Enter patient details     │
(Name, Age, Gender,       │
Doctor, Prescription)     │
    │                     │
    ▼                     │
Complete billing ◄────────┘
    │
    ▼
Print receipt (Thermal/Legal)
    │
    ▼
Done!
```

---

## Data Flow Architecture

### How Data Flows Through MedBill

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW DIAGRAM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                              │
│  │   SUPPLIERS  │                                              │
│  └──────┬───────┘                                              │
│         │ Supply medicines                                     │
│         ▼                                                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │  PURCHASES   │────►│   BATCHES    │────►│  INVENTORY   │   │
│  │  (Stock In)  │     │ (with expiry,│     │  (Medicine   │   │
│  └──────────────┘     │  supplier)   │     │   Stock)     │   │
│                       └──────────────┘     └──────┬───────┘   │
│                              │                    │            │
│                              │                    ▼            │
│                              │            ┌──────────────┐     │
│                              │            │   BILLING    │     │
│                              │            │  (Sales Out) │     │
│                              │            └──────┬───────┘     │
│                              │                   │             │
│                              │                   ▼             │
│                              │     ┌─────────────────────────┐ │
│                              │     │        BILLS            │ │
│                              │     │  ┌─────────────────┐    │ │
│                              │     │  │   BILL ITEMS    │    │ │
│                              │     │  └─────────────────┘    │ │
│                              │     │  ┌─────────────────┐    │ │
│                              │     │  │ SCHEDULED DRUG  │    │ │
│                              │     │  │    RECORDS      │    │ │
│                              │     │  └─────────────────┘    │ │
│                              │     └─────────────────────────┘ │
│                              │                   │             │
│                              ▼                   ▼             │
│                       ┌──────────────┐   ┌──────────────┐     │
│                       │  SUPPLIER    │   │    SALES     │     │
│                       │  RETURNS     │   │   RETURNS    │     │
│                       │(Pharmacy→    │   │ (Customer→   │     │
│                       │  Supplier)   │   │   Pharmacy)  │     │
│                       └──────────────┘   └──────────────┘     │
│                                                                │
│  ┌──────────────┐                        ┌──────────────┐     │
│  │  CUSTOMERS   │───────Credit Sales────►│   CREDITS    │     │
│  └──────────────┘                        └──────────────┘     │
│                                                                │
│  ┌──────────────┐                                              │
│  │ RUNNING BILLS│───── When stock arrives, links to ─────┐    │
│  │  (Pending)   │        BATCHES and completes sale       │    │
│  └──────────────┘                                         │    │
│         │                                                 │    │
│         ▼                                                 │    │
│  ┌──────────────┐                                         │    │
│  │ RUNNING BILLS│◄────────────────────────────────────────┘    │
│  │  (Stocked)   │                                              │
│  └──────────────┘                                              │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Database Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `medicines` | Master list of medicines | → batches |
| `batches` | Stock batches with expiry | → medicines, suppliers |
| `suppliers` | Supplier master | → purchases, batches |
| `customers` | Customer master | → bills, credits |
| `purchases` | Stock-in records | → suppliers, purchase_items |
| `bills` | Sales records | → customers, bill_items |
| `bill_items` | Items in each bill | → bills, batches |
| `scheduled_medicine_records` | H/H1 drug patient records | → bills, bill_items |
| `running_bills` | Non-stock item sales | → bills |
| `credits` | Customer credit transactions | → customers, bills |
| `sales_returns` | Customer return records | → bills |
| `supplier_returns` | Supplier return records | → suppliers |

### Quantity Display: Strips vs Pieces

MedBill displays quantities in a user-friendly format:

```
Total Pieces = 25
Tablets per Strip = 10

Display: "2 strips + 5 pcs" (or "2S + 5P" in compact mode)
```

This helps pharmacists quickly understand stock levels and dispense accurately.

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Failed to clear database"
**Solution**: This has been fixed. The application now handles missing tables gracefully.

#### 2. Cannot save bill with Schedule H/H1 drugs
**Solution**: You must enter patient details (Name, Age, Gender) when selling scheduled drugs. Fill in the patient information form that appears.

#### 3. Search not finding medicine
**Solution**: 
- Check spelling
- Search by first few letters
- Ensure medicine is added in Inventory

#### 4. Bill print not working
**Solution**:
- Check printer connection
- Ensure correct printer is selected in settings
- Try restarting the application

#### 5. Stock showing negative
**Solution**:
- Check for duplicate bill entries
- Verify purchase quantities
- Contact support if issue persists

### Getting Help

For technical support:
- Check Settings → About for version information
- Contact your system administrator
- Email: support@yourdomain.com

---

## Quick Reference Card

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Bill |
| `Ctrl + S` | Save Bill |
| `Ctrl + P` | Print |
| `Ctrl + F` | Search |
| `Escape` | Cancel/Close |

### GST Quick Reference

| HSN Code | Description | Rate |
|----------|-------------|------|
| 3004 | Medicaments | 12% |
| 3002 | Vaccines | 5% |
| 9018 | Medical Equipment | 12% |

### Bill Payment Modes

| Mode | Description |
|------|-------------|
| Cash | Cash payment |
| Card | Debit/Credit card |
| UPI | UPI payment (PhonePe, GPay, etc.) |
| Credit | Customer credit account |

### Return Reasons Quick Reference

| Reason | When to Use |
|--------|-------------|
| EXPIRY | Product expired or near expiry |
| DAMAGE | Product damaged (broken, leaking, etc.) |
| WRONG_ITEM | Wrong medicine dispensed |
| OVERSTOCK | Excess stock being returned to supplier |
| OTHER | Any other reason (specify in notes) |

### Running Bill Status Guide

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| PENDING | Waiting for stock | Link when stock arrives |
| STOCKED | Linked to inventory | None - completed |
| CANCELLED | Bill cancelled | None - closed |

---

## Appendix

### A. Schedule H/H1 Compliance Checklist

✅ Mark medicines as Schedule H/H1 in Inventory  
✅ Collect patient details for every sale  
✅ Record prescribing doctor's name  
✅ Maintain prescription numbers  
✅ Generate monthly Scheduled Drugs report  
✅ Keep printed records for 3 years  

### B. GST Compliance Checklist

✅ Enter correct GSTIN in Shop Settings  
✅ Use proper HSN codes for all medicines  
✅ Generate monthly GST reports  
✅ Maintain B2B invoice records  
✅ File returns based on generated reports  

### C. Returns Processing Checklist

#### Sales Returns
✅ Verify original bill exists  
✅ Check product condition  
✅ Confirm return is within policy period  
✅ Record accurate return reason  
✅ Process appropriate refund mode  
✅ Ensure stock is restored to correct batch  
✅ Provide return receipt to customer  

#### Supplier Returns
✅ Contact supplier before initiating return  
✅ Document product condition (photos if needed)  
✅ Create return record in system  
✅ Package items properly for return  
✅ Get acknowledgment from supplier  
✅ Follow up for credit note  
✅ Match credit note with return record  

### D. Daily Closing Checklist

✅ Review all pending running bills  
✅ Check for unprocessed returns  
✅ Verify cash drawer matches system  
✅ Review expiry alerts for action  
✅ Check low stock items for reorder  
✅ Generate daily sales summary if needed  

### E. Common Schedule H/H1 Drugs

| Category | Examples |
|----------|----------|
| Anxiolytics | Alprazolam, Diazepam, Lorazepam |
| Anticonvulsants | Clonazepam, Phenobarbitone |
| Opioid Analgesics | Tramadol, Codeine, Morphine |
| Hypnotics | Zolpidem, Nitrazepam |

> ⚠️ Always verify with current drug schedules as classifications may change.

---

*Last Updated: January 2026*  
*MedBill Version: 1.0.0*
