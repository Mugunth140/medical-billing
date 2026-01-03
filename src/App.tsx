// =====================================================
// Main App Component
// =====================================================

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { ToastProvider } from './components/common/Toast';
import './index.css';
import { BillHistory } from './pages/BillHistory';
import { Billing } from './pages/Billing';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Login } from './pages/Login';
import { Purchases } from './pages/Purchases';
import { Reports } from './pages/Reports';
import { Returns } from './pages/Returns';
import { RunningBills } from './pages/RunningBills';
import { Settings } from './pages/Settings';
import { SupplierManagement } from './pages/SupplierManagement';
import { initDatabase, query } from './services/database';
import { useAuthStore, useSettingsStore } from './stores';

// Global unhandled promise rejection handler
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent the default browser error dialog
    event.preventDefault();
  });
}

function App() {
  const { isAuthenticated } = useAuthStore();
  const { setSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function init() {
      try {
        // Initialize database
        await initDatabase();

        if (!mounted) return;

        // Load settings
        const settings = await query<{ key: string; value: string }>(
          'SELECT key, value FROM settings',
          []
        );

        if (!mounted) return;

        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
          settingsMap[s.key] = s.value;
        }
        setSettings(settingsMap);

        setIsLoading(false);
      } catch (err) {
        console.error('Initialization failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize application');
          setIsLoading(false);
        }
      }
    }

    init();
    
    return () => {
      mounted = false;
    };
  }, [setSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
          <p className="text-secondary">Loading application...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '400px', margin: 'var(--space-4)' }}>
          <div className="card-body">
            <h2 style={{ color: 'var(--color-danger-600)', marginBottom: 'var(--space-4)' }}>
              Initialization Error
            </h2>
            <p className="text-secondary">{error}</p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/bill-history" element={<BillHistory />} />
            <Route path="/running-bills" element={<RunningBills />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/suppliers" element={<SupplierManagement />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
