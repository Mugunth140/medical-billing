// =====================================================
// MedBill - GST Calculation Service
// Handles all GST-related calculations for billing
// =====================================================

import type {
    BillCalculation,
    DiscountType,
    GstCalculation,
    GstRate,
    ItemCalculation,
    PriceType
} from '../types';

/**
 * Round to 2 decimal places
 */
export function round2(num: number): number {
    return Math.round(num * 100) / 100;
}

/**
 * Calculate GST for EXCLUSIVE pricing (price before GST)
 * Price given is the base price, GST is added on top
 * 
 * Formula:
 *   GST = price × gst_rate / 100
 *   Total = price + GST
 */
export function calculateGstExclusive(
    price: number,
    quantity: number,
    gstRate: GstRate,
    discount: number = 0
): GstCalculation {
    const grossAmount = price * quantity;
    const taxableValue = Math.max(0, grossAmount - discount);

    // For exempt items (0% GST)
    if (gstRate === 0) {
        return {
            basePrice: price,
            gstRate: 0,
            taxableValue: round2(taxableValue),
            cgst: 0,
            sgst: 0,
            totalGst: 0,
            total: round2(taxableValue)
        };
    }

    const totalGst = (taxableValue * gstRate) / 100;
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    return {
        basePrice: price,
        gstRate,
        taxableValue: round2(taxableValue),
        cgst: round2(cgst),
        sgst: round2(sgst),
        totalGst: round2(totalGst),
        total: round2(taxableValue + totalGst)
    };
}

/**
 * Calculate GST for INCLUSIVE pricing (MRP includes GST)
 * Price given is MRP, GST needs to be extracted
 * 
 * Formula:
 *   Base price = MRP × 100 / (100 + gst_rate)
 *   GST = MRP − Base price
 */
export function calculateGstInclusive(
    mrp: number,
    quantity: number,
    gstRate: GstRate,
    discount: number = 0
): GstCalculation {
    const grossAmount = mrp * quantity;
    const discountedAmount = Math.max(0, grossAmount - discount);

    // For exempt items (0% GST)
    if (gstRate === 0) {
        return {
            basePrice: mrp,
            gstRate: 0,
            taxableValue: round2(discountedAmount),
            cgst: 0,
            sgst: 0,
            totalGst: 0,
            total: round2(discountedAmount)
        };
    }

    // Extract base price from MRP
    const taxableValue = (discountedAmount * 100) / (100 + gstRate);
    const totalGst = discountedAmount - taxableValue;
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    return {
        basePrice: mrp,
        gstRate,
        taxableValue: round2(taxableValue),
        cgst: round2(cgst),
        sgst: round2(sgst),
        totalGst: round2(totalGst),
        total: round2(discountedAmount)
    };
}

/**
 * Calculate GST based on price type
 */
export function calculateGst(
    price: number,
    quantity: number,
    gstRate: GstRate,
    priceType: PriceType,
    discount: number = 0
): GstCalculation {
    if (priceType === 'INCLUSIVE') {
        return calculateGstInclusive(price, quantity, gstRate, discount);
    }
    return calculateGstExclusive(price, quantity, gstRate, discount);
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
    amount: number,
    discountType: DiscountType | undefined,
    discountValue: number
): number {
    if (!discountType || discountValue <= 0) {
        return 0;
    }

    if (discountType === 'PERCENTAGE') {
        return round2((amount * discountValue) / 100);
    }

    // FLAT discount
    return round2(Math.min(discountValue, amount));
}

/**
 * Calculate a single bill item with GST
 */
export function calculateBillItem(
    unitPrice: number,
    quantity: number,
    gstRate: GstRate,
    priceType: PriceType,
    discountType?: DiscountType,
    discountValue?: number
): ItemCalculation {
    const grossAmount = round2(unitPrice * quantity);
    const discountAmount = calculateDiscount(
        grossAmount,
        discountType,
        discountValue ?? 0
    );

    const gstCalc = calculateGst(
        unitPrice,
        quantity,
        gstRate,
        priceType,
        discountAmount
    );

    return {
        batchId: 0, // Will be set by caller
        quantity,
        unitPrice,
        priceType,
        gstRate,
        grossAmount,
        discountAmount,
        taxableValue: gstCalc.taxableValue,
        cgst: gstCalc.cgst,
        sgst: gstCalc.sgst,
        totalGst: gstCalc.totalGst,
        total: gstCalc.total
    };
}

