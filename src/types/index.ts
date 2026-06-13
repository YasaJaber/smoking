// ============================================================
// Type Definitions - Smoking POS
// ============================================================

export interface Settings {
  id: number;
  store_name: string;
  phone: string;
  logo_uri: string;
  tax_enabled: boolean;
  tax_rate: number;
  dark_mode: boolean;
  printer_address: string;
  printer_type: 'bluetooth' | 'usb' | 'wifi';
  welcome_message: string;
  footer_message: string;
  currency: string;
  low_stock_threshold: number;
  server_url: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'cashier';
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  barcode: string | null;
  cost_price: number;
  sell_price: number;
  quantity: number;
  min_quantity: number;
  image_uri: string | null;
  is_active: boolean;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  invoice_name: string | null;
  user_id: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  payment_method: 'cash';
  status: 'completed' | 'partial' | 'refunded';
  synced: boolean;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  total: number;
  /** Ad-hoc line item — recorded on the invoice only, not tied to inventory */
  isCustom?: boolean;
}

export interface SyncLog {
  id: number;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  synced: boolean;
  created_at: string;
}

// Analytics types
export interface DailySales {
  date: string;
  revenue: number;
  profit: number;
  count: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_sold: number;
  total_revenue: number;
  total_profit: number;
}

export interface AnalyticsSummary {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_invoices: number;
  total_items_sold: number;
  avg_invoice_value: number;
}

export interface PeriodComparison {
  current: AnalyticsSummary;
  previous: AnalyticsSummary;
  revenue_change: number;
  profit_change: number;
  invoices_change: number;
}

// Purchase types
export interface Purchase {
  id: string;
  budget: number;
  spent: number;
  remaining: number;
  note: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  category_id: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  total_cost: number;
  created_at: string;
}
