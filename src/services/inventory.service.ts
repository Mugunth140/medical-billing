// =====================================================
// MedBill - Inventory Service
// Medicine and Batch Management
// =====================================================

import type {
    Batch,
    CreateBatchInput,
    CreateMedicineInput,
    Medicine,
    StockItem
} from '../types';
import { execute, query, queryOne } from './database';

// =====================================================
// MEDICINE OPERATIONS
// =====================================================

/**
 * Get all active medicines
 */
export async function getMedicines(searchTerm?: string): Promise<Medicine[]> {
  let sql = `SELECT * FROM medicines WHERE is_active = 1`;
  const params: unknown[] = [];

  if (searchTerm) {
    sql += ` AND (name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ?)`;
    const term = `%${searchTerm}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY name ASC`;

  return await query<Medicine>(sql, params);
}

/**
 * Get medicine by ID
 */
export async function getMedicineById(id: number): Promise<Medicine | null> {
  return await queryOne<Medicine>(
    `SELECT * FROM medicines WHERE id = ? AND is_active = 1`,
    [id]
  );
}

/**
 * Search medicines with stock info for billing
 */
export async function searchMedicinesForBilling(searchTerm: string): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      COALESCE(m.is_schedule, 0) AS is_schedule,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 
      AND m.is_active = 1
      AND b.quantity > 0
      AND b.expiry_date > date('now')
      AND (m.name LIKE ? OR m.generic_name LIKE ? OR b.batch_number LIKE ?)
    ORDER BY m.name ASC, b.expiry_date ASC
    LIMIT 50
  `;

  const term = `%${searchTerm}%`;
  return await query<StockItem>(sql, [term, term, term]);
}

/**
 * Create a new medicine
 */
export async function createMedicine(input: CreateMedicineInput): Promise<number> {
  const result = await execute(
    `INSERT INTO medicines (
      name, generic_name, manufacturer, hsn_code, gst_rate, 
      taxability, category, drug_type, unit, reorder_level, is_schedule
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.generic_name ?? null,
      input.manufacturer ?? null,
      input.hsn_code,
      input.gst_rate,
      input.taxability,
      input.category ?? null,
      input.drug_type ?? null,
      input.unit ?? 'PCS',
      input.reorder_level ?? 10,
      input.is_schedule ? 1 : 0
    ]
  );

  return result.lastInsertId;
}

/**
 * Update a medicine
 */
export async function updateMedicine(id: number, input: Partial<CreateMedicineInput>): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    params.push(input.name);
  }
  if (input.generic_name !== undefined) {
    sets.push('generic_name = ?');
    params.push(input.generic_name);
  }
  if (input.manufacturer !== undefined) {
    sets.push('manufacturer = ?');
    params.push(input.manufacturer);
  }
  if (input.hsn_code !== undefined) {
    sets.push('hsn_code = ?');
    params.push(input.hsn_code);
  }
  if (input.gst_rate !== undefined) {
    sets.push('gst_rate = ?');
    params.push(input.gst_rate);
  }
  if (input.taxability !== undefined) {
    sets.push('taxability = ?');
    params.push(input.taxability);
  }
  if (input.category !== undefined) {
    sets.push('category = ?');
    params.push(input.category);
  }
  if (input.drug_type !== undefined) {
    sets.push('drug_type = ?');
    params.push(input.drug_type);
  }
  if (input.unit !== undefined) {
    sets.push('unit = ?');
    params.push(input.unit);
  }
  if (input.reorder_level !== undefined) {
    sets.push('reorder_level = ?');
    params.push(input.reorder_level);
  }
  if (input.is_schedule !== undefined) {
    sets.push('is_schedule = ?');
    params.push(input.is_schedule ? 1 : 0);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await execute(
    `UPDATE medicines SET ${sets.join(', ')} WHERE id = ?`,
    params
  );
}

/**
 * Soft delete a medicine
 */
