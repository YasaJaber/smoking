// ============================================================
// Purchase Service - Business logic for budget-based purchasing
// ============================================================

import { getDatabase, generateId } from '../db/client';
import type { Purchase, PurchaseItem, Product } from '../types';

// ==================== PURCHASES ====================

/**
 * Get today's open purchase (if any).
 * Compares based on local calendar day.
 */
export async function getTodayPurchase(): Promise<Purchase | null> {
  const db = await getDatabase();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return db.getFirstAsync<Purchase>(
    "SELECT * FROM purchases WHERE status = 'open' AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 1",
    [startOfDay.toISOString(), endOfDay.toISOString()]
  );
}

/**
 * Create a new purchase with a budget
 */
export async function createPurchase(
  budget: number,
  note?: string
): Promise<Purchase> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO purchases (id, budget, spent, remaining, note, status, synced, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, 'open', 0, ?, ?)`,
    [id, budget, budget, note?.trim() || null, now, now]
  );

  return {
    id,
    budget,
    spent: 0,
    remaining: budget,
    note: note?.trim() || null,
    status: 'open',
    synced: false,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get all purchases, ordered by most recent first
 */
export async function getAllPurchases(): Promise<Purchase[]> {
  const db = await getDatabase();
  return db.getAllAsync<Purchase>(
    'SELECT * FROM purchases ORDER BY created_at DESC'
  );
}

/**
 * Get a single purchase by ID
 */
export async function getPurchase(id: string): Promise<Purchase | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Purchase>(
    'SELECT * FROM purchases WHERE id = ?',
    [id]
  );
}

/**
 * Get a purchase with all its items
 */
export async function getPurchaseWithItems(
  purchaseId: string
): Promise<{ purchase: Purchase; items: PurchaseItem[] } | null> {
  const db = await getDatabase();

  const purchase = await db.getFirstAsync<Purchase>(
    'SELECT * FROM purchases WHERE id = ?',
    [purchaseId]
  );

  if (!purchase) return null;

  const items = await db.getAllAsync<PurchaseItem>(
    'SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY created_at DESC',
    [purchaseId]
  );

  return { purchase, items };
}

/**
 * Add an item to a purchase.
 * - Deducts total_cost from the purchase budget
 * - If product_id is provided, adds quantity to existing product
 * - If product_id is null, creates a new product in inventory
 */
export async function addPurchaseItem(
  purchaseId: string,
  data: {
    product_id: string | null;
    product_name: string;
    category_id: string;
    cost_price: number;
    sell_price: number;
    quantity: number;
  }
): Promise<PurchaseItem> {
  const db = await getDatabase();
  const totalCost = data.cost_price * data.quantity;

  // Verify budget
  const purchase = await db.getFirstAsync<Purchase>(
    'SELECT * FROM purchases WHERE id = ?',
    [purchaseId]
  );

  if (!purchase) throw new Error('Purchase not found');
  if (purchase.status === 'closed') throw new Error('Purchase is closed');
  if (purchase.remaining < totalCost) {
    throw new Error('INSUFFICIENT_BUDGET');
  }

  const itemId = generateId();
  const now = new Date().toISOString();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // 1. Insert purchase item
    await db.runAsync(
      `INSERT INTO purchase_items (id, purchase_id, product_id, product_name, category_id, cost_price, sell_price, quantity, total_cost, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        itemId,
        purchaseId,
        data.product_id,
        data.product_name.trim(),
        data.category_id,
        data.cost_price,
        data.sell_price,
        data.quantity,
        totalCost,
        now,
      ]
    );

    // 2. Update purchase budget
    const newSpent = purchase.spent + totalCost;
    const newRemaining = purchase.budget - newSpent;

    await db.runAsync(
      'UPDATE purchases SET spent = ?, remaining = ?, synced = 0, updated_at = ? WHERE id = ?',
      [newSpent, newRemaining, now, purchaseId]
    );

    // 3. Update inventory
    if (data.product_id) {
      // Existing product → increase quantity and update cost price
      await db.runAsync(
        'UPDATE products SET quantity = quantity + ?, cost_price = ?, synced = 0, updated_at = ? WHERE id = ?',
        [data.quantity, data.cost_price, now, data.product_id]
      );
    } else {
      // New product → create in inventory
      const newProductId = generateId();
      await db.runAsync(
        `INSERT INTO products (id, category_id, name, cost_price, sell_price, quantity, min_quantity, is_active, synced, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 5, 1, 0, ?, ?)`,
        [
          newProductId,
          data.category_id,
          data.product_name.trim(),
          data.cost_price,
          data.sell_price,
          data.quantity,
          now,
          now,
        ]
      );

      // Update the item with the new product_id for reference
      await db.runAsync(
        'UPDATE purchase_items SET product_id = ?, synced = 0 WHERE id = ?',
        [newProductId, itemId]
      );
    }

    await db.execAsync('COMMIT');

    return {
      id: itemId,
      purchase_id: purchaseId,
      product_id: data.product_id,
      product_name: data.product_name.trim(),
      category_id: data.category_id,
      cost_price: data.cost_price,
      sell_price: data.sell_price,
      quantity: data.quantity,
      total_cost: totalCost,
      synced: false,
      created_at: now,
    };
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Delete a purchase item and reverse its effects:
 * - Returns cost to purchase remaining
 * - Decreases product quantity in inventory
 */
