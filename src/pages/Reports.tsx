
/* eslint-disable @typescript-eslint/no-explicit-any */
// =====================================================
// MedBill - Reports Page
// Business Reports and Analytics
// =====================================================

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import ExcelJS from 'exceljs';
import {
    AlertCircle,
    Calendar,
    ChevronDown,
    ChevronRight,
    FileSpreadsheet,
    Filter,
    IndianRupee,
    Package,
    Printer,
    TrendingUp,
    Users
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { useToast } from '../components/common/Toast';
import { getBills, getPaymentModeBreakdown, getSalesTrend, getTopSellingMedicines } from '../services/billing.service';
import { query } from '../services/database';
import { getExpiringItems, getStockValue } from '../services/inventory.service';
import type { Bill, ScheduledMedicineRecord, StockItem } from '../types';
import { formatCurrency, formatDate, toISODate } from '../utils';

type ReportType = 'sales' | 'gst' | 'inventory' | 'expiry' | 'credit' | 'scheduled';

interface SalesReportData {
    bills: Bill[];
    trend: { date: string; amount: number }[];
    topMeds: { medicine_id: number; medicine_name: string; quantity_sold: number; total_revenue: number }[];
    payments: { mode: string; amount: number; count: number }[];
    summary: { totalBills: number; totalSales: number; totalGst: number; avgBillValue: number };
}

interface GstReportData {
    breakdown: { gst_rate: number; taxable_value: number; cgst: number; sgst: number; total_gst: number }[];
    total: number;
}

interface InventoryReportData {
    totalPurchaseValue: number;
    totalSaleValue: number;
    totalItems: number;
}

interface ExpiryReportData {
    expired: StockItem[];
    expiringSoon: StockItem[];
    totalValue: number;
}

interface CreditReportData {
    customers: { id: number; name: string; phone: string; current_balance: number; credit_limit: number; last_transaction: string }[];
    total: number;
}

interface ScheduledReportData {
    records: ScheduledMedicineRecord[];
    totalRecords: number;
    totalQuantity: number;
}

interface ReportData {
    sales: SalesReportData | undefined;
    gst: GstReportData | undefined;
    inventory: InventoryReportData | undefined;
    expiry: ExpiryReportData | undefined;
    credit: CreditReportData | undefined;
    scheduled: ScheduledReportData | undefined;
}

export function Reports() {
    const { showToast } = useToast();
    const [activeReport, setActiveReport] = useState<ReportType>('sales');
    const [dateRange, setDateRange] = useState({
        start: toISODate(new Date(new Date().setDate(1))), // First of month
        end: toISODate(new Date())
    });
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<Partial<ReportData>>({});
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const loadReport = useCallback(async () => {
        setIsLoading(true);
        try {
            switch (activeReport) {
                case 'sales': {
                    const [bills, trend, topMeds, payments] = await Promise.all([
                        getBills({ startDate: dateRange.start, endDate: dateRange.end }),
                        getSalesTrend(30),
                        getTopSellingMedicines(10, 30),
                        getPaymentModeBreakdown(dateRange.start, dateRange.end)
                    ]);

                    const totalSales = bills.reduce((sum, b) => sum + b.grand_total, 0);
                    const totalGst = bills.reduce((sum, b) => sum + b.total_gst, 0);

                    setReportData({
                        ...reportData,
                        sales: {
                            bills,
                            trend,
                            topMeds,
                            payments,
                            summary: {
                                totalBills: bills.length,
                                totalSales,
                                totalGst,
                                avgBillValue: bills.length > 0 ? totalSales / bills.length : 0
                            }
                        }
                    });
                    break;
                }
                case 'gst': {
                    const gstData = await query<any>(
                        `SELECT
bi.gst_rate,
    SUM(bi.taxable_amount) as taxable_value,
    SUM(bi.cgst_amount) as cgst,
    SUM(bi.sgst_amount) as sgst,
    SUM(bi.cgst_amount + bi.sgst_amount) as total_gst
            FROM bill_items bi
            JOIN bills b ON bi.bill_id = b.id
            WHERE date(b.bill_date) BETWEEN ? AND ?
    AND b.is_cancelled = 0
            GROUP BY bi.gst_rate
            ORDER BY bi.gst_rate`,
                        [dateRange.start, dateRange.end]
                    );

                    setReportData({
                        ...reportData,
                        gst: {
                            breakdown: gstData,
                            total: gstData.reduce((sum: number, g: any) => sum + g.total_gst, 0)
                        }
                    });
                    break;
                }
                case 'inventory': {
                    const stockValue = await getStockValue();
                    setReportData({
                        ...reportData,
                        inventory: stockValue
                    });
                    break;
                }
                case 'expiry': {
                    const expiring = await getExpiringItems(30);
                    const expired = expiring.filter(i => i.days_to_expiry <= 0);
                    const expiringSoon = expiring.filter(i => i.days_to_expiry > 0);

                    setReportData({
                        ...reportData,
                        expiry: {
                            expired,
                            expiringSoon,
                            totalValue: expiring.reduce((sum, i) => sum + i.selling_price * i.quantity, 0)
                        }
                    });
                    break;
                }
                case 'credit': {
                    const credits = await query<any>(
                        `SELECT
c.id,
    c.name,
    c.phone,
    c.current_balance,
    c.credit_limit,
    (SELECT MAX(created_at) FROM credits WHERE customer_id = c.id) as last_transaction
            FROM customers c
            WHERE c.current_balance > 0
            ORDER BY c.current_balance DESC`,
                        []
                    );

                    setReportData({
                        ...reportData,
                        credit: {
                            customers: credits,
                            total: credits.reduce((sum: number, c: any) => sum + c.current_balance, 0)
                        }
                    });
                    break;
                }
                case 'scheduled': {
                    const scheduledRecords = await query<ScheduledMedicineRecord>(
                        `SELECT
                            smr.id,
                            smr.bill_id,
                            smr.bill_item_id,
                            smr.medicine_id,
                            smr.batch_id,
                            smr.patient_name,
                            smr.patient_age,
                            smr.patient_gender,
                            smr.patient_phone,
                            smr.patient_address,
                            smr.doctor_name,
                            smr.doctor_registration_number,
                            smr.clinic_hospital_name,
                            smr.prescription_number,
                            smr.prescription_date,
                            smr.doctor_prescription,
                            smr.quantity,
                            smr.created_at,
                            m.name as medicine_name,
                            b.batch_number,
                            bills.bill_number,
                            bills.bill_date
                        FROM scheduled_medicine_records smr
                        JOIN medicines m ON smr.medicine_id = m.id
                        JOIN batches b ON smr.batch_id = b.id
                        JOIN bills ON smr.bill_id = bills.id
                        WHERE date(smr.created_at) BETWEEN ? AND ?
                        ORDER BY smr.created_at DESC`,
                        [dateRange.start, dateRange.end]
                    );

                    setReportData({
                        ...reportData,
                        scheduled: {
                            records: scheduledRecords,
                            totalRecords: scheduledRecords.length,
                            totalQuantity: scheduledRecords.reduce((sum: number, r: any) => sum + r.quantity, 0)
                        }
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Failed to load report:', error);
        }
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeReport, dateRange.start, dateRange.end]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'MedBill';
            workbook.created = new Date();

            let sheetName = 'Report';
            let reportTitle = 'Report';
            let columns: any[] = [];
            let data: any[] = [];
            let summary: any[] = [];

            switch (activeReport) {
                case 'sales':
                    sheetName = 'Sales_Report';
                    reportTitle = 'Sales Report';
                    columns = [
                        { header: 'Date', key: 'date', width: 15 },
                        { header: 'Bill No', key: 'billNo', width: 15 },
                        { header: 'Customer', key: 'customer', width: 20 },
                        { header: 'Items', key: 'items', width: 10 },
                        { header: 'Total', key: 'total', width: 15 },
                        { header: 'Payment', key: 'payment', width: 15 },
                    ];
                    if (reportData.sales) {
                        data = reportData.sales.bills.map((b: any) => ({
                            date: formatDate(b.bill_date),
                            billNo: b.bill_number,
                            customer: b.customer_name || 'Walk-in',
                            items: b.items_count || '-', // items_count might not be in bills list query, check billing service. Assuming it is or using placeholder.
                            total: b.grand_total,
                            payment: b.payment_mode
                        }));
                        summary = [
                            { label: 'Total Bills', value: reportData.sales.summary.totalBills },
                            { label: 'Total Sales', value: reportData.sales.summary.totalSales },
                            { label: 'Total GST', value: reportData.sales.summary.totalGst },
                            { label: 'Avg Bill Value', value: reportData.sales.summary.avgBillValue }
                        ];
                    }
                    break;

                case 'gst':
                    sheetName = 'GST_Report';
                    reportTitle = 'GST Report';
                    columns = [
                        { header: 'GST Rate', key: 'rate', width: 15 },
                        { header: 'Taxable Value', key: 'taxable', width: 15 },
                        { header: 'CGST', key: 'cgst', width: 15 },
                        { header: 'SGST', key: 'sgst', width: 15 },
                        { header: 'Total GST', key: 'total', width: 15 },
                    ];
                    if (reportData.gst) {
                        data = reportData.gst.breakdown.map((g: any) => ({
                            rate: `${g.gst_rate}%`,
                            taxable: g.taxable_value,
                            cgst: g.cgst,
                            sgst: g.sgst,
                            total: g.total_gst
                        }));
                        summary = [
                            { label: 'Total GST Collected', value: reportData.gst.total }
                        ];
                    }
                    break;

                case 'inventory':
                    sheetName = 'Stock_Value_Report';
                    reportTitle = 'Stock Value Report';
                    columns = [
                        { header: 'Medicine', key: 'name', width: 25 },
                        { header: 'Batch', key: 'batch', width: 15 },
                        { header: 'Stock', key: 'stock', width: 10 },
                        { header: 'MRP', key: 'mrp', width: 10 },
                        { header: 'Purchase Rate', key: 'rate', width: 15 },
                        { header: 'Value', key: 'value', width: 15 },
                    ];
                    if (reportData.inventory) {
                        // Inventory report only shows summary, not item details
                        summary = [
                            { label: 'Total Purchase Value', value: reportData.inventory.totalPurchaseValue },
                            { label: 'Total Sale Value', value: reportData.inventory.totalSaleValue },
                            { label: 'Total Items', value: reportData.inventory.totalItems }
                        ];
                    }
                    break;

                case 'expiry':
                    sheetName = 'Expiry_Report';
                    reportTitle = 'Expiry Report';
                    columns = [
                        { header: 'Medicine', key: 'name', width: 25 },
                        { header: 'Batch', key: 'batch', width: 15 },
                        { header: 'Expiry Date', key: 'expiry', width: 15 },
                        { header: 'Stock', key: 'stock', width: 10 },
                        { header: 'Days Remaining', key: 'days', width: 15 },
                    ];
                    if (reportData.expiry) {
                        // Combine expired and expiring soon for the report
                        const allItems = [...reportData.expiry.expired, ...reportData.expiry.expiringSoon];
                        data = allItems.map((i: any) => ({
                            name: i.medicine_name,
                            batch: i.batch_number,
                            expiry: formatDate(i.expiry_date),
                            stock: i.quantity,
                            days: i.days_to_expiry
                        }));
                        summary = [
                            { label: 'Total Expired Items', value: reportData.expiry.expired.length },
                            { label: 'Total Expiring Soon', value: reportData.expiry.expiringSoon.length }
                        ];
                    }
                    break;

                case 'credit':
                    sheetName = 'Credit_Report';
                    reportTitle = 'Credit Report';
                    columns = [
                        { header: 'Customer', key: 'customer', width: 25 },
                        { header: 'Phone', key: 'phone', width: 15 },
                        { header: 'Outstanding Balance', key: 'balance', width: 20 },
                    ];
                    if (reportData.credit) {
                        data = reportData.credit.customers.map((c: any) => ({
                            customer: c.name,
                            phone: c.phone,
                            balance: c.current_balance
                        }));
                        summary = [
                            { label: 'Total Outstanding', value: reportData.credit.total }
                        ];
                    }
                    break;

                case 'scheduled':
                    sheetName = 'Scheduled_Drugs_Report';
                    reportTitle = 'Scheduled Drugs Report';
                    columns = [
                        { header: 'Date', key: 'date', width: 12 },
                        { header: 'Bill No', key: 'billNo', width: 12 },
                        { header: 'Medicine', key: 'medicine', width: 20 },
                        { header: 'Batch', key: 'batch', width: 12 },
                        { header: 'Qty', key: 'qty', width: 6 },
                        { header: 'Patient Name', key: 'patient', width: 18 },
                        { header: 'Age', key: 'age', width: 6 },
                        { header: 'Gender', key: 'gender', width: 8 },
                        { header: 'Phone', key: 'phone', width: 12 },
                        { header: 'Address', key: 'address', width: 25 },
                        { header: 'Doctor', key: 'doctor', width: 18 },
                        { header: 'Doctor Reg. No', key: 'docReg', width: 15 },
                        { header: 'Clinic/Hospital', key: 'clinic', width: 20 },
                        { header: 'Prescription No', key: 'prescNo', width: 15 },
                        { header: 'Prescription Date', key: 'prescDate', width: 12 },
                        { header: 'Prescription Details', key: 'prescDetails', width: 40 },
                    ];
                    if (reportData.scheduled) {
                        data = reportData.scheduled.records.map((r: any) => ({
                            date: formatDate(r.bill_date || r.created_at),
                            billNo: r.bill_number,
                            medicine: r.medicine_name,
                            batch: r.batch_number,
                            qty: r.quantity,
                            patient: r.patient_name,
                            age: r.patient_age || '-',
                            gender: r.patient_gender || '-',
                            phone: r.patient_phone || '-',
                            address: r.patient_address || '-',
                            doctor: r.doctor_name || '-',
                            docReg: r.doctor_registration_number || '-',
                            clinic: r.clinic_hospital_name || '-',
                            prescNo: r.prescription_number || '-',
                            prescDate: r.prescription_date ? formatDate(r.prescription_date) : '-',
                            prescDetails: r.doctor_prescription || '-'
                        }));
                        summary = [
                            { label: 'Total Records', value: reportData.scheduled.totalRecords },
                            { label: 'Total Quantity', value: reportData.scheduled.totalQuantity }
                        ];
                    }
                    break;
            }

            const sheet = workbook.addWorksheet(sheetName);

            // 1. Title
            sheet.mergeCells('A1:E1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = reportTitle;
            titleCell.font = { name: 'Arial', size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };

            // 2. Period
            sheet.mergeCells('A2:E2');
            const periodCell = sheet.getCell('A2');
            periodCell.value = `Period: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
            periodCell.font = { name: 'Arial', size: 12, italic: true };
            periodCell.alignment = { horizontal: 'center' };

            // 3. Summary Section
            let currentRow = 4;
            if (summary.length > 0) {
                sheet.getCell(`A${currentRow}`).value = 'Summary';
                sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
                currentRow++;

                summary.forEach(item => {
                    sheet.getCell(`A${currentRow}`).value = item.label;
                    sheet.getCell(`B${currentRow}`).value = item.value;
                    sheet.getCell(`A${currentRow}`).font = { bold: true };
                    currentRow++;
                });
                currentRow += 2; // Add spacing
            }

            // 4. Data Table
            // Set columns
            columns.forEach((col, index) => {
                const column = sheet.getColumn(index + 1);
                column.width = col.width;
            });

            // Add Header Row
            const headerRow = sheet.getRow(currentRow);
            columns.forEach((col, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = col.header;
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF2563EB' } // Primary Blue
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            currentRow++;

            // Add Data Rows
            data.forEach(item => {
                const row = sheet.getRow(currentRow);
                columns.forEach((col, index) => {
                    const cell = row.getCell(index + 1);
                    cell.value = item[col.key];
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                currentRow++;
            });

            // Generate binary
            const buffer = await workbook.xlsx.writeBuffer();
            const binaryData = new Uint8Array(buffer);

            const fileName = `${sheetName}_${toISODate(new Date())}.xlsx`;
            const filePath = await save({
                defaultPath: fileName,
                filters: [{
                    name: 'Excel Workbook',
                    extensions: ['xlsx']
                }]
            });

            if (filePath) {
                await writeFile(filePath, binaryData);
                showToast('success', 'Report exported successfully');
            }
        } catch (error) {
            console.error('Export failed:', error);
            showToast('error', 'Failed to export report');
        }
    };





    const reportTabs = [
        { id: 'sales', label: 'Sales Report', icon: TrendingUp },
        { id: 'gst', label: 'GST Report', icon: IndianRupee },
        { id: 'inventory', label: 'Stock Value', icon: Package },
        { id: 'expiry', label: 'Expiry Report', icon: Calendar },
        { id: 'credit', label: 'Credit Report', icon: Users },
        { id: 'scheduled', label: 'Scheduled Drugs', icon: AlertCircle },
    ] as const;

    return (
        <>
            <header className="page-header no-print">
                <h1 className="page-title">Reports</h1>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={handlePrint}>
                        <Printer size={18} />
                        Print
                    </button>
                    <button className="btn btn-primary" onClick={handleExportExcel}>
                        <FileSpreadsheet size={18} />
                        Export Excel
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .reports-layout {
            display: grid;
            grid-template-columns: 240px 1fr;
            gap: var(--space-6);
          }
          
          .reports-sidebar {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
          }
          
          .report-tabs {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            margin-bottom: var(--space-5);
          }
          
          .report-tab {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
            font-weight: var(--font-medium);
          }
          
          .report-tab:hover {
            background: var(--bg-tertiary);
          }
          
          .report-tab.active {
            background: var(--color-primary-600);
            color: var(--text-inverse);
          }
          
          .date-filters {
            border-top: 1px solid var(--border-light);
            padding-top: var(--space-4);
          }
          
          .date-filters-title {
            font-size: var(--text-sm);
            font-weight: var(--font-semibold);
            color: var(--text-secondary);
            margin-bottom: var(--space-3);
          }
          
          .report-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-6);
          }
          
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--space-6);
            padding-bottom: var(--space-4);
            border-bottom: 1px solid var(--border-light);
          }
          
          .report-title {
            font-size: var(--text-xl);
            font-weight: var(--font-semibold);
          }
          
          .report-period {
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
          
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          }
          
          .summary-card {
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            text-align: center;
          }
          
          .summary-value {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            color: var(--color-primary-600);
          }
          
          .summary-label {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            margin-top: var(--space-1);
          }
          
          .report-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .report-table th,
          .report-table td {
            padding: var(--space-3) var(--space-4);
            text-align: left;
            border-bottom: 1px solid var(--border-light);
          }
          
          .report-table th {
            font-weight: var(--font-semibold);
            background: var(--bg-tertiary);
            color: var(--text-secondary);
          }
          
          .report-table .numeric {
            text-align: right;
            font-family: var(--font-mono);
          }
          
          .chart-container {
            height: 300px;
            margin-bottom: var(--space-6);
          }
          
          @media print {
            .reports-sidebar {
              display: none;
            }
            
            .reports-layout {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

                <div className="reports-layout">
                    {/* Sidebar */}
                    <div className="reports-sidebar no-print">
                        <div className="report-tabs">
                            {reportTabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <div
                                        key={tab.id}
                                        className={`report-tab ${activeReport === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveReport(tab.id)}
                                    >
                                        <Icon size={18} />
                                        {tab.label}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="date-filters">
                            <div className="date-filters-title">
                                <Filter size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                Date Range
                            </div>
                            <div className="form-group">
                                <label className="form-label">From</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">To</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="report-content">
                        {isLoading ? (
                            <div className="empty-state">
                                <div className="loading-spinner" />
                            </div>
                        ) : (
                            <>
                                {/* Sales Report */}
                                {activeReport === 'sales' && reportData.sales && (
                                    <>
                                        <div className="report-header">
                                            <div>
                                                <h2 className="report-title">Sales Report</h2>
                                                <p className="report-period">
                                                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="summary-cards">
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.sales.summary.totalBills}</div>
                                                <div className="summary-label">Total Bills</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.totalSales)}</div>
                                                <div className="summary-label">Total Sales</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.totalGst)}</div>
                                                <div className="summary-label">Total GST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.avgBillValue)}</div>
                                                <div className="summary-label">Avg Bill Value</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">Sales Trend</h3>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={reportData.sales.trend}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" tickFormatter={(val) => formatDate(val, 'dd/MM')} />
                                                    <YAxis tickFormatter={(val) => `₹${(val / 1000).toFixed(0)} K`} />
                                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                                    <Bar dataKey="amount" fill="#1e8eb4" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <h3 className="font-semibold mb-4">Top Selling Medicines</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Medicine</th>
                                                    <th className="numeric">Qty Sold</th>
                                                    <th className="numeric">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.sales.topMeds.map((med: any, i: number) => (
                                                    <tr key={med.medicine_id}>
                                                        <td>{i + 1}</td>
                                                        <td>{med.medicine_name}</td>
                                                        <td className="numeric">{med.quantity_sold}</td>
                                                        <td className="numeric">{formatCurrency(med.total_revenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {/* GST Report */}
                                {activeReport === 'gst' && reportData.gst && (
                                    <>
                                        <div className="report-header">
                                            <div>
                                                <h2 className="report-title">GST Report</h2>
                                                <p className="report-period">
                                                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total / 2)}</div>
                                                <div className="summary-label">Total CGST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total / 2)}</div>
                                                <div className="summary-label">Total SGST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total)}</div>
                                                <div className="summary-label">Total GST</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">GST Breakup by Rate</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>GST Rate</th>
                                                    <th className="numeric">Taxable Value</th>
                                                    <th className="numeric">CGST</th>
                                                    <th className="numeric">SGST</th>
                                                    <th className="numeric">Total GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.gst.breakdown.map((g: any) => (
                                                    <tr key={g.gst_rate}>
                                                        <td>{g.gst_rate}%</td>
                                                        <td className="numeric">{formatCurrency(g.taxable_value)}</td>
                                                        <td className="numeric">{formatCurrency(g.cgst)}</td>
                                                        <td className="numeric">{formatCurrency(g.sgst)}</td>
                                                        <td className="numeric">{formatCurrency(g.total_gst)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ fontWeight: 'bold', background: 'var(--bg-tertiary)' }}>
                                                    <td>Total</td>
                                                    <td className="numeric">
                                                        {formatCurrency(reportData.gst.breakdown.reduce((s: number, g: any) => s + g.taxable_value, 0))}
                                                    </td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total / 2)}</td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total / 2)}</td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                )}

                                {/* Inventory Report */}
                                {activeReport === 'inventory' && reportData.inventory && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Stock Valuation Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.inventory.totalItems}</div>
                                                <div className="summary-label">Total Items</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.inventory.totalPurchaseValue)}</div>
                                                <div className="summary-label">Purchase Value</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.inventory.totalSaleValue)}</div>
                                                <div className="summary-label">Sale Value</div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Expiry Report */}
                                {activeReport === 'expiry' && reportData.expiry && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Expiry Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value text-danger">{reportData.expiry.expired.length}</div>
                                                <div className="summary-label">Expired Items</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value text-warning">{reportData.expiry.expiringSoon.length}</div>
                                                <div className="summary-label">Expiring in 30 Days</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.expiry.totalValue)}</div>
                                                <div className="summary-label">Total Value at Risk</div>
                                            </div>
                                        </div>

                                        {reportData.expiry.expired.length > 0 && (
                                            <>
                                                <h3 className="font-semibold mb-4 text-danger">Expired Items</h3>
                                                <table className="report-table mb-6">
                                                    <thead>
                                                        <tr>
                                                            <th>Medicine</th>
                                                            <th>Batch</th>
                                                            <th>Expiry</th>
                                                            <th className="numeric">Qty</th>
                                                            <th className="numeric">Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {reportData.expiry.expired.map((item: any) => (
                                                            <tr key={item.batch_id}>
                                                                <td>{item.medicine_name}</td>
                                                                <td>{item.batch_number}</td>
                                                                <td className="text-danger">{formatDate(item.expiry_date)}</td>
                                                                <td className="numeric">{item.quantity}</td>
                                                                <td className="numeric">{formatCurrency(item.selling_price * item.quantity)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Credit Report */}
                                {activeReport === 'credit' && reportData.credit && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Credit (Udhar) Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.credit.customers.length}</div>
                                                <div className="summary-label">Customers with Credit</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value text-danger">{formatCurrency(reportData.credit.total)}</div>
                                                <div className="summary-label">Total Outstanding</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">Outstanding Credits</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th>Phone</th>
                                                    <th className="numeric">Credit Limit</th>
                                                    <th className="numeric">Outstanding</th>
                                                    <th>Last Transaction</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.credit.customers.map((c: any) => (
                                                    <tr key={c.id}>
                                                        <td>{c.name}</td>
                                                        <td>{c.phone || '-'}</td>
                                                        <td className="numeric">{formatCurrency(c.credit_limit)}</td>
                                                        <td className="numeric text-danger font-semibold">{formatCurrency(c.current_balance)}</td>
                                                        <td>{c.last_transaction ? formatDate(c.last_transaction) : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ fontWeight: 'bold', background: 'var(--bg-tertiary)' }}>
                                                    <td colSpan={3}>Total</td>
                                                    <td className="numeric text-danger">{formatCurrency(reportData.credit.total)}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                )}

                                {/* Scheduled Drugs Report */}
                                {activeReport === 'scheduled' && reportData.scheduled && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Scheduled Drugs Sales Report</h2>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                                Register of Schedule H/H1 drug sales with patient and prescription details
                                            </p>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.scheduled.totalRecords}</div>
                                                <div className="summary-label">Total Records</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.scheduled.totalQuantity}</div>
                                                <div className="summary-label">Total Quantity Sold</div>
                                            </div>
                                        </div>

                                        {reportData.scheduled.records.length > 0 ? (
                                            <table className="report-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 40 }}></th>
                                                        <th>Date</th>
                                                        <th>Bill #</th>
                                                        <th>Medicine</th>
                                                        <th className="numeric">Qty</th>
                                                        <th>Patient</th>
                                                        <th>Doctor</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reportData.scheduled.records.map((r: ScheduledMedicineRecord) => {
                                                        const isExpanded = expandedRows.includes(r.id);
                                                        const toggleExpand = () => {
                                                            setExpandedRows(prev =>
                                                                isExpanded
                                                                    ? prev.filter(id => id !== r.id)
                                                                    : [...prev, r.id]
                                                            );
                                                        };
                                                        return (
                                                            <>
                                                                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={toggleExpand}>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                                    </td>
                                                                    <td>{formatDate(r.bill_date || r.created_at)}</td>
                                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.bill_number}</td>
                                                                    <td>{r.medicine_name}</td>
                                                                    <td className="numeric">{r.quantity}</td>
                                                                    <td style={{ fontWeight: 500 }}>{r.patient_name}</td>
                                                                    <td>{r.doctor_name || '-'}</td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr key={`${r.id}-details`} style={{ background: 'var(--bg-tertiary)' }}>
                                                                        <td colSpan={7} style={{ padding: 'var(--space-4)' }}>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', fontSize: 13 }}>
                                                                                <div>
                                                                                    <strong>Patient Details</strong>
                                                                                    <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                                                                                        <div>Age: {r.patient_age ? `${r.patient_age} years` : '-'}</div>
                                                                                        <div>Gender: {r.patient_gender || '-'}</div>
                                                                                        <div>Phone: {r.patient_phone || '-'}</div>
                                                                                        <div style={{ marginTop: 4 }}>Address: {r.patient_address || '-'}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <strong>Doctor Details</strong>
                                                                                    <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                                                                                        <div>Name: {r.doctor_name || '-'}</div>
                                                                                        <div>Reg. No: {r.doctor_registration_number || '-'}</div>
                                                                                        <div>Clinic/Hospital: {r.clinic_hospital_name || '-'}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <strong>Prescription</strong>
                                                                                    <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                                                                                        <div>Prescription No: {r.prescription_number || '-'}</div>
                                                                                        <div>Date: {r.prescription_date ? formatDate(r.prescription_date) : '-'}</div>
                                                                                        {r.doctor_prescription && (
                                                                                            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                                                                                                {r.doctor_prescription}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                                <AlertCircle size={48} strokeWidth={1} />
                                                <p style={{ marginTop: 16 }}>No scheduled drug sales found for this period</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