export async function deleteMedicine(id: number): Promise<void> {
  await execute(
    `UPDATE medicines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );
}

// =====================================================
// BATCH OPERATIONS
// =====================================================

/**
 * Get all batches for a medicine
 */
export async function getBatchesByMedicine(medicineId: number): Promise<Batch[]> {
  return await query<Batch>(
    `SELECT * FROM batches 
     WHERE medicine_id = ? AND is_active = 1 
     ORDER BY expiry_date ASC`,
    [medicineId]
  );
}

/**
 * Get batch by ID
 */
export async function getBatchById(id: number): Promise<Batch | null> {
  return await queryOne<Batch>(
    `SELECT * FROM batches WHERE id = ? AND is_active = 1`,
    [id]
  );
}

/**
 * Get batch with medicine details
 */
export async function getBatchWithMedicine(batchId: number): Promise<StockItem | null> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      COALESCE(m.is_schedule, 0) AS is_schedule,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.id = ? AND b.is_active = 1 AND m.is_active = 1
  `;

  return await queryOne<StockItem>(sql, [batchId]);
}

/**
 * Create a new batch
 * Note: quantity input is in strips, but stored in tablets (quantity × tablets_per_strip)
 */
export async function createBatch(input: CreateBatchInput): Promise<number> {
  const tabletsPerStrip = input.tablets_per_strip ?? 10;
  // Convert strips to tablets for storage
  const totalTablets = input.quantity * tabletsPerStrip;

  const result = await execute(
    `INSERT INTO batches (
      medicine_id, batch_number, expiry_date, purchase_price,
      mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.medicine_id,
      input.batch_number,
      input.expiry_date,
      input.purchase_price,
      input.mrp,
      input.selling_price,
      input.price_type,
      totalTablets, // Store in tablets
      tabletsPerStrip,
      input.rack ?? null,
      input.box ?? null
    ]
  );

  return result.lastInsertId;
}

/**
 * Update batch quantity
 */
export async function updateBatchQuantity(
  batchId: number,
  quantityChange: number,
  updateLastSold: boolean = false
): Promise<void> {
  let sql = `UPDATE batches SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP`;
  if (updateLastSold) {
    sql += `, last_sold_date = date('now')`;
  }
  sql += ` WHERE id = ?`;

  await execute(sql, [quantityChange, batchId]);
}

/**
 * Update batch details
 */
export async function updateBatch(id: number, input: Partial<CreateBatchInput>): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.batch_number !== undefined) {
    sets.push('batch_number = ?');
    params.push(input.batch_number);
  }
  if (input.expiry_date !== undefined) {
    sets.push('expiry_date = ?');
    params.push(input.expiry_date);
  }
  if (input.purchase_price !== undefined) {
    sets.push('purchase_price = ?');
    params.push(input.purchase_price);
  }
  if (input.mrp !== undefined) {
    sets.push('mrp = ?');
    params.push(input.mrp);
  }
  if (input.selling_price !== undefined) {
    sets.push('selling_price = ?');
    params.push(input.selling_price);
  }
  if (input.price_type !== undefined) {
    sets.push('price_type = ?');
    params.push(input.price_type);
  }
  if (input.quantity !== undefined) {
    sets.push('quantity = ?');
    params.push(input.quantity);
  }
  if (input.rack !== undefined) {
    sets.push('rack = ?');
    params.push(input.rack);
  }
  if (input.box !== undefined) {
    sets.push('box = ?');
    params.push(input.box);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await execute(
    `UPDATE batches SET ${sets.join(', ')} WHERE id = ?`,
    params
  );
}

// =====================================================
// STOCK QUERIES
// =====================================================

/**
 * Get all stock items
 */
export async function getAllStock(): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 AND m.is_active = 1
    ORDER BY m.name ASC, b.expiry_date ASC
  `;

  return await query<StockItem>(sql, []);
}

/**
 * Get expiring items (within specified days)
 */
export async function getExpiringItems(days: number = 30): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      'EXPIRING_SOON' AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        ELSE 'EXPIRING_SOON'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 
      AND m.is_active = 1
      AND b.quantity > 0
      AND b.expiry_date <= date('now', '+' || ? || ' days')
    ORDER BY b.expiry_date ASC
  `;

  return await query<StockItem>(sql, [days]);
}

/**
 * Get low stock items
 */
export async function getLowStockItems(): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        ELSE 'LOW_STOCK'
      END AS stock_status,
      'OK' AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 
      AND m.is_active = 1
      AND b.quantity <= m.reorder_level
    ORDER BY b.quantity ASC, m.name ASC
  `;

  return await query<StockItem>(sql, []);
}

/**
 * Get non-moving items (not sold in specified days)
 */
export async function getNonMovingItems(days: number = 30): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      'IN_STOCK' AS stock_status,
      'OK' AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 
      AND m.is_active = 1
      AND b.quantity > 0
      AND (
        (b.last_sold_date IS NULL AND b.created_at < date('now', '-' || ? || ' days'))
        OR b.last_sold_date < date('now', '-' || ? || ' days')
      )
    ORDER BY b.last_sold_date ASC NULLS FIRST
  `;

  return await query<StockItem>(sql, [days, days]);
}

/**
 * Get stock by location (rack/box)
 */
export async function getStockByLocation(rack?: string, box?: string): Promise<StockItem[]> {
  let sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 AND m.is_active = 1
  `;

  const params: unknown[] = [];

  if (rack) {
    sql += ` AND b.rack = ?`;
    params.push(rack);
  }
  if (box) {
    sql += ` AND b.box = ?`;
    params.push(box);
  }

  sql += ` ORDER BY b.rack, b.box, m.name`;

  return await query<StockItem>(sql, params);
}

