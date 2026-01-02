// =====================================================
// Report Export Service
// Generate PDF/HTML exports for various reports
// =====================================================

import { formatCurrency, formatDate } from '../utils';
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

export interface ReportExportOptions {
    title: string;
    dateRange?: {
        start: string;
        end: string;
    };
    format?: 'pdf' | 'html';
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

function getReportStyles(): string {
    return `
        @page {
            size: A4;
            margin: 15mm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #333;
        }
        
        .report-container {
            max-width: 100%;
            padding: 20px;
        }
        
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #1e8eb4;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .shop-info {
            flex: 1;
        }
        
        .shop-name {
            font-size: 22px;
            font-weight: bold;
            color: #1e8eb4;
            margin-bottom: 5px;
        }
        
        .shop-details {
            font-size: 11px;
            color: #666;
        }
        
        .report-title-section {
            text-align: right;
        }
        
        .report-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        
        .report-period {
            font-size: 12px;
            color: #666;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .summary-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        
        .summary-value {
            font-size: 20px;
            font-weight: bold;
            color: #1e8eb4;
            margin-bottom: 5px;
        }
        
        .summary-label {
            font-size: 11px;
            color: #666;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 5px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10px;
        }
        
        .data-table th {
            background: #1e8eb4;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
        }
        
        .data-table td {
            padding: 8px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .data-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .data-table .numeric {
            text-align: right;
            font-family: monospace;
        }
        
        .data-table tfoot td {
            font-weight: bold;
            background: #e9ecef;
            border-top: 2px solid #1e8eb4;
        }
        
        .report-footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        
        .text-danger { color: #dc3545; }
        .text-warning { color: #ffc107; }
        .text-success { color: #28a745; }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none; }
        }
    `;
}

// =====================================================
// SALES REPORT
// =====================================================

export async function generateSalesReportHTML(
    data: {
        summary: { totalBills: number; totalSales: number; totalGst: number; avgBillValue: number };
        payments: { mode: string; amount: number; count: number }[];
        topMeds: { medicine_name: string; quantity_sold: number; total_revenue: number }[];
    },
    options: ReportExportOptions
): Promise<string> {
    const shopInfo = await getShopInfo();

    const paymentRows = data.payments.map(p => `
        <tr>
            <td>${p.mode}</td>
            <td class="numeric">${p.count}</td>
            <td class="numeric">${formatCurrency(p.amount)}</td>
        </tr>
    `).join('');

    const topMedsRows = data.topMeds.map((m, i) => `
        <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>${m.medicine_name}</td>
            <td class="numeric">${m.quantity_sold}</td>
            <td class="numeric">${formatCurrency(m.total_revenue)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${options.title}</title>
    <style>${getReportStyles()}</style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="shop-info">
                <div class="shop-name">${shopInfo.shop_name}</div>
                <div class="shop-details">
                    ${shopInfo.shop_address ? `<div>${shopInfo.shop_address}</div>` : ''}
                    ${shopInfo.shop_phone ? `<div>Ph: ${shopInfo.shop_phone}</div>` : ''}
                    ${shopInfo.shop_gstin ? `<div>GSTIN: ${shopInfo.shop_gstin}</div>` : ''}
                </div>
            </div>
            <div class="report-title-section">
                <div class="report-title">${options.title}</div>
                ${options.dateRange ? `
                    <div class="report-period">
                        ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}
                    </div>
                ` : ''}
                <div style="font-size: 10px; color: #999; margin-top: 5px;">
                    Generated on ${formatDate(new Date().toISOString(), 'dd/MM/yyyy hh:mm a')}
                </div>
            </div>
        </div>
        
        <div class="summary-cards">
            <div class="summary-card">
                <div class="summary-value">${data.summary.totalBills}</div>
                <div class="summary-label">Total Bills</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(data.summary.totalSales)}</div>
                <div class="summary-label">Total Sales</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(data.summary.totalGst)}</div>
                <div class="summary-label">Total GST</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(data.summary.avgBillValue)}</div>
                <div class="summary-label">Avg Bill Value</div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <div class="section-title">Payment Mode Breakdown</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Payment Mode</th>
                            <th style="text-align: right;">Count</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentRows}
                    </tbody>
                </table>
            </div>
            
            <div>
                <div class="section-title">Top Selling Medicines</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center;">#</th>
                            <th>Medicine</th>
                            <th style="text-align: right;">Qty</th>
                            <th style="text-align: right;">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topMedsRows}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="report-footer">
            <div>This is a computer-generated report and does not require a signature.</div>
            <div style="margin-top: 5px;">${shopInfo.shop_name} - ${shopInfo.shop_state}</div>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// GST REPORT
// =====================================================

export async function generateGSTReportHTML(
    data: {
        breakdown: { gst_rate: number; taxable_value: number; cgst: number; sgst: number; total_gst: number }[];
        total: number;
    },
    options: ReportExportOptions
): Promise<string> {
    const shopInfo = await getShopInfo();

    const totalTaxable = data.breakdown.reduce((s, g) => s + g.taxable_value, 0);
    const totalCgst = data.breakdown.reduce((s, g) => s + g.cgst, 0);
    const totalSgst = data.breakdown.reduce((s, g) => s + g.sgst, 0);

    const gstRows = data.breakdown.map(g => `
        <tr>
            <td style="text-align: center;">${g.gst_rate}%</td>
            <td class="numeric">${formatCurrency(g.taxable_value)}</td>
            <td class="numeric">${formatCurrency(g.cgst)}</td>
            <td class="numeric">${formatCurrency(g.sgst)}</td>
            <td class="numeric">${formatCurrency(g.total_gst)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${options.title}</title>
    <style>${getReportStyles()}</style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="shop-info">
                <div class="shop-name">${shopInfo.shop_name}</div>
                <div class="shop-details">
                    ${shopInfo.shop_gstin ? `<div><strong>GSTIN:</strong> ${shopInfo.shop_gstin}</div>` : ''}
                    ${shopInfo.shop_address ? `<div>${shopInfo.shop_address}</div>` : ''}
                </div>
            </div>
            <div class="report-title-section">
                <div class="report-title">${options.title}</div>
                ${options.dateRange ? `
                    <div class="report-period">
                        ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="summary-cards" style="grid-template-columns: repeat(3, 1fr);">
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(totalCgst)}</div>
                <div class="summary-label">Total CGST</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(totalSgst)}</div>
                <div class="summary-label">Total SGST</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${formatCurrency(data.total)}</div>
                <div class="summary-label">Total GST Collected</div>
            </div>
        </div>
        
        <div class="section-title">GST Breakup by Tax Rate</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="text-align: center; width: 100px;">GST Rate</th>
                    <th style="text-align: right;">Taxable Value</th>
                    <th style="text-align: right;">CGST</th>
                    <th style="text-align: right;">SGST</th>
                    <th style="text-align: right;">Total Tax</th>
                </tr>
            </thead>
            <tbody>
                ${gstRows}
            </tbody>
            <tfoot>
                <tr>
                    <td style="text-align: center;"><strong>Total</strong></td>
                    <td class="numeric">${formatCurrency(totalTaxable)}</td>
                    <td class="numeric">${formatCurrency(totalCgst)}</td>
                    <td class="numeric">${formatCurrency(totalSgst)}</td>
                    <td class="numeric">${formatCurrency(data.total)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="report-footer">
            <div>This is a computer-generated GST report for filing purposes.</div>
            <div style="margin-top: 5px;">State: ${shopInfo.shop_state} | GSTIN: ${shopInfo.shop_gstin || 'N/A'}</div>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// SCHEDULED DRUGS REPORT
// =====================================================

export async function generateScheduledDrugsReportHTML(
    data: {
        records: {
            bill_date?: string;
            created_at: string;
            bill_number?: string;
            medicine_name?: string;
            batch_number?: string;
            quantity: number;
            patient_name: string;
            patient_age?: number;
            patient_gender?: string;
            patient_phone?: string;
            doctor_name?: string;
        }[];
        totalRecords: number;
        totalQuantity: number;
    },
    options: ReportExportOptions
): Promise<string> {
    const shopInfo = await getShopInfo();

    const recordRows = data.records.map((r, i) => `
        <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>${formatDate(r.bill_date || r.created_at)}</td>
            <td style="font-family: monospace; font-size: 10px;">${r.bill_number || '-'}</td>
            <td>${r.medicine_name || '-'}</td>
            <td style="font-size: 10px;">${r.batch_number || '-'}</td>
            <td class="numeric">${r.quantity}</td>
            <td><strong>${r.patient_name}</strong></td>
            <td>${r.patient_age ? `${r.patient_age}Y` : '-'}${r.patient_gender ? `/${r.patient_gender}` : ''}</td>
            <td>${r.patient_phone || '-'}</td>
            <td>${r.doctor_name || '-'}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${options.title}</title>
    <style>
        ${getReportStyles()}
        .data-table { font-size: 9px; }
        .data-table th, .data-table td { padding: 6px 4px; }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="shop-info">
                <div class="shop-name">${shopInfo.shop_name}</div>
                <div class="shop-details">
                    ${shopInfo.shop_drug_license ? `<div><strong>Drug License:</strong> ${shopInfo.shop_drug_license}</div>` : ''}
                    ${shopInfo.shop_address ? `<div>${shopInfo.shop_address}</div>` : ''}
                </div>
            </div>
            <div class="report-title-section">
                <div class="report-title">Schedule H/H1 Drug Register</div>
                ${options.dateRange ? `
                    <div class="report-period">
                        ${formatDate(options.dateRange.start)} - ${formatDate(options.dateRange.end)}
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="summary-cards" style="grid-template-columns: repeat(2, 1fr);">
            <div class="summary-card">
                <div class="summary-value">${data.totalRecords}</div>
                <div class="summary-label">Total Records</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${data.totalQuantity}</div>
                <div class="summary-label">Total Quantity Dispensed</div>
            </div>
        </div>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 25px; text-align: center;">S.No</th>
                    <th style="width: 70px;">Date</th>
                    <th style="width: 80px;">Bill No.</th>
                    <th>Medicine Name</th>
                    <th style="width: 70px;">Batch</th>
                    <th style="width: 40px; text-align: right;">Qty</th>
                    <th>Patient Name</th>
                    <th style="width: 50px;">Age/Sex</th>
                    <th style="width: 80px;">Phone</th>
                    <th>Doctor</th>
                </tr>
            </thead>
            <tbody>
                ${recordRows.length > 0 ? recordRows : '<tr><td colspan="10" style="text-align: center; padding: 30px;">No records found for this period</td></tr>'}
            </tbody>
        </table>
        
        <div class="report-footer">
            <div><strong>Schedule H/H1 Drug Sales Register</strong></div>
            <div>As per Drug and Cosmetics Rules - Maintained for regulatory compliance</div>
            <div style="margin-top: 10px;">${shopInfo.shop_name} | D.L. No: ${shopInfo.shop_drug_license || 'N/A'}</div>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// CREDIT REPORT
// =====================================================

export async function generateCreditReportHTML(
    data: {
        customers: {
            name: string;
            phone?: string;
            credit_limit: number;
            current_balance: number;
            last_transaction?: string;
        }[];
        total: number;
    },
    options: ReportExportOptions
): Promise<string> {
    const shopInfo = await getShopInfo();

    const customerRows = data.customers.map((c, i) => `
        <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td class="numeric">${formatCurrency(c.credit_limit)}</td>
            <td class="numeric text-danger" style="font-weight: bold;">${formatCurrency(c.current_balance)}</td>
            <td>${c.last_transaction ? formatDate(c.last_transaction) : '-'}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${options.title}</title>
    <style>${getReportStyles()}</style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="shop-info">
                <div class="shop-name">${shopInfo.shop_name}</div>
                <div class="shop-details">
                    ${shopInfo.shop_address ? `<div>${shopInfo.shop_address}</div>` : ''}
                    ${shopInfo.shop_phone ? `<div>Ph: ${shopInfo.shop_phone}</div>` : ''}
                </div>
            </div>
            <div class="report-title-section">
                <div class="report-title">${options.title}</div>
                <div style="font-size: 10px; color: #999; margin-top: 5px;">
                    As of ${formatDate(new Date().toISOString(), 'dd/MM/yyyy')}
                </div>
            </div>
        </div>
        
        <div class="summary-cards" style="grid-template-columns: repeat(2, 1fr);">
            <div class="summary-card">
                <div class="summary-value">${data.customers.length}</div>
                <div class="summary-label">Customers with Outstanding</div>
            </div>
            <div class="summary-card">
                <div class="summary-value text-danger">${formatCurrency(data.total)}</div>
                <div class="summary-label">Total Outstanding Amount</div>
            </div>
        </div>
        
        <div class="section-title">Outstanding Credits (Udhar)</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th>Customer Name</th>
                    <th style="width: 100px;">Phone</th>
                    <th style="text-align: right; width: 100px;">Credit Limit</th>
                    <th style="text-align: right; width: 120px;">Outstanding</th>
                    <th style="width: 100px;">Last Transaction</th>
                </tr>
            </thead>
            <tbody>
                ${customerRows}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4" style="text-align: right;"><strong>Total Outstanding:</strong></td>
                    <td class="numeric text-danger">${formatCurrency(data.total)}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
        
        <div class="report-footer">
            <div>This is a computer-generated credit report.</div>
            <div style="margin-top: 5px;">${shopInfo.shop_name}</div>
        </div>
    </div>
</body>
</html>
    `;
}

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

/**
 * Open report in print window
 */
export function printReportHTML(html: string): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 300);
    }
}

/**
 * Download report as HTML file
 */
export function downloadReportHTML(html: string, filename: string): void {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Open report in new tab for saving as PDF
 */
export function openReportForPDF(html: string): void {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
        // Add a note about saving as PDF
        const note = newWindow.document.createElement('div');
        note.className = 'no-print';
        note.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #1e8eb4; color: white; padding: 10px 15px; border-radius: 5px; font-size: 12px; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
        note.innerHTML = '💡 Press <strong>Ctrl+P</strong> and select "Save as PDF" to download';
        newWindow.document.body.appendChild(note);
    }
}
