// =====================================================
// MedBill - App Store
// Global application state with Zustand
// =====================================================

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DashboardStats, StockItem, User } from '../types';

// =====================================================
// AUTH STORE
// =====================================================

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            setUser: (user) => set({
                user,
                isAuthenticated: !!user,
                error: null
            }),

            setLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error, isLoading: false }),

            logout: () => set({
                user: null,
                isAuthenticated: false,
                error: null
            })
        }),
        {
            name: 'medbill-auth',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated
            })
        }
    )
);

// =====================================================
// BILLING STORE
// =====================================================

interface BillingItem {
    batch: StockItem;
    quantity: number;           // Total quantity in base unit (tablets/pieces)
    quantityStrips: number;     // Number of full strips
    quantityPieces: number;     // Additional loose tablets/pieces
    discountType?: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
}

interface BillingState {
    items: BillingItem[];
    customerId: number | null;
    customerName: string;
    discountType: 'PERCENTAGE' | 'FLAT' | null;
    discountValue: number;
    paymentMode: 'CASH' | 'ONLINE' | 'CREDIT' | 'SPLIT';
    cashAmount: number;
    onlineAmount: number;
    notes: string;

    // Actions
    addItem: (batch: StockItem, quantity?: number) => void;
    updateItemQuantity: (batchId: number, quantity: number) => void;
    updateItemStripsPieces: (batchId: number, strips: number, pieces: number) => void;
    updateItemDiscount: (batchId: number, type: 'PERCENTAGE' | 'FLAT' | null, value: number) => void;
    removeItem: (batchId: number) => void;
    setCustomer: (id: number | null, name: string) => void;
    setBillDiscount: (type: 'PERCENTAGE' | 'FLAT' | null, value: number) => void;
    setPaymentMode: (mode: 'CASH' | 'ONLINE' | 'CREDIT' | 'SPLIT') => void;
    setSplitAmounts: (cash: number, online: number) => void;
    setNotes: (notes: string) => void;
    clearBill: () => void;
}

const initialBillingState = {
    items: [],
    customerId: null,
    customerName: '',
    discountType: null,
    discountValue: 0,
    paymentMode: 'CASH' as const,
    cashAmount: 0,
    onlineAmount: 0,
    notes: ''
};

export const useBillingStore = create<BillingState>()((set, get) => ({
    ...initialBillingState,

    addItem: (batch, quantity = 1) => {
        const { items } = get();
        const existingIndex = items.findIndex(i => i.batch.batch_id === batch.batch_id);
        const tabletsPerStrip = batch.tablets_per_strip || 10;
        // Note: batch.quantity is now stored in tablets, not strips
        const maxQty = batch.quantity;

        if (existingIndex >= 0) {
            // Update quantity if item exists - add 1 strip worth
            const updated = [...items];
            const addTablets = tabletsPerStrip * quantity;
            const newQty = updated[existingIndex].quantity + addTablets;
            if (newQty <= maxQty) {
                const strips = Math.floor(newQty / tabletsPerStrip);
                const pieces = newQty % tabletsPerStrip;
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: newQty,
                    quantityStrips: strips,
                    quantityPieces: pieces
                };
                set({ items: updated });
            }
        } else {
            // Add new item - default to 1 strip
            const totalTablets = tabletsPerStrip * quantity;
            set({
                items: [...items, {
                    batch,
                    quantity: Math.min(totalTablets, maxQty),
                    quantityStrips: quantity,
                    quantityPieces: 0,
                    discountValue: 0
                }]
            });
        }
    },

    updateItemQuantity: (batchId, quantity) => {
        const { items } = get();
        const updated = items.map(item => {
            if (item.batch.batch_id === batchId) {
                const tabletsPerStrip = item.batch.tablets_per_strip || 10;
                const maxQty = item.batch.quantity; // Already in tablets
                const clampedQty = Math.min(quantity, maxQty);
                return {
                    ...item,
                    quantity: clampedQty,
                    quantityStrips: Math.floor(clampedQty / tabletsPerStrip),
                    quantityPieces: clampedQty % tabletsPerStrip
                };
            }
            return item;
        });
        set({ items: updated });
    },

    updateItemStripsPieces: (batchId, strips, pieces) => {
        const { items } = get();
        const updated = items.map(item => {
            if (item.batch.batch_id === batchId) {
                const tabletsPerStrip = item.batch.tablets_per_strip || 10;
                const totalQty = strips * tabletsPerStrip + pieces;
                const maxQty = item.batch.quantity; // Already in tablets
                if (totalQty <= maxQty && totalQty >= 0) {
                    return {
                        ...item,
                        quantity: totalQty,
                        quantityStrips: strips,
                        quantityPieces: pieces
                    };
                }
            }
            return item;
        });
        set({ items: updated });
    },

    updateItemDiscount: (batchId, type, value) => {
        const { items } = get();
        const updated = items.map(item =>
            item.batch.batch_id === batchId
                ? { ...item, discountType: type ?? undefined, discountValue: value }
                : item
        );
        set({ items: updated });
    },

    removeItem: (batchId) => {
        const { items } = get();
        set({ items: items.filter(i => i.batch.batch_id !== batchId) });
    },

    setCustomer: (id, name) => set({ customerId: id, customerName: name }),

    setBillDiscount: (type, value) => set({ discountType: type, discountValue: value }),

    setPaymentMode: (mode) => set({ paymentMode: mode }),

    setSplitAmounts: (cash, online) => set({ cashAmount: cash, onlineAmount: online }),

    setNotes: (notes) => set({ notes }),

    clearBill: () => set(initialBillingState)
}));

// =====================================================
// SETTINGS STORE
// =====================================================

interface SettingsState {
    settings: Record<string, string>;
    isLoaded: boolean;

    setSettings: (settings: Record<string, string>) => void;
    updateSetting: (key: string, value: string) => void;
    getSetting: (key: string, defaultValue?: string) => string;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
    settings: {},
    isLoaded: false,

    setSettings: (settings) => set({ settings, isLoaded: true }),

    updateSetting: (key, value) => {
        const { settings } = get();
        set({ settings: { ...settings, [key]: value } });
    },

    getSetting: (key, defaultValue = '') => {
        const { settings } = get();
        return settings[key] ?? defaultValue;
    }
}));

// =====================================================
// UI STORE
// =====================================================

interface UIState {
    sidebarOpen: boolean;
    currentPage: string;
    searchQuery: string;

    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setCurrentPage: (page: string) => void;
    setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
    sidebarOpen: true,
    currentPage: 'dashboard',
    searchQuery: '',

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setCurrentPage: (page) => set({ currentPage: page, searchQuery: '' }),
    setSearchQuery: (query) => set({ searchQuery: query })
}));

// =====================================================
// DASHBOARD STORE
// =====================================================

interface DashboardState {
    stats: DashboardStats | null;
    isLoading: boolean;
    lastUpdated: Date | null;

    setStats: (stats: DashboardStats) => void;
    setLoading: (loading: boolean) => void;
    refresh: () => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
    stats: null,
    isLoading: false,
    lastUpdated: null,

    setStats: (stats) => set({
        stats,
        isLoading: false,
        lastUpdated: new Date()
    }),

    setLoading: (isLoading) => set({ isLoading }),

    refresh: () => set({ lastUpdated: null })
}));