/**
 * Get total stock value
 */
export async function getStockValue(): Promise<{
  totalPurchaseValue: number;
  totalSaleValue: number;
  totalItems: number;
}> {
  const result = await queryOne<{
    total_purchase: number;
    total_sale: number;
    total_items: number;
  }>(
    `SELECT 
      COALESCE(SUM(b.quantity * b.purchase_price), 0) AS total_purchase,
      COALESCE(SUM(b.quantity * b.selling_price), 0) AS total_sale,
      COALESCE(SUM(b.quantity), 0) AS total_items
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 AND m.is_active = 1 AND b.quantity > 0`,
    []
  );

  return {
    totalPurchaseValue: result?.total_purchase ?? 0,
    totalSaleValue: result?.total_sale ?? 0,
    totalItems: result?.total_items ?? 0
  };
}

/**
 * Get scheduled medicines (Schedule H/H1)
 */
export async function getScheduledMedicines(): Promise<StockItem[]> {
  const sql = `
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.purchase_price,
      b.mrp,
      b.selling_price,
      b.price_type,
      b.quantity,
      COALESCE(b.tablets_per_strip, 10) AS tablets_per_strip,
      b.rack,
      b.box,
      b.last_sold_date,
      m.id AS medicine_id,
      m.name AS medicine_name,
      m.generic_name,
      m.manufacturer,
      m.hsn_code,
      m.gst_rate,
      m.taxability,
      m.category,
      m.unit,
      m.reorder_level,
      COALESCE(m.is_schedule, 0) AS is_schedule,
      CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status,
      CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END AS expiry_status,
      julianday(b.expiry_date) - julianday('now') AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.is_active = 1 
      AND m.is_active = 1
      AND m.is_schedule = 1
    ORDER BY m.name ASC, b.expiry_date ASC
  `;

  return await query<StockItem>(sql, []);
}

export default {
  // Medicine operations
  getMedicines,
  getMedicineById,
  searchMedicinesForBilling,
  createMedicine,
  updateMedicine,
  deleteMedicine,

  // Batch operations
  getBatchesByMedicine,
  getBatchById,
  getBatchWithMedicine,
  createBatch,
  updateBatchQuantity,
  updateBatch,

  // Stock queries
  getAllStock,
  getExpiringItems,
  getLowStockItems,
  getNonMovingItems,
  getScheduledMedicines,
  getStockByLocation,
  getStockValue
};
