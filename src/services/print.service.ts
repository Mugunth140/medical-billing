// =====================================================
// Print Service
// Handles printing bills, reports, and PDFs
// Supports both thermal (80mm) and legal paper formats
// =====================================================

import type { Bill, BillItem } from '../types';
import { convertToUnits, formatCurrency, formatDate } from '../utils';
import { query } from './database';

// =====================================================
// TYPES
// =====================================================

interface ShopInfo {
    shop_name: string;
    shop_address: string;
    shop_phone: string;
    shop_gstin: string;
    shop_drug_license: string;
    shop_state: string;
}

interface PrintOptions {
    paperSize: 'thermal' | 'a4' | 'legal';
    showGstBreakdown?: boolean;
    showPatientDetails?: boolean;
    copies?: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getShopInfo(): Promise<ShopInfo> {
    const settings = await query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key LIKE 'shop_%'`,
        []
    );

    const shopInfo: ShopInfo = {
        shop_name: 'Medical Store',
        shop_address: '',
        shop_phone: '',
        shop_gstin: '',
        shop_drug_license: '',
        shop_state: 'Tamil Nadu'
    };

    settings.forEach(s => {
        if (s.key in shopInfo) {
            (shopInfo as unknown as Record<string, string>)[s.key] = s.value;
        }
    });

    return shopInfo;
}

function numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convertGroup = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '');
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    let result = '';

    if (rupees >= 10000000) {
        result += convertGroup(Math.floor(rupees / 10000000)) + ' Crore ';
        num = rupees % 10000000;
    }
    if (rupees >= 100000) {
        result += convertGroup(Math.floor((rupees % 10000000) / 100000)) + ' Lakh ';
    }
    if (rupees >= 1000) {
        result += convertGroup(Math.floor((rupees % 100000) / 1000)) + ' Thousand ';
    }
    if (rupees >= 100) {
        result += convertGroup(Math.floor((rupees % 1000) / 100)) + ' Hundred ';
    }
    if (rupees % 100 > 0) {
        result += convertGroup(rupees % 100);
    }

    result = result.trim() + ' Rupees';
    if (paise > 0) {
        result += ' and ' + convertGroup(paise) + ' Paise';
    }
    result += ' Only';

    return result;
}

// =====================================================
// BILL PRINTING - LEGAL SIZE (8.5" x 14")
// =====================================================

export async function generateLegalBillHTML(bill: Bill, items: BillItem[]): Promise<string> {
    const shopInfo = await getShopInfo();

    // Group items by GST rate for GST summary
    const gstBreakdown = items.reduce((acc, item) => {
        const rate = item.gst_rate || 12;
        if (!acc[rate]) {
            acc[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
        }
        acc[rate].taxable += item.taxable_amount || item.taxable_value || 0;
        acc[rate].cgst += item.cgst_amount || item.cgst || 0;
        acc[rate].sgst += item.sgst_amount || item.sgst || 0;
        acc[rate].total += (item.cgst_amount || item.cgst || 0) + (item.sgst_amount || item.sgst || 0);
        return acc;
    }, {} as Record<number, { taxable: number; cgst: number; sgst: number; total: number }>);

    const itemRows = items.map((item, index) => {
        const qty = item.quantity || 0;
        const tps = item.tablets_per_strip || 10;
        const units = convertToUnits(qty, tps);

        return `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>
                    <strong>${item.medicine_name}</strong><br>
                    <small style="color: #666;">Batch: ${item.batch_number}</small>
                </td>
                <td style="text-align: center;">${item.hsn_code}</td>
                <td style="text-align: center;">${formatDate(item.expiry_date || '')}</td>
                <td style="text-align: right;">${qty}</td>
                <td style="text-align: center;">${units.displayShort}</td>
                <td style="text-align: right;">${formatCurrency(item.unit_price || 0)}</td>
                <td style="text-align: center;">${item.gst_rate}%</td>
                <td style="text-align: right;">${formatCurrency(item.discount_amount || 0)}</td>
                <td style="text-align: right;"><strong>${formatCurrency(item.total || item.total_amount || 0)}</strong></td>
            </tr>
        `;
    }).join('');

    const gstRows = Object.entries(gstBreakdown).map(([rate, values]) => `
        <tr>
            <td style="text-align: center;">${rate}%</td>
            <td style="text-align: right;">${formatCurrency(values.taxable)}</td>
            <td style="text-align: right;">${formatCurrency(values.cgst)}</td>
            <td style="text-align: right;">${formatCurrency(values.sgst)}</td>
            <td style="text-align: right;">${formatCurrency(values.total)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${bill.bill_number}</title>
    <style>
        @page {
            size: legal;
            margin: 10mm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
        }
        
        .invoice-container {
            max-width: 100%;
            padding: 10px;
        }
        
        /* Header Styles */
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1e8eb4;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }
        
        .shop-info {
            flex: 1;
        }
        
        .shop-name {
            font-size: 24px;
            font-weight: bold;
            color: #1e8eb4;
            margin-bottom: 5px;
        }
        
        .shop-details {
            font-size: 11px;
            color: #666;
        }
        
        .shop-details div {
            margin-bottom: 2px;
        }
        
        .invoice-title-section {
            text-align: right;
        }
        
        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #1e8eb4;
            margin-bottom: 10px;
        }
        
