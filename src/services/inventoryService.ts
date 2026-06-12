// ============================================================
// Inventory Service - Business logic for products & categories
// ============================================================

import { getDatabase, generateId } from '../db/client';
import type { Category, Product } from '../types';

// ==================== CATEGORIES ====================

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
  );
}

export async function createCategory(
  name: string,
  icon: string,
  color: string
): Promise<Category> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  // Get next sort order
  const last = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) as max_order FROM categories'
  );
  const sortOrder = (last?.max_order || 0) + 1;

  await db.runAsync(
    'INSERT INTO categories (id, name, icon, color, sort_order, is_active, synced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)',
    [id, name, icon, color, sortOrder, now, now]
  );

  return {
    id,
    name,
    icon,
    color,
    sort_order: sortOrder,
    is_active: true,
    synced: false,
    created_at: now,
    updated_at: now,
  };
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<Category, 'name' | 'icon' | 'color'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    values.push(value);
  }
  setClauses.push('updated_at = ?');
  setClauses.push('synced = 0');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE categories SET is_active = 0, synced = 0, updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

// ==================== PRODUCTS ====================

export async function getAllProducts(categoryId?: string): Promise<Product[]> {
  const db = await getDatabase();
  if (categoryId) {
    return db.getAllAsync<Product>(
      'SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY name ASC',
      [categoryId]
    );
  }
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
  );
}

export async function createProduct(
  data: Pick<Product, 'category_id' | 'name' | 'cost_price' | 'sell_price' | 'quantity' | 'min_quantity'>
): Promise<Product> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO products (id, category_id, name, cost_price, sell_price, quantity, min_quantity, is_active, synced, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    [id, data.category_id, data.name, data.cost_price, data.sell_price, data.quantity, data.min_quantity, now, now]
  );

  return {
    id,
    ...data,
    barcode: null,
    image_uri: null,
    is_active: true,
    synced: false,
    created_at: now,
    updated_at: now,
  };
}

export async function updateProduct(
  id: string,
  updates: Partial<Pick<Product, 'name' | 'category_id' | 'cost_price' | 'sell_price' | 'quantity' | 'min_quantity'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    values.push(value);
  }
  setClauses.push('updated_at = ?');
  setClauses.push('synced = 0');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE products SET is_active = 0, synced = 0, updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

export async function getLowStockProducts(threshold?: number): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>(
    'SELECT * FROM products WHERE is_active = 1 AND quantity <= min_quantity ORDER BY quantity ASC'
  );
}

export async function getProductCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE is_active = 1'
  );
  return result?.count || 0;
}
