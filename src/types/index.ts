// =====================================================
// MedBill - Core TypeScript Types
// GST-Compliant Medical Billing & Inventory System
// =====================================================

// =====================================================
// ENUMS
// =====================================================

export type UserRole = 'admin' | 'staff';

export type GstRate = 0 | 5 | 12 | 18;

export type Taxability = 'TAXABLE' | 'EXEMPT';

export type PriceType = 'INCLUSIVE' | 'EXCLUSIVE';

export type PaymentMode = 'CASH' | 'ONLINE' | 'CREDIT' | 'SPLIT';

export type BillStatus = 'COMPLETED' | 'CANCELLED' | 'RETURNED';

export type DiscountType = 'PERCENTAGE' | 'FLAT';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export type ReturnReason = 'EXPIRY' | 'DAMAGE' | 'OVERSTOCK' | 'OTHER';

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'COMPLETED';

export type RefundMode = 'CASH' | 'CREDIT_NOTE' | 'ADJUSTMENT';

export type CreditTransactionType = 'SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'RETURN';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type ExpiryStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED';

// =====================================================
// CORE ENTITIES
// =====================================================

export interface User {
    id: number;
    username: string;
    password_hash: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    last_login?: string;
    created_at: string;
    updated_at: string;
}

export interface Medicine {
    id: number;
    name: string;
    generic_name?: string;
    manufacturer?: string;
    hsn_code: string;
    category?: string;
    drug_type?: string;
    pack_size?: string;
    unit: string;
    reorder_level: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Batch {
    id: number;
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    purchase_price: number;
    mrp: number;
    selling_price: number;
    price_type: PriceType;
    gst_rate: GstRate;
    is_schedule: boolean;
    quantity: number;
    tablets_per_strip: number;
    rack?: string;
    box?: string;
    last_sold_date?: string;
    purchase_id?: number;
    supplier_id?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Supplier {
    id: number;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state: string;
    pincode?: string;
    payment_terms: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Customer {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    credit_limit: number;
    current_balance: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// =====================================================
// BILLING
// =====================================================

export interface Bill {
    id: number;
    bill_number: string;
    bill_date: string;
    customer_id?: number;
    customer_name?: string;
    doctor_name?: string;
    user_id: number;

    subtotal: number;
    discount_type?: DiscountType;
    discount_value: number;
    discount_amount: number;
    taxable_total: number;
    total_cgst: number;
    total_sgst: number;
    total_gst: number;
    cgst_amount: number; // Alias for total_cgst
    sgst_amount: number; // Alias for total_sgst
    grand_total: number;
    round_off: number;
    total_items: number;

    payment_mode: PaymentMode;
    payment_status: PaymentStatus;
    cash_amount: number;
    online_amount: number;
    credit_amount: number;

    is_cancelled: number;
    notes?: string;

    created_at: string;
    updated_at: string;

    // Joined data
    items?: BillItem[];
    customer?: Customer;
    user?: User;
}

export interface BillItem {
    id: number;
    bill_id: number;
    batch_id: number;
    medicine_id: number;

    medicine_name: string;
    hsn_code: string;
    batch_number: string;
    expiry_date?: string;
    rack?: string;
    box?: string;

    quantity: number;
    quantity_strips: number;
    quantity_pieces: number;
    tablets_per_strip: number;

    // Pricing fields (match database schema)
    selling_price: number;  // Per strip price from batch
    mrp: number;            // Max retail price per strip
    unit_price?: number;    // Optional alias (not in DB, for compatibility)
    price_type?: PriceType;

    discount_type?: DiscountType;
    discount_value?: number;
    discount_percent?: number;
    discount_amount: number;

    taxable_value?: number;
    taxable_amount: number;
    gst_rate: GstRate;
    cgst?: number;
    cgst_amount: number;
    sgst?: number;
    sgst_amount: number;
    total_gst?: number;

    total?: number;
    total_amount: number;

    created_at: string;
}


// =====================================================
// PURCHASES
// =====================================================

export interface Purchase {
    id: number;
    invoice_number: string;
    invoice_date: string;
    supplier_id: number;
    user_id: number;

    subtotal: number;
    total_cgst: number;
    total_sgst: number;
    total_gst: number;
    grand_total: number;

    payment_status: PaymentStatus;
    paid_amount: number;
    due_date?: string;

    notes?: string;
    created_at: string;
    updated_at: string;

    // Joined data
    items?: PurchaseItem[];
    supplier?: Supplier;
}

export interface PurchaseItem {
    id: number;
    purchase_id: number;
    medicine_id: number;
    batch_id: number;

    quantity: number;
    free_quantity: number;

    purchase_price: number;
    mrp: number;
    selling_price: number;

    gst_rate: GstRate;
    cgst: number;
    sgst: number;
    total_gst: number;

    total: number;

    created_at: string;
}

// =====================================================
// RETURNS
// =====================================================

export interface PurchaseReturn {
    id: number;
    return_number: string;
    return_date: string;
    supplier_id: number;
    purchase_id?: number;
    user_id: number;

    reason: ReturnReason;
    total_amount: number;
    total_gst: number;

    status: ReturnStatus;
    notes?: string;

    created_at: string;
    updated_at: string;

    items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
    id: number;
    return_id: number;
    batch_id: number;
    medicine_id: number;

    quantity: number;
    unit_price: number;
    gst_rate: GstRate;
    cgst: number;
    sgst: number;
    total: number;

    created_at: string;
}

export interface SalesReturn {
    id: number;
    return_number: string;
    return_date: string;
    bill_id: number;
    customer_id?: number;
    user_id: number;

    reason?: string;
    refund_mode?: RefundMode;
    total_amount: number;
    total_gst: number;

    status: string;
    notes?: string;

    created_at: string;

    items?: SalesReturnItem[];
}

export interface SalesReturnItem {
    id: number;
    return_id: number;
    bill_item_id: number;
    batch_id: number;

    quantity: number;
    unit_price: number;
    gst_rate: GstRate;
    cgst: number;
    sgst: number;
    total: number;

    created_at: string;
}

// =====================================================
// CREDITS
// =====================================================

export interface Credit {
    id: number;
    customer_id: number;
    bill_id?: number;

    transaction_type: CreditTransactionType;
    amount: number;
    balance_after: number;

    payment_mode?: string;
    reference?: string;
    notes?: string;

    user_id: number;
    created_at: string;

    // Joined data
    customer?: Customer;
    bill?: Bill;
}

// =====================================================
// AUDIT & SETTINGS
// =====================================================

export interface AuditLog {
    id: number;
    user_id: number;
    action: string;
    entity_type: string;
    entity_id?: number;
    old_value?: string;
    new_value?: string;
    description?: string;
    created_at: string;

    user?: User;
}

export interface Setting {
    key: string;
    value: string;
    category: string;
    description?: string;
    updated_at: string;
}

// =====================================================
// VIEW TYPES (Computed)
// =====================================================

export interface StockItem {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    purchase_price: number;
    mrp: number;
    selling_price: number;
    price_type: PriceType;
    gst_rate: GstRate;
    is_schedule: boolean;
    quantity: number;
    tablets_per_strip: number;
    rack?: string;
    box?: string;
    last_sold_date?: string;
    supplier_id?: number;

    medicine_id: number;
    medicine_name: string;
    generic_name?: string;
    manufacturer?: string;
    hsn_code: string;
    category?: string;
    pack_size?: string;
    unit: string;
    reorder_level: number;

    stock_status: StockStatus;
    expiry_status: ExpiryStatus;
    days_to_expiry: number;
}

export interface ScheduledMedicineRecord {
    id: number;
    bill_id: number;
    bill_item_id: number;
    medicine_id: number;
    batch_id: number;
    patient_name: string;
    patient_age?: number;
    patient_gender?: 'M' | 'F' | 'O';
    patient_phone?: string;
    patient_address?: string;
    doctor_name?: string;
    doctor_registration_number?: string;
    clinic_hospital_name?: string;
    prescription_number?: string;
    prescription_date?: string;
    doctor_prescription?: string;
    quantity: number;
    created_at: string;
    // Joined data
    medicine_name?: string;
    batch_number?: string;
    bill_number?: string;
    bill_date?: string;
}

export interface ScheduledMedicineInput {
    patient_name: string;
    patient_age?: number;
    patient_gender?: 'M' | 'F' | 'O';
    patient_phone?: string;
    patient_address?: string;
    doctor_name?: string;
    doctor_registration_number?: string;
    clinic_hospital_name?: string;
    prescription_number?: string;
    prescription_date?: string;
    doctor_prescription?: string;
}

export interface CustomerCreditSummary {
    id: number;
    name: string;
    phone?: string;
    credit_limit: number;
    current_balance: number;
    total_credit_bills: number;
    last_transaction_date?: string;
}

export interface TodaySalesSummary {
    total_bills: number;
    total_amount: number;
    cash_amount: number;
    online_amount: number;
    credit_amount: number;
    total_gst: number;
}

// =====================================================
// FORM/INPUT TYPES
// =====================================================

export interface CreateMedicineInput {
    name: string;
    generic_name?: string;
    manufacturer?: string;
    hsn_code?: string;
    category?: string;
    drug_type?: string;
    pack_size?: string;
    unit?: string;
    reorder_level?: number;
}

export interface CreateBatchInput {
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    purchase_price: number;
    mrp: number;
    selling_price: number;
    price_type: PriceType;
    gst_rate: GstRate;
    is_schedule?: boolean;
    quantity: number;
    tablets_per_strip?: number;
    rack?: string;
    box?: string;
    supplier_id?: number;
}

export interface CreateSupplierInput {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    payment_terms?: number;
}

export interface CreateCustomerInput {
    name: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
    credit_limit?: number;
}

export interface BillItemInput {
    batch_id: number;
    quantity: number;
    quantity_strips?: number;
    quantity_pieces?: number;
    discount_type?: DiscountType;
    discount_value?: number;
}

export interface CreateBillInput {
    customer_id?: number;
    customer_name?: string;
    doctor_name?: string;
    items: BillItemInput[];
    discount_type?: DiscountType;
    discount_value?: number;
    payment_mode: PaymentMode;
    cash_amount?: number;
    online_amount?: number;
    notes?: string;
    // Patient details for scheduled medicines
    patient_info?: ScheduledMedicineInput;
}

// =====================================================
// GST CALCULATION TYPES
// =====================================================

export interface GstCalculation {
    basePrice: number;
    gstRate: GstRate;
    taxableValue: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    total: number;
}

export interface BillCalculation {
    items: ItemCalculation[];
    subtotal: number;
    itemDiscountTotal: number;
    taxableTotal: number;
    totalCgst: number;
    totalSgst: number;
    totalGst: number;
    billDiscount: number;
    grandTotal: number;
    roundOff: number;
    finalAmount: number;
}

export interface ItemCalculation {
    batchId: number;
    quantity: number;
    unitPrice: number;
    priceType: PriceType;
    gstRate: GstRate;
    grossAmount: number;
    discountAmount: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    total: number;
}

// =====================================================
// DASHBOARD & ANALYTICS
// =====================================================

export interface DashboardStats {
    todaySales: TodaySalesSummary;
    monthlySales: number;
    pendingCredits: number;
    expiringMedicines: number;
    nonMovingItems: number;
    lowStockItems: number;
    lastBackupDate?: string;
}

export interface SalesTrend {
    date: string;
    amount: number;
    bills: number;
}

export interface PaymentModeBreakdown {
    mode: PaymentMode;
    amount: number;
    count: number;
}

export interface TopSellingMedicine {
    medicine_id: number;
    medicine_name: string;
    quantity_sold: number;
    total_revenue: number;
}

// =====================================================
// RUNNING BILLS - For non-stocked medicine sales
// Creates actual bills but tracks pending stock reconciliation
// =====================================================

export type RunningBillStatus = 'PENDING' | 'STOCKED' | 'CANCELLED';

export interface RunningBill {
    id: number;
    bill_id: number;
    bill_item_id?: number;
    medicine_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    gst_rate: number;
    hsn_code: string;
    notes?: string;
    user_id: number;
    status: RunningBillStatus;
    linked_batch_id?: number;
    linked_medicine_id?: number;
    stocked_at?: string;
    stocked_by?: number;
    created_at: string;
    updated_at: string;
    // Joined fields from bills table
    bill_number?: string;
    bill_date?: string;
    customer_name?: string;
    user_name?: string;
    stocked_by_name?: string;
}

export interface CreateRunningBillInput {
    medicine_name: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
    hsn_code?: string;
    customer_name?: string;
    customer_phone?: string;
    notes?: string;
}

// =====================================================
// APP STATE
// =====================================================

export interface AppState {
    user: User | null;
    isAuthenticated: boolean;
    settings: Record<string, string>;
}

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}