/**
 * Interface for batch info needed for calculation
 */
interface BatchInfo {
    id: number;
    selling_price: number;
    price_type: PriceType;
    gst_rate: GstRate;
}

/**
 * Calculate complete bill with multiple items
 */
export function calculateBill(
    items: Array<{
        batch: BatchInfo;
        quantity: number;
        discountType?: DiscountType;
        discountValue?: number;
    }>,
    billDiscountType?: DiscountType,
    billDiscountValue?: number
): BillCalculation {
    // Calculate each item
    const calculatedItems: ItemCalculation[] = items.map(item => {
        const calc = calculateBillItem(
            item.batch.selling_price,
            item.quantity,
            item.batch.gst_rate,
            item.batch.price_type,
            item.discountType,
            item.discountValue
        );
        calc.batchId = item.batch.id;
        return calc;
    });

    // Sum up totals
    const subtotal = calculatedItems.reduce((sum, item) => sum + item.grossAmount, 0);
    const itemDiscountTotal = calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const taxableTotal = calculatedItems.reduce((sum, item) => sum + item.taxableValue, 0);
    const totalCgst = calculatedItems.reduce((sum, item) => sum + item.cgst, 0);
    const totalSgst = calculatedItems.reduce((sum, item) => sum + item.sgst, 0);
    const totalGst = calculatedItems.reduce((sum, item) => sum + item.totalGst, 0);
    const itemsTotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate bill-level discount
    const billDiscount = calculateDiscount(
        itemsTotal,
        billDiscountType,
        billDiscountValue ?? 0
    );

    const grandTotal = round2(itemsTotal - billDiscount);

    // Round off to nearest rupee
    const roundOff = round2(Math.round(grandTotal) - grandTotal);
    const finalAmount = Math.round(grandTotal);

    return {
        items: calculatedItems,
        subtotal: round2(subtotal),
        itemDiscountTotal: round2(itemDiscountTotal),
        taxableTotal: round2(taxableTotal),
        totalCgst: round2(totalCgst),
        totalSgst: round2(totalSgst),
        totalGst: round2(totalGst),
        billDiscount: round2(billDiscount),
        grandTotal: round2(grandTotal),
        roundOff,
        finalAmount
    };
}

/**
 * Get HSN code for a GST rate (common pharma HSN codes)
 */
export function getDefaultHsnCode(gstRate: GstRate): string {
    switch (gstRate) {
        case 0:
            return '3002'; // Exempt medicines, blood products
        case 5:
            return '3004'; // Essential medicines
        case 12:
            return '3004'; // Allopathic medicines
        case 18:
            return '2106'; // Vitamins, supplements
        default:
            return '3004';
    }
}

/**
 * Validate GST rate
 */
export function isValidGstRate(rate: number): rate is GstRate {
    return [0, 5, 12, 18].includes(rate);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format GST breakup for display
 */
export function formatGstBreakup(gstCalc: GstCalculation): string {
    if (gstCalc.gstRate === 0) {
        return 'GST Exempt';
    }
    return `CGST ${gstCalc.gstRate / 2}%: ${formatCurrency(gstCalc.cgst)} + SGST ${gstCalc.gstRate / 2}%: ${formatCurrency(gstCalc.sgst)}`;
}

/**
 * Group bill items by GST rate for summary
 */
export function groupByGstRate(items: ItemCalculation[]): Map<GstRate, {
    taxableValue: number;
    cgst: number;
    sgst: number;
    totalGst: number;
}> {
    const grouped = new Map<GstRate, {
        taxableValue: number;
        cgst: number;
        sgst: number;
        totalGst: number;
    }>();

    for (const item of items) {
        const existing = grouped.get(item.gstRate) ?? {
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            totalGst: 0
        };

        grouped.set(item.gstRate, {
            taxableValue: round2(existing.taxableValue + item.taxableValue),
            cgst: round2(existing.cgst + item.cgst),
            sgst: round2(existing.sgst + item.sgst),
            totalGst: round2(existing.totalGst + item.totalGst)
        });
    }

    return grouped;
}

export default {
    round2,
    calculateGstExclusive,
    calculateGstInclusive,
    calculateGst,
    calculateDiscount,
    calculateBillItem,
    calculateBill,
    getDefaultHsnCode,
    isValidGstRate,
    formatCurrency,
    formatGstBreakup,
    groupByGstRate
};