export async function deletePurchaseItem(itemId: string): Promise<void> {
  const db = await getDatabase();

  const item = await db.getFirstAsync<PurchaseItem>(
    'SELECT * FROM purchase_items WHERE id = ?',
    [itemId]
  );

  if (!item) throw new Error('Purchase item not found');

  const now = new Date().toISOString();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // 1. Remove the item
    await db.runAsync('DELETE FROM purchase_items WHERE id = ?', [itemId]);

    // 2. Update purchase budget (return cost)
    const purchase = await db.getFirstAsync<Purchase>(
      'SELECT * FROM purchases WHERE id = ?',
      [item.purchase_id]
    );

    if (purchase) {
      const newSpent = Math.max(0, purchase.spent - item.total_cost);
      const newRemaining = purchase.budget - newSpent;

      await db.runAsync(
        'UPDATE purchases SET spent = ?, remaining = ?, synced = 0, updated_at = ? WHERE id = ?',
        [newSpent, newRemaining, now, item.purchase_id]
      );
    }

    // 3. Decrease inventory quantity
    if (item.product_id) {
      await db.runAsync(
        'UPDATE products SET quantity = MAX(0, quantity - ?), synced = 0, updated_at = ? WHERE id = ?',
        [item.quantity, now, item.product_id]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Add more budget to an existing purchase (top up)
 */
export async function addBudget(
  purchaseId: string,
  additionalBudget: number
): Promise<Purchase> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const purchase = await db.getFirstAsync<Purchase>(
    'SELECT * FROM purchases WHERE id = ?',
    [purchaseId]
  );

  if (!purchase) throw new Error('Purchase not found');

  const newBudget = purchase.budget + additionalBudget;
  const newRemaining = purchase.remaining + additionalBudget;

  await db.runAsync(
    'UPDATE purchases SET budget = ?, remaining = ?, synced = 0, updated_at = ? WHERE id = ?',
    [newBudget, newRemaining, now, purchaseId]
  );

  return {
    ...purchase,
    budget: newBudget,
    remaining: newRemaining,
    synced: false,
    updated_at: now,
  };
}

/**
 * Close a purchase (no more items can be added)
 */
export async function closePurchase(purchaseId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE purchases SET status = 'closed', synced = 0, updated_at = ? WHERE id = ?",
    [now, purchaseId]
  );
}

/**
 * Reopen a closed purchase
 */
export async function reopenPurchase(purchaseId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE purchases SET status = 'open', synced = 0, updated_at = ? WHERE id = ?",
    [now, purchaseId]
  );
}

/**
 * Delete an entire purchase and all its items.
 * Also reverses inventory changes.
 */
export async function deletePurchase(purchaseId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const items = await db.getAllAsync<PurchaseItem>(
    'SELECT * FROM purchase_items WHERE purchase_id = ?',
    [purchaseId]
  );

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Reverse inventory for each item
    for (const item of items) {
      if (item.product_id) {
        await db.runAsync(
          'UPDATE products SET quantity = MAX(0, quantity - ?), synced = 0, updated_at = ? WHERE id = ?',
          [item.quantity, now, item.product_id]
        );
      }
    }

    // Delete items then purchase
    await db.runAsync('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    await db.runAsync('DELETE FROM purchases WHERE id = ?', [purchaseId]);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