        .invoice-meta {
            font-size: 12px;
        }
        
        .invoice-meta div {
            margin-bottom: 3px;
        }
        
        .invoice-number {
            font-size: 16px;
            font-weight: bold;
            color: #333;
        }
        
        /* Bill To Section */
        .bill-to {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 15px;
        }
        
        .bill-to-title {
            font-weight: bold;
            color: #1e8eb4;
            margin-bottom: 5px;
            font-size: 12px;
        }
        
        .customer-name {
            font-size: 14px;
            font-weight: 600;
        }
        
        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10px;
        }
        
        .items-table th {
            background: #1e8eb4;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 10px;
        }
        
        .items-table td {
            padding: 6px;
            border-bottom: 1px solid #e9ecef;
            vertical-align: top;
        }
        
        .items-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        /* Totals Section */
        .totals-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        
        .gst-table {
            width: 48%;
            border-collapse: collapse;
            font-size: 10px;
        }
        
        .gst-table th {
            background: #f8f9fa;
            padding: 6px;
            text-align: left;
            border: 1px solid #dee2e6;
            font-weight: 600;
        }
        
        .gst-table td {
            padding: 6px;
            border: 1px solid #dee2e6;
        }
        
        .summary-table {
            width: 45%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        .summary-table td {
            padding: 6px 10px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .summary-table tr:last-child td {
            font-size: 14px;
            font-weight: bold;
            background: #1e8eb4;
            color: white;
            border: none;
        }
        
        .summary-label {
            text-align: right;
            color: #666;
        }
        
        .summary-value {
            text-align: right;
            font-weight: 600;
        }
        
        /* Amount in Words */
        .amount-words {
            background: #e8f4f8;
            border: 1px solid #b8dae6;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
            font-size: 11px;
        }
        
        .amount-words-label {
            font-weight: 600;
            color: #1e8eb4;
        }
        
        /* Footer */
        .invoice-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
        }
        
        .payment-info {
            font-size: 11px;
        }
        
        .payment-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 10px;
        }
        
        .payment-cash { background: #d4edda; color: #155724; }
        .payment-online { background: #d1ecf1; color: #0c5460; }
        .payment-credit { background: #f8d7da; color: #721c24; }
        .payment-split { background: #fff3cd; color: #856404; }
        
        .signature-section {
            text-align: right;
        }
        
        .signature-line {
            margin-top: 40px;
            border-top: 1px solid #333;
            padding-top: 5px;
            font-size: 10px;
        }
        
        .terms {
            margin-top: 15px;
            font-size: 9px;
            color: #666;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        
        .terms-title {
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="invoice-header">
            <div class="shop-info">
                <div class="shop-name">${shopInfo.shop_name}</div>
                <div class="shop-details">
                    ${shopInfo.shop_address ? `<div>📍 ${shopInfo.shop_address}</div>` : ''}
                    ${shopInfo.shop_phone ? `<div>📞 ${shopInfo.shop_phone}</div>` : ''}
                    ${shopInfo.shop_gstin ? `<div><strong>GSTIN:</strong> ${shopInfo.shop_gstin}</div>` : ''}
                    ${shopInfo.shop_drug_license ? `<div><strong>Drug License:</strong> ${shopInfo.shop_drug_license}</div>` : ''}
                </div>
            </div>
            <div class="invoice-title-section">
                <div class="invoice-title">TAX INVOICE</div>
                <div class="invoice-meta">
                    <div class="invoice-number">${bill.bill_number}</div>
                    <div><strong>Date:</strong> ${formatDate(bill.bill_date, 'dd/MM/yyyy hh:mm a')}</div>
                    <div><strong>State:</strong> ${shopInfo.shop_state} (33)</div>
                </div>
            </div>
        </div>
        
        <!-- Bill To -->
        <div class="bill-to">
            <div class="bill-to-title">BILL TO</div>
            <div class="customer-name">${bill.customer_name || 'Walk-in Customer'}</div>
            ${bill.doctor_name ? `<div style="font-size: 12px; margin-top: 5px; color: #666;"><strong>Doctor:</strong> ${bill.doctor_name}</div>` : ''}
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 30px; text-align: center;">#</th>
                    <th style="width: 25%;">Product Details</th>
                    <th style="width: 60px; text-align: center;">HSN</th>
                    <th style="width: 70px; text-align: center;">Expiry</th>
                    <th style="width: 50px; text-align: right;">Qty</th>
                    <th style="width: 70px; text-align: center;">Strips/Pcs</th>
                    <th style="width: 70px; text-align: right;">Rate</th>
                    <th style="width: 50px; text-align: center;">GST</th>
                    <th style="width: 60px; text-align: right;">Disc</th>
                    <th style="width: 80px; text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
            </tbody>
        </table>
        
        <!-- Totals Section -->
        <div class="totals-section">
            <!-- GST Breakdown -->
            <table class="gst-table">
                <thead>
                    <tr>
                        <th>GST Rate</th>
                        <th style="text-align: right;">Taxable</th>
                        <th style="text-align: right;">CGST</th>
                        <th style="text-align: right;">SGST</th>
                        <th style="text-align: right;">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${gstRows}
                    <tr style="font-weight: bold; background: #e9ecef;">
                        <td>Total</td>
                        <td style="text-align: right;">${formatCurrency(bill.taxable_total || 0)}</td>
                        <td style="text-align: right;">${formatCurrency(bill.total_cgst || bill.cgst_amount || 0)}</td>
                        <td style="text-align: right;">${formatCurrency(bill.total_sgst || bill.sgst_amount || 0)}</td>
                        <td style="text-align: right;">${formatCurrency(bill.total_gst || 0)}</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- Summary -->
            <table class="summary-table">
                <tr>
                    <td class="summary-label">Sub Total:</td>
                    <td class="summary-value">${formatCurrency(bill.subtotal || 0)}</td>
                </tr>
                ${bill.discount_amount > 0 ? `
                <tr>
                    <td class="summary-label">Discount:</td>
                    <td class="summary-value">- ${formatCurrency(bill.discount_amount)}</td>
                </tr>
                ` : ''}
                <tr>
                    <td class="summary-label">CGST:</td>
                    <td class="summary-value">${formatCurrency(bill.total_cgst || bill.cgst_amount || 0)}</td>
                </tr>
                <tr>
                    <td class="summary-label">SGST:</td>
                    <td class="summary-value">${formatCurrency(bill.total_sgst || bill.sgst_amount || 0)}</td>
                </tr>
                ${bill.round_off ? `
                <tr>
                    <td class="summary-label">Round Off:</td>
                    <td class="summary-value">${formatCurrency(bill.round_off)}</td>
                </tr>
                ` : ''}
                <tr>
                    <td>Grand Total:</td>
                    <td>${formatCurrency(bill.grand_total)}</td>
                </tr>
            </table>
        </div>
        
        <!-- Amount in Words -->
        <div class="amount-words">
            <span class="amount-words-label">Amount in Words:</span>
            ${numberToWords(bill.grand_total)}
        </div>
        
        <!-- Footer -->
        <div class="invoice-footer">
            <div class="payment-info">
                <div style="margin-bottom: 5px;"><strong>Payment Method:</strong></div>
                <span class="payment-badge payment-${bill.payment_mode.toLowerCase()}">${bill.payment_mode}</span>
                ${bill.payment_mode === 'SPLIT' ? `
                    <div style="margin-top: 8px; font-size: 10px;">
                        ${bill.cash_amount > 0 ? `Cash: ${formatCurrency(bill.cash_amount)}<br>` : ''}
                        ${bill.online_amount > 0 ? `Online: ${formatCurrency(bill.online_amount)}<br>` : ''}
                        ${bill.credit_amount > 0 ? `Credit: ${formatCurrency(bill.credit_amount)}` : ''}
                    </div>
                ` : ''}
            </div>
            <div class="signature-section">
                <div class="signature-line">
                    Authorized Signatory<br>
                    <small>${shopInfo.shop_name}</small>
                </div>
            </div>
        </div>
        
        <!-- Terms -->
        <div class="terms">
            <div class="terms-title">Terms & Conditions:</div>
            <ol style="margin-left: 15px;">
                <li>Goods once sold will not be taken back or exchanged.</li>
                <li>Please check the expiry date before use.</li>
                <li>Subject to ${shopInfo.shop_state} jurisdiction only.</li>
            </ol>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// THERMAL BILL (6-inch / 152mm width)
// =====================================================

export async function generateThermalBillHTML(bill: Bill, items: BillItem[]): Promise<string> {
    const shopInfo = await getShopInfo();

    const itemRows = items.map((item, index) => {
        const qty = item.quantity || 0;
        const tps = item.tablets_per_strip || 10;
        const units = convertToUnits(qty, tps);

        return `
            <tr>
                <td style="padding: 8px 4px; font-size: 14px; border-bottom: 1px dashed #000;">
                    <strong>${index + 1}. ${item.medicine_name}</strong>
                    <span style="font-size: 12px; margin-left: 8px;">(${item.batch_number})</span>
                    <br/>
                    <span style="font-size: 13px;">${units.displayShort} × ${formatCurrency(item.selling_price || item.unit_price || 0)}</span>
                </td>
                <td style="text-align: center; padding: 8px 4px; font-size: 14px; border-bottom: 1px dashed #000;">
                    ${item.discount_amount > 0 ? `-${formatCurrency(item.discount_amount)}` : '-'}
                </td>
                <td style="text-align: right; padding: 8px 4px; font-size: 15px; font-weight: bold; border-bottom: 1px dashed #000;">
                    ${formatCurrency(item.total || item.total_amount || 0)}
                </td>
            </tr>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bill ${bill.bill_number}</title>
    <style>
        @page {
            size: 152mm auto;
            margin: 3mm;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; color: #000; }
        
        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 14px;
            width: 146mm;
            max-width: 146mm;
            line-height: 1.4;
            background: #fff;
            color: #000;
        }
        
        .thermal-bill { padding: 10px; }
        
        .header { text-align: center; margin-bottom: 15px; }
        .shop-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .shop-details { font-size: 13px; line-height: 1.5; }
        
        .separator { border-top: 2px dashed #000; margin: 12px 0; }
        .double-separator { border-top: 3px solid #000; margin: 12px 0; }
        
        .info-section { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px; 
            font-size: 14px;
        }
        .info-label { font-weight: normal; }
        .info-value { font-weight: bold; }
        
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
        }
        .items-header {
            font-weight: bold;
            font-size: 13px;
        }
        .items-header td {
            padding: 10px 4px;
            border-bottom: 2px solid #000;
        }
        
        .totals { margin-top: 15px; }
        .total-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px; 
            font-size: 15px;
        }
        .grand-total { 
            font-size: 20px; 
            font-weight: bold; 
            padding: 10px;
            border: 2px solid #000;
        }
        
        .payment-mode {
            text-align: center;
            font-size: 15px;
            padding: 10px;
            border: 1px solid #000;
            margin: 15px 0;
        }
        
        .footer { 
            text-align: center; 
            margin-top: 20px; 
            font-size: 13px; 
        }
        
        @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
        }
    </style>
</head>
<body>
    <div class="thermal-bill">
        <div class="header">
            <div class="shop-name">${shopInfo.shop_name}</div>
            <div class="shop-details">
                ${shopInfo.shop_address ? `${shopInfo.shop_address}<br/>` : ''}
                ${shopInfo.shop_phone ? `Phone: ${shopInfo.shop_phone}<br/>` : ''}
                ${shopInfo.shop_gstin ? `GSTIN: ${shopInfo.shop_gstin}<br/>` : ''}
                ${shopInfo.shop_drug_license ? `D.L. No: ${shopInfo.shop_drug_license}` : ''}
            </div>
        </div>
        
        <div class="double-separator"></div>
        
        <div class="info-section">
            <span><span class="info-label">Bill No:</span> <span class="info-value">${bill.bill_number}</span></span>
            <span><span class="info-label">Date:</span> <span class="info-value">${formatDate(bill.bill_date, 'dd/MM/yyyy HH:mm')}</span></span>
        </div>
        ${bill.customer_name ? `<div class="info-section"><span class="info-label">Customer:</span> <span class="info-value">${bill.customer_name}</span></div>` : ''}
        ${bill.doctor_name ? `<div class="info-section"><span class="info-label">Doctor:</span> <span class="info-value">${bill.doctor_name}</span></div>` : ''}
        
        <div class="separator"></div>
        
        <table class="items-table">
            <tr class="items-header">
                <td>Item Details</td>
                <td style="text-align: center;">Disc</td>
                <td style="text-align: right;">Amount</td>
            </tr>
            ${itemRows}
        </table>
        
        <div class="double-separator"></div>
        
        <div class="totals">
            <div class="total-row">
                <span>Sub Total (${items.length} items):</span>
                <span>${formatCurrency(bill.subtotal || 0)}</span>
            </div>
            ${bill.discount_amount > 0 ? `
            <div class="total-row">
                <span>Discount:</span>
                <span>- ${formatCurrency(bill.discount_amount)}</span>
            </div>
            ` : ''}
            <div class="total-row">
                <span>GST (CGST + SGST):</span>
                <span>${formatCurrency(bill.total_gst || 0)}</span>
            </div>
            ${bill.round_off ? `
            <div class="total-row">
                <span>Round Off:</span>
                <span>${formatCurrency(bill.round_off)}</span>
            </div>
            ` : ''}
            <div class="separator"></div>
            <div class="total-row grand-total">
                <span>GRAND TOTAL:</span>
                <span>₹ ${(bill.grand_total || 0).toFixed(2)}</span>
            </div>
        </div>
        
        <div class="payment-mode">
            <strong>Payment Mode:</strong> ${bill.payment_mode}
            ${bill.cash_amount > 0 ? ` | Cash: ${formatCurrency(bill.cash_amount)}` : ''}
            ${bill.online_amount > 0 ? ` | Online: ${formatCurrency(bill.online_amount)}` : ''}
            ${bill.credit_amount > 0 ? ` | Credit: ${formatCurrency(bill.credit_amount)}` : ''}
        </div>
        
        <div class="footer">
            <div style="font-size: 14px; margin-bottom: 5px;"><strong>Thank you for your purchase!</strong></div>
            <div>*** Get Well Soon ***</div>
            <div style="margin-top: 10px; font-size: 11px;">This is a computer generated bill</div>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// PRINT FUNCTIONS
// =====================================================

/**
 * Print a bill with the specified options
 */
export async function printBill(
    bill: Bill,
    items: BillItem[],
    options: PrintOptions = { paperSize: 'thermal' }
): Promise<void> {
    let html: string;

    switch (options.paperSize) {
        case 'legal':
        case 'a4':
            html = await generateLegalBillHTML(bill, items);
            break;
        case 'thermal':
        default:
            html = await generateThermalBillHTML(bill, items);
            break;
    }

    // Always generate and save HTML first as a reliable fallback
    // This ensures the bill is preserved even if printing fails
    return new Promise<void>((resolve) => {
        try {
            // Try popup window first, fallback to iframe
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow && !printWindow.closed) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();

                // Use requestAnimationFrame for more reliable timing
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        try {
                            printWindow.print();
                            resolve();
                        } catch (e) {
                            console.error('Print failed:', e);
                            // Don't reject - printing is optional, resolve anyway
                            resolve();
                        }
                    }, 300);
                });
            } else {
                // Fallback: use hidden iframe for printing
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);

                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    iframeDoc.open();
                    iframeDoc.write(html);
                    iframeDoc.close();

                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            try {
                                iframe.contentWindow?.focus();
                                iframe.contentWindow?.print();
                            } catch (e) {
                                console.error('Iframe print failed:', e);
                            }
                            // Clean up after printing
                            setTimeout(() => {
                                try {
                                    document.body.removeChild(iframe);
                                } catch {
                                    // Iframe may already be removed
                                }
                            }, 1000);
                            resolve();
                        }, 300);
                    });
                } else {
                    resolve(); // Can't print but don't block
                }
            }
        } catch (error) {
            console.error('Print setup failed:', error);
            // Don't reject - resolve so billing flow continues
            resolve();
        }
    });
}

/**
 * Generate bill as HTML string for preview/download
 */
export async function generateBillHTML(
    bill: Bill,
    items: BillItem[],
    paperSize: 'thermal' | 'a4' | 'legal' = 'legal'
): Promise<string> {
    switch (paperSize) {
        case 'legal':
        case 'a4':
            return await generateLegalBillHTML(bill, items);
        case 'thermal':
        default:
            return await generateThermalBillHTML(bill, items);
    }
}

/**
 * Preview bill in a new window without printing
 */
export async function previewBill(
    bill: Bill,
    items: BillItem[],
    paperSize: 'thermal' | 'a4' | 'legal' = 'legal'
): Promise<void> {
    const html = await generateBillHTML(bill, items, paperSize);
    const previewWindow = window.open('', '_blank', 'width=900,height=700');
    if (previewWindow) {
        previewWindow.document.write(html);
        previewWindow.document.close();
        previewWindow.focus();
    } else {
        // If popup blocked, download instead
        downloadBillHTML(html, bill.bill_number);
    }
}

/**
 * Generate bill PDF for download (returns data URL)
 */
export async function generateBillPDF(
    bill: Bill,
    items: BillItem[]
): Promise<string> {
    const html = await generateLegalBillHTML(bill, items);

    // Create a blob and return as data URL for download
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
}

/**
 * Download bill as HTML file
 */
export function downloadBillHTML(html: string, billNumber: string): void {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${billNumber.replace(/[/\\]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =====================================================
// SILENT PRINT (via Tauri Backend - No Dialogs)
// =====================================================

/**
 * Print a bill silently using the Tauri backend.
 * This sends the bill directly to the default printer without any dialogs.
 * 
 * @param bill - The bill to print
 * @param items - Bill items
 * @param paperSize - Paper size (default: thermal for receipt printing)
 */
export async function silentPrintBill(
    bill: Bill,
    items: BillItem[],
    paperSize: 'thermal' | 'a4' | 'legal' = 'thermal'
): Promise<void> {
    // Generate HTML based on paper size
    let html: string;
    switch (paperSize) {
        case 'legal':
        case 'a4':
            html = await generateLegalBillHTML(bill, items);
            break;
        case 'thermal':
        default:
            html = await generateThermalBillHTML(bill, items);
            break;
    }

    // Import Tauri invoke dynamically
    const { invoke } = await import('@tauri-apps/api/core');

    // Send to Tauri backend for silent printing (no dialogs, no popups)
    try {
        await invoke('silent_print', { htmlContent: html });
        console.log('[Print] Silent print initiated successfully');
    } catch (error) {
        console.error('[Print] Silent print failed:', error);
        // No fallback popup - just log the error
        // The bill is already saved, user can print from Bill History if needed
        throw new Error(
            error instanceof Error
                ? error.message
                : 'Silent print failed. Please check if a printer is connected.'
        );
    }
}

/**
 * Check if a printer is available (via Tauri backend)
 */
export async function checkPrinterAvailable(): Promise<boolean> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('check_printer_available');
    } catch {
        return false;
    }
}

