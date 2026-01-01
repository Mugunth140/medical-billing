// =====================================================
// MedBill - Billing Service
// Sales Bill Creation and Management
// =====================================================

import type {
    Bill,
    BillItem,
    CreateBillInput,
    PaymentMode,
    StockItem
} from '../types';
import { execute, query, queryOne, transaction } from './database';
import { calculateBill } from './gst.service';
import { getBatchWithMedicine, updateBatchQuantity } from './inventory.service';

// =====================================================
// BILL NUMBER GENERATION
// =====================================================

/**
 * Generate next bill number
 * Format: INV-242500001 (prefix + 2-digit year start + 2-digit year end + 5-digit sequence)
 */
export async function generateBillNumber(): Promise<string> {
    // Get current sequence
    const seq = await queryOne<{
        prefix: string;
        current_number: number;
        financial_year: string;
    }>('SELECT prefix, current_number, financial_year FROM bill_sequence WHERE id = 1', []);

    if (!seq) {
        throw new Error('Bill sequence not initialized');
    }

    // Increment sequence
    const nextNumber = seq.current_number + 1;
    await execute(
        'UPDATE bill_sequence SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [nextNumber]
    );

    // Format: INV-242500001 (prefix + 4-digit year code + 5-digit sequence)
    // Extract year codes from financial_year (e.g., "2024-25" -> "2425")
    const yearParts = seq.financial_year.split('-');
    const yearCode = yearParts.length === 2
        ? yearParts[0].slice(-2) + yearParts[1].slice(-2)
        : new Date().getFullYear().toString().slice(-2) + (new Date().getFullYear() + 1).toString().slice(-2);
    const paddedNumber = nextNumber.toString().padStart(5, '0');
    return `${seq.prefix}-${yearCode}${paddedNumber}`;
}

// =====================================================
// BILL CREATION
// =====================================================

/**
 * Create a new bill with items
 */
