// ============================================================
// Cart Store - Zustand POS Cart State
// ============================================================

import { create } from 'zustand';
import type { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  subtotal: number;
  taxRate: number;
  taxEnabled: boolean;
  taxAmount: number;
  total: number;

  // Actions
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  clearCart: () => void;
  setTaxConfig: (enabled: boolean, rate: number) => void;
}

function recalculate(items: CartItem[], taxEnabled: boolean, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxEnabled ? subtotal * taxRate : 0;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  taxRate: 0.14,
  taxEnabled: false,
  taxAmount: 0,
  total: 0,

  addItem: (product: Product) => {
    const { items, taxEnabled, taxRate } = get();
    const existingIndex = items.findIndex((i) => i.product.id === product.id);

    let newItems: CartItem[];
    if (existingIndex >= 0) {
      newItems = items.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              quantity: item.quantity + 1,
              total: (item.quantity + 1) * item.product.sell_price,
            }
          : item
      );
    } else {
      newItems = [
        ...items,
        { product, quantity: 1, total: product.sell_price },
      ];
    }

    set({ items: newItems, ...recalculate(newItems, taxEnabled, taxRate) });
  },

  removeItem: (productId: string) => {
    const { items, taxEnabled, taxRate } = get();
    const newItems = items.filter((i) => i.product.id !== productId);
    set({ items: newItems, ...recalculate(newItems, taxEnabled, taxRate) });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const { items, taxEnabled, taxRate } = get();
    const newItems = items.map((item) =>
      item.product.id === productId
        ? { ...item, quantity, total: quantity * item.product.sell_price }
        : item
    );
    set({ items: newItems, ...recalculate(newItems, taxEnabled, taxRate) });
  },

  incrementItem: (productId: string) => {
    const { items } = get();
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      get().updateQuantity(productId, item.quantity + 1);
    }
  },

  decrementItem: (productId: string) => {
    const { items } = get();
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      get().updateQuantity(productId, item.quantity - 1);
    }
  },

  clearCart: () => {
    set({ items: [], subtotal: 0, taxAmount: 0, total: 0 });
  },

  setTaxConfig: (enabled: boolean, rate: number) => {
    const { items } = get();
    set({ taxEnabled: enabled, taxRate: rate, ...recalculate(items, enabled, rate) });
  },
}));
