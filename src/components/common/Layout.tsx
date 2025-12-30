// =====================================================
// MedBill - Layout Component
// Main application layout with sidebar navigation
// =====================================================

import {
    ChevronLeft,
    ChevronRight,
    FileText,
    LayoutDashboard,
    LogOut,
    Package,
    Receipt,
    Settings,
    ShoppingCart,
    Users
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../../stores';

interface LayoutProps {
    children: ReactNode;
}

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'billing', label: 'Billing', icon: Receipt, path: '/billing' },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/inventory' },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart, path: '/purchases' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/customers' },
    { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { sidebarOpen, toggleSidebar } = useUIStore();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleNavClick = (path: string) => {
        navigate(path);
    };

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">💊</div>
                    {sidebarOpen && <span className="sidebar-title">Medical Billing</span>}
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        {sidebarOpen && <div className="nav-section-title">Menu</div>}
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <div
                                    key={item.id}
                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                    onClick={() => handleNavClick(item.path)}
                                    title={!sidebarOpen ? item.label : undefined}
                                >
                                    <Icon className="nav-item-icon" size={20} />
                                    {sidebarOpen && <span className="nav-item-label">{item.label}</span>}
                                </div>
                            );
                        })}
                    </div>
                </nav>

                <div className="sidebar-footer">
                    {sidebarOpen && (
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-inverse)' }}>
                                {user?.full_name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--color-gray-400)' }}>
                                {user?.role === 'admin' ? 'Administrator' : 'Staff'}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            className="btn btn-ghost"
                            onClick={toggleSidebar}
                            style={{
                                color: 'var(--color-gray-400)',
                                flex: sidebarOpen ? 1 : 'none'
                            }}
                            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        >
                            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                        </button>

                        {sidebarOpen && (
                            <button
                                className="btn btn-ghost"
                                onClick={handleLogout}
                                style={{ color: 'var(--color-gray-400)' }}
                                title="Logout"
                            >
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
