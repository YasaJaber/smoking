// ============================================================
// Seed Data - Sample categories and products
// ============================================================

import { getDatabase } from './client';

/**
 * Seed the database with sample data for development.
 *
 * IMPORTANT: All seed records use deterministic IDs (not random UUIDs).
 * This guarantees that every device produces the exact same seed rows, so
 * when devices sync against the central server the rows merge (upsert) instead
 * of multiplying into duplicates.
 */
/**
 * Make sure the default login accounts always exist.
 *
 * This runs on every app start (independent of the category seed guard) so a
 * device can always log in, even if the products/categories were already
 * seeded or pulled from the cloud without any user rows. INSERT OR IGNORE +
 * deterministic IDs make it safe to call repeatedly.
 */
export async function ensureDefaultUsers(): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT OR IGNORE INTO users (id, name, pin, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    ['user-admin', 'المدير', '1234', 'admin', now]
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO users (id, name, pin, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
    ['user-cashier', 'الكاشير', '0000', 'cashier', now]
  );

  // Re-activate the admin account if it was somehow deactivated, otherwise
  // login (which requires is_active = 1) would keep failing.
  await db.runAsync(
    "UPDATE users SET is_active = 1 WHERE id IN ('user-admin', 'user-cashier')"
  );
}

export async function seedDatabase(): Promise<void> {
  const db = await getDatabase();

  // Default login accounts must always exist, regardless of seed state.
  await ensureDefaultUsers();

  // Check if already seeded
  const existingCategories = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existingCategories && existingCategories.count > 0) return;

  const now = new Date().toISOString();

  // === Create categories (deterministic IDs) ===
  const categories = [
    { id: 'cat-cigarettes', name: 'السجائر', icon: 'smoking', color: '#ef4444', sort_order: 0 },
    { id: 'cat-hookah', name: 'المعسل', icon: 'cloud', color: '#8b5cf6', sort_order: 1 },
    { id: 'cat-vape', name: 'الفيب', icon: 'weather-fog', color: '#06b6d4', sort_order: 2 },
    { id: 'cat-accessories', name: 'الإكسسوارات', icon: 'toolbox', color: '#f59e0b', sort_order: 3 },
  ];

  for (const cat of categories) {
    await db.runAsync(
      'INSERT INTO categories (id, name, icon, color, sort_order, is_active, synced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)',
      [cat.id, cat.name, cat.icon, cat.color, cat.sort_order, now, now]
    );
  }

  // === Create products ===
  const products = [
    // السجائر
    { category_idx: 0, name: 'مارلبورو أحمر', cost: 55, sell: 65, qty: 120 },
    { category_idx: 0, name: 'مارلبورو جولد', cost: 55, sell: 65, qty: 80 },
    { category_idx: 0, name: 'ونستون أبيض', cost: 45, sell: 55, qty: 100 },
    { category_idx: 0, name: 'ونستون أحمر', cost: 45, sell: 55, qty: 90 },
    { category_idx: 0, name: 'كاميل أصفر', cost: 50, sell: 60, qty: 60 },
    { category_idx: 0, name: 'إل إم أزرق', cost: 40, sell: 50, qty: 150 },
    { category_idx: 0, name: 'كليوباترا', cost: 22, sell: 30, qty: 200 },
    { category_idx: 0, name: 'ميريت', cost: 55, sell: 65, qty: 40 },
    // المعسل
    { category_idx: 1, name: 'الفاخر نعناع', cost: 85, sell: 120, qty: 50 },
    { category_idx: 1, name: 'الفاخر تفاحتين', cost: 85, sell: 120, qty: 45 },
    { category_idx: 1, name: 'الفاخر عنب نعناع', cost: 85, sell: 120, qty: 35 },
    { category_idx: 1, name: 'نخلة توت', cost: 75, sell: 100, qty: 30 },
    { category_idx: 1, name: 'نخلة ليمون نعناع', cost: 75, sell: 100, qty: 25 },
    { category_idx: 1, name: 'دبش علكة', cost: 90, sell: 130, qty: 20 },
    // الفيب
    { category_idx: 2, name: 'VGOD مانجو', cost: 200, sell: 280, qty: 15 },
    { category_idx: 2, name: 'VGOD توت', cost: 200, sell: 280, qty: 12 },
    { category_idx: 2, name: 'نكد 100 ليتشي', cost: 180, sell: 250, qty: 10 },
    { category_idx: 2, name: 'سولت نيكوتين مانجو', cost: 150, sell: 220, qty: 18 },
    { category_idx: 2, name: 'جهاز XROS', cost: 350, sell: 500, qty: 8 },
    { category_idx: 2, name: 'كويل XROS 0.8', cost: 80, sell: 130, qty: 25 },
    // الإكسسوارات
    { category_idx: 3, name: 'ولاعة زيبو', cost: 150, sell: 250, qty: 10 },
    { category_idx: 3, name: 'ولاعة عادية', cost: 5, sell: 10, qty: 200 },
    { category_idx: 3, name: 'فحم طبيعي 1كجم', cost: 40, sell: 70, qty: 50 },
    { category_idx: 3, name: 'ورق لف RAW', cost: 25, sell: 45, qty: 60 },
    { category_idx: 3, name: 'فلتر كرتون', cost: 15, sell: 30, qty: 80 },
    { category_idx: 3, name: 'خرطوم شيشة', cost: 30, sell: 60, qty: 20 },
  ];

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    await db.runAsync(
      `INSERT INTO products (id, category_id, name, cost_price, sell_price, quantity, min_quantity, is_active, synced, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 5, 1, 0, ?, ?)`,
      [`prod-seed-${i}`, categories[prod.category_idx].id, prod.name, prod.cost, prod.sell, prod.qty, now, now]
    );
  }

  console.log('✅ Database seeded successfully with sample data');
}