export async function createBill(
    input: CreateBillInput,
    userId: number
): Promise<Bill> {
    return await transaction(async () => {
        // 1. Fetch all batch details
        const batchDetails: Array<{
            input: typeof input.items[0];
            batch: StockItem;
        }> = [];

        for (const item of input.items) {
            const batch = await getBatchWithMedicine(item.batch_id);
            if (!batch) {
                throw new Error(`Batch not found: ${item.batch_id}`);
            }
            // Stock is now stored in tablets/pieces
            if (batch.quantity < item.quantity) {
                const tabletsPerStrip = batch.tablets_per_strip || 10;
                const strips = Math.floor(batch.quantity / tabletsPerStrip);
                const pcs = batch.quantity % tabletsPerStrip;
                throw new Error(`Insufficient stock for ${batch.medicine_name}. Available: ${strips} strips + ${pcs} pcs (${batch.quantity} total)`);
            }
            if (batch.expiry_status === 'EXPIRED') {
                throw new Error(`Cannot sell expired medicine: ${batch.medicine_name}`);
            }
            batchDetails.push({ input: item, batch });
        }

        // 2. Calculate bill totals (using per-piece pricing)
        const billCalc = calculateBill(
            batchDetails.map(d => {
                const tabletsPerStrip = d.batch.tablets_per_strip || 10;
                const pricePerPiece = d.batch.selling_price / tabletsPerStrip;
                return {
                    batch: {
                        id: d.batch.batch_id,
                        selling_price: pricePerPiece,
                        price_type: d.batch.price_type,
                        gst_rate: d.batch.gst_rate
                    },
                    quantity: d.input.quantity, // In tablets/pieces
                    discountType: d.input.discount_type,
                    discountValue: d.input.discount_value
                };
            }),
            input.discount_type,
            input.discount_value
        );

        // 3. Calculate payment amounts
        let cashAmount = 0;
        let onlineAmount = 0;
        let creditAmount = 0;

        switch (input.payment_mode) {
            case 'CASH':
                cashAmount = billCalc.finalAmount;
                break;
            case 'ONLINE':
                onlineAmount = billCalc.finalAmount;
                break;
            case 'CREDIT':
                creditAmount = billCalc.finalAmount;
                break;
            case 'SPLIT':
                cashAmount = input.cash_amount ?? 0;
                onlineAmount = input.online_amount ?? 0;
                creditAmount = billCalc.finalAmount - cashAmount - onlineAmount;
                break;
        }

        // 4. Generate bill number
        const billNumber = await generateBillNumber();

        // 5. Insert bill
        console.log('Inserting bill...', { billNumber, userId, totals: billCalc });
        const billResult = await execute(
            `INSERT INTO bills (
        bill_number, customer_id, customer_name, user_id,
        subtotal, discount_amount, discount_percent,
        taxable_amount, cgst_amount, sgst_amount, total_gst,
        grand_total, round_off, payment_mode,
        cash_amount, online_amount, credit_amount, notes, total_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                billNumber,
                input.customer_id ?? null,
                input.customer_name ?? null,
                userId,
                billCalc.subtotal,
                billCalc.billDiscount,
                input.discount_value ?? 0,
                billCalc.taxableTotal,
                billCalc.totalCgst,
                billCalc.totalSgst,
                billCalc.totalGst,
                billCalc.finalAmount,
                billCalc.roundOff,
                input.payment_mode,
                cashAmount,
                onlineAmount,
                creditAmount,
                input.notes ?? null,
                input.items.length
            ]
        );

        const billId = billResult.lastInsertId;
        console.log('Bill inserted, ID:', billId);

        // 6. Insert bill items and update stock
        for (let i = 0; i < batchDetails.length; i++) {
            const { input: itemInput, batch } = batchDetails[i];
            const itemCalc = billCalc.items[i];

            console.log(`Inserting item ${i + 1}/${batchDetails.length}`, { batchId: batch.batch_id, quantity: itemInput.quantity });
            await execute(
                `INSERT INTO bill_items (
          bill_id, batch_id, medicine_id, medicine_name, hsn_code,
          batch_number, quantity, quantity_strips, quantity_pieces, tablets_per_strip,
          unit, mrp, selling_price,
          discount_percent, discount_amount, taxable_amount,
          gst_rate, cgst_amount, sgst_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    billId,
                    batch.batch_id,
                    batch.medicine_id,
                    batch.medicine_name,
                    batch.hsn_code,
                    batch.batch_number,
                    itemInput.quantity,
                    itemInput.quantity_strips ?? 0,
                    itemInput.quantity_pieces ?? 0,
                    batch.tablets_per_strip || 10,
                    batch.unit ?? 'PCS',
                    batch.mrp,
                    batch.selling_price,
                    itemInput.discount_value ?? 0,
                    itemCalc.discountAmount,
                    itemCalc.taxableValue,
                    batch.gst_rate,
                    itemCalc.cgst,
                    itemCalc.sgst,
                    itemCalc.total
                ]
            );

            const billItemId = (await queryOne<{ last_insert_rowid: number }>(
                'SELECT last_insert_rowid() as last_insert_rowid', []
            ))?.last_insert_rowid ?? 0;

            // Update batch quantity (stored in tablets) and last sold date
            await updateBatchQuantity(batch.batch_id, -itemInput.quantity, true);

            // 6b. If this is a scheduled medicine and patient info is provided, save the record
            if (batch.is_schedule && input.patient_info && input.patient_info.patient_name) {
                await execute(
                    `INSERT INTO scheduled_medicine_records (
                        bill_id, bill_item_id, medicine_id, batch_id,
                        patient_name, patient_age, patient_gender, patient_phone,
                        patient_address, doctor_name, prescription_number, quantity
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        billId,
                        billItemId,
                        batch.medicine_id,
                        batch.batch_id,
                        input.patient_info.patient_name,
                        input.patient_info.patient_age ?? null,
                        input.patient_info.patient_gender ?? null,
                        input.patient_info.patient_phone ?? null,
                        input.patient_info.patient_address ?? null,
                        input.patient_info.doctor_name ?? null,
                        input.patient_info.prescription_number ?? null,
                        itemInput.quantity
                    ]
                );
            }
        }

        // 7. Handle credit if applicable
        if (creditAmount > 0 && input.customer_id) {
            // Get current customer balance
            const customer = await queryOne<{ current_balance: number }>(
                'SELECT current_balance FROM customers WHERE id = ?',
                [input.customer_id]
            );

            const newBalance = (customer?.current_balance ?? 0) + creditAmount;

            // Add credit transaction
            await execute(
                `INSERT INTO credits (
          customer_id, bill_id, transaction_type, amount, balance_after, user_id
        ) VALUES (?, ?, 'SALE', ?, ?, ?)`,
                [input.customer_id, billId, creditAmount, newBalance, userId]
            );

            // Update customer balance
            await execute(
                'UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newBalance, input.customer_id]
            );
        }

        // 8. Return created bill
        console.log('Fetching created bill:', billId);
        const bill = await getBillById(billId);
        if (!bill) {
            console.error('Failed to fetch created bill', billId);
            throw new Error('Failed to create bill - could not fetch after insert');
        }
        return bill;
    });
}

// =====================================================
// BILL QUERIES
// =====================================================

/**
 * Get bill by ID with items
 */
export async function getBillById(id: number): Promise<Bill | null> {
    const bill = await queryOne<Bill>(
        `SELECT * FROM bills WHERE id = ?`,
        [id]
    );

    if (!bill) return null;

    const items = await query<BillItem>(
        `SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id`,
        [id]
    );

    return { ...bill, items };
}

/**
 * Get bill by bill number
 */
export async function getBillByNumber(billNumber: string): Promise<Bill | null> {
    const bill = await queryOne<Bill>(
        `SELECT * FROM bills WHERE bill_number = ?`,
        [billNumber]
    );

    if (!bill) return null;

    const items = await query<BillItem>(
        `SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id`,
        [bill.id]
    );

    return { ...bill, items };
}

/**
 * Get bills for a date range
 */
export async function getBills(options: {
    startDate?: string;
    endDate?: string;
    customerId?: number;
    paymentMode?: PaymentMode;
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<Bill[]> {
    let sql = `SELECT * FROM bills WHERE 1=1`;
    const params: unknown[] = [];

    if (options.startDate) {
        sql += ` AND date(bill_date) >= ?`;
        params.push(options.startDate);
    }
    if (options.endDate) {
        sql += ` AND date(bill_date) <= ?`;
        params.push(options.endDate);
    }
    if (options.customerId) {
        sql += ` AND customer_id = ?`;
        params.push(options.customerId);
    }
    if (options.paymentMode) {
        sql += ` AND payment_mode = ?`;
        params.push(options.paymentMode);
    }
    if (options.status === 'COMPLETED') {
        sql += ` AND is_cancelled = 0`;
    } else if (options.status === 'CANCELLED') {
        sql += ` AND is_cancelled = 1`;
    }

    sql += ` ORDER BY bill_date DESC`;

    if (options.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
        if (options.offset) {
            sql += ` OFFSET ?`;
            params.push(options.offset);
        }
    }

    return await query<Bill>(sql, params);
}

/**
 * Get today's bills
 */
export async function getTodaysBills(): Promise<Bill[]> {
    return await getBills({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
}

// =====================================================
// SALES ANALYTICS
// =====================================================

/**
 * Get today's sales summary
 */
export async function getTodaysSalesSummary(): Promise<{
    totalBills: number;
    totalAmount: number;
    cashAmount: number;
    onlineAmount: number;
    creditAmount: number;
    totalGst: number;
}> {
    const result = await queryOne<{
        total_bills: number;
        total_amount: number;
        cash_amount: number;
        online_amount: number;
        credit_amount: number;
        total_gst: number;
    }>(
        `SELECT 
      COUNT(*) AS total_bills,
      COALESCE(SUM(grand_total), 0) AS total_amount,
      COALESCE(SUM(cash_amount), 0) AS cash_amount,
      COALESCE(SUM(online_amount), 0) AS online_amount,
      COALESCE(SUM(credit_amount), 0) AS credit_amount,
      COALESCE(SUM(total_gst), 0) AS total_gst
    FROM bills
    WHERE date(bill_date) = date('now') AND is_cancelled = 0`,
        []
    );

    return {
        totalBills: result?.total_bills ?? 0,
        totalAmount: result?.total_amount ?? 0,
        cashAmount: result?.cash_amount ?? 0,
        onlineAmount: result?.online_amount ?? 0,
        creditAmount: result?.credit_amount ?? 0,
        totalGst: result?.total_gst ?? 0
    };
}

/**
 * Get monthly sales summary
 */
export async function getMonthlySalesSummary(year: number, month: number): Promise<{
    totalBills: number;
    totalAmount: number;
    totalGst: number;
}> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const result = await queryOne<{
        total_bills: number;
        total_amount: number;
        total_gst: number;
    }>(
        `SELECT 
      COUNT(*) AS total_bills,
      COALESCE(SUM(grand_total), 0) AS total_amount,
      COALESCE(SUM(total_gst), 0) AS total_gst
    FROM bills
    WHERE date(bill_date) BETWEEN ? AND ? AND is_cancelled = 0`,
        [startDate, endDate]
    );

    return {
        totalBills: result?.total_bills ?? 0,
        totalAmount: result?.total_amount ?? 0,
        totalGst: result?.total_gst ?? 0
    };
}

/**
 * Get sales trend (daily sales for a period)
 */
export async function getSalesTrend(days: number = 30): Promise<Array<{
    date: string;
    amount: number;
    bills: number;
}>> {
    const result = await query<{
        date: string;
        amount: number;
        bills: number;
    }>(
        `SELECT 
      date(bill_date) AS date,
      COALESCE(SUM(grand_total), 0) AS amount,
      COUNT(*) AS bills
    FROM bills
    WHERE date(bill_date) >= date('now', '-' || ? || ' days')
      AND is_cancelled = 0
    GROUP BY date(bill_date)
    ORDER BY date ASC`,
        [days]
    );

    return result;
}

/**
 * Get payment mode breakdown
 */
export async function getPaymentModeBreakdown(startDate?: string, endDate?: string): Promise<Array<{
    mode: PaymentMode;
    amount: number;
    count: number;
}>> {
    let sql = `
    SELECT 
      payment_mode AS mode,
      COALESCE(SUM(grand_total), 0) AS amount,
      COUNT(*) AS count
    FROM bills
    WHERE is_cancelled = 0
  `;
    const params: unknown[] = [];

    if (startDate) {
        sql += ` AND date(bill_date) >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        sql += ` AND date(bill_date) <= ?`;
        params.push(endDate);
    }

    sql += ` GROUP BY payment_mode`;

    return await query<{ mode: PaymentMode; amount: number; count: number }>(sql, params);
}

/**
 * Get top selling medicines
 */
export async function getTopSellingMedicines(
    limit: number = 10,
    days: number = 30
): Promise<Array<{
    medicine_id: number;
    medicine_name: string;
    quantity_sold: number;
    total_revenue: number;
}>> {
    const result = await query<{
        medicine_id: number;
        medicine_name: string;
        quantity_sold: number;
        total_revenue: number;
    }>(
        `SELECT 
      bi.medicine_id,
      bi.medicine_name,
      SUM(bi.quantity) AS quantity_sold,
      SUM(bi.total) AS total_revenue
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE b.is_cancelled = 0
      AND date(b.bill_date) >= date('now', '-' || ? || ' days')
    GROUP BY bi.medicine_id, bi.medicine_name
    ORDER BY quantity_sold DESC
    LIMIT ?`,
        [days, limit]
    );

    return result;
}

// =====================================================
// BILL OPERATIONS
// =====================================================

/**
 * Cancel a bill
 */
export async function cancelBill(billId: number, userId: number, reason: string): Promise<void> {
    await transaction(async () => {
        // Get bill with items
        const bill = await getBillById(billId);
        if (!bill) throw new Error('Bill not found');
        if (bill.is_cancelled) throw new Error('Bill already cancelled or returned');

        // Restore stock for each item
        for (const item of bill.items ?? []) {
            await updateBatchQuantity(item.batch_id, item.quantity, false);
        }

        // If credit was used, reverse it
        if (bill.credit_amount > 0 && bill.customer_id) {
            const customer = await queryOne<{ current_balance: number }>(
                'SELECT current_balance FROM customers WHERE id = ?',
                [bill.customer_id]
            );

            const newBalance = (customer?.current_balance ?? 0) - bill.credit_amount;

            await execute(
                `INSERT INTO credits (
          customer_id, bill_id, transaction_type, amount, balance_after, notes, user_id
        ) VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?)`,
                [bill.customer_id, billId, -bill.credit_amount, newBalance, 'Bill cancelled', userId]
            );

            await execute(
                'UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newBalance, bill.customer_id]
            );
        }

        // Update bill status
        await execute(
            `UPDATE bills SET is_cancelled = 1, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [reason, billId]
        );

        // Add audit log
        await execute(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, description)
       VALUES (?, 'CANCEL', 'bill', ?, ?)`,
            [userId, billId, reason]
        );
    });
}

export default {
    generateBillNumber,
    createBill,
    getBillById,
    getBillByNumber,
    getBills,
    getTodaysBills,
    getTodaysSalesSummary,
    getMonthlySalesSummary,
    getSalesTrend,
    getPaymentModeBreakdown,
    getTopSellingMedicines,
    cancelBill
};
