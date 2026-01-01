# MedBill - Medical Billing Software User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Billing Operations](#billing-operations)
5. [Inventory Management](#inventory-management)
6. [Purchase Management](#purchase-management)
7. [Customer Management](#customer-management)
8. [Reports](#reports)
9. [Settings](#settings)
10. [Troubleshooting](#troubleshooting)

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

---

*Last Updated: January 2025*  
*MedBill Version: 1.0.0*
