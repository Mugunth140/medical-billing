// =====================================================
// MedBill - Layout Component
// Main application layout with sidebar navigation
// =====================================================

import {
    ArrowDownLeft,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    History,
    LayoutDashboard,
    LogOut,
    Package,
    Receipt,
    Settings,

    Users
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../../stores';

interface LayoutProps {
    children: ReactNode;
}

interface NavItem {
    id: string;
    label: string;
    icon: typeof LayoutDashboard;
    path: string;
    adminOnly?: boolean;
}

interface NavGroup {
    id: string;
    label: string;
    icon: typeof LayoutDashboard;
    adminOnly?: boolean;
    items: NavItem[];
}

// Standalone navigation items
const MAIN_NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'billing', label: 'New Bill', icon: Receipt, path: '/billing' },
    { id: 'history', label: 'Bill History', icon: History, path: '/bill-history' },
    { id: 'running-bills', label: 'Running Bills', icon: ClipboardList, path: '/running-bills' },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/inventory' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/customers' },
    { id: 'suppliers', label: 'Suppliers & Purchases', icon: Building2, path: '/purchases', adminOnly: true },
    { id: 'returns', label: 'Returns', icon: ArrowDownLeft, path: '/returns', adminOnly: true },
];

// Grouped navigation items (collapsible)
const NAV_GROUPS: NavGroup[] = [];

// Bottom navigation items
const BOTTOM_NAV_ITEMS: NavItem[] = [
    { id: 'reports', label: 'Reports', icon: FileText, path: '/reports', adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', adminOnly: true },
];

export function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { sidebarOpen, toggleSidebar } = useUIStore();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const isAdmin = user?.role === 'admin';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleNavClick = (path: string) => {
        navigate(path);
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const isPathActive = (path: string) => {
        // Handle paths with query params
        const [basePath, queryString] = path.split('?');
        if (location.pathname !== basePath) return false;
        if (queryString) {
            const params = new URLSearchParams(queryString);
            const searchParams = new URLSearchParams(location.search);
            for (const [key, value] of params) {
                if (searchParams.get(key) !== value) return false;
            }
        }
        return true;
    };

    const isGroupActive = (group: NavGroup) => {
        return group.items.some(item => location.pathname === item.path.split('?')[0]);
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

                        {/* Main Navigation Items */}
                        {MAIN_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map((item) => {
                            const Icon = item.icon;
                            const isActive = isPathActive(item.path);
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

                        {/* Grouped Navigation (Purchases, Returns) */}
                        {NAV_GROUPS.filter(group => !group.adminOnly || isAdmin).map((group) => {
                            const GroupIcon = group.icon;
                            const isExpanded = expandedGroups[group.id] || isGroupActive(group);
                            return (
                                <div key={group.id} className="nav-group">
                                    <div
                                        className={`nav-item nav-group-header ${isGroupActive(group) ? 'group-active' : ''}`}
                                        onClick={() => sidebarOpen ? toggleGroup(group.id) : handleNavClick(group.items[0].path)}
                                        title={!sidebarOpen ? group.label : undefined}
                                    >
                                        <GroupIcon className="nav-item-icon" size={20} />
                                        {sidebarOpen && (
                                            <>
                                                <span className="nav-item-label">{group.label}</span>
                                                <ChevronDown
                                                    className={`nav-group-chevron ${isExpanded ? 'expanded' : ''}`}
                                                    size={16}
                                                />
                                            </>
                                        )}
                                    </div>
                                    {sidebarOpen && isExpanded && (
                                        <div className="nav-group-items">
                                            {group.items.map((item) => {
                                                const Icon = item.icon;
                                                const isActive = isPathActive(item.path);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`nav-item nav-subitem ${isActive ? 'active' : ''}`}
                                                        onClick={() => handleNavClick(item.path)}
                                                    >
                                                        <Icon className="nav-item-icon" size={16} />
                                                        <span className="nav-item-label">{item.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Bottom Navigation Items */}
                        {BOTTOM_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map((item) => {
                            const Icon = item.icon;
                            const isActive = isPathActive(item.path);
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

                    <div className="flex gap-2" style={{ justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={toggleSidebar}
                            style={{
                                color: 'var(--color-gray-400)',
                                padding: 'var(--space-2)',
                                minWidth: 'auto'
                            }}
                            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        >
                            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                        </button>

                        {sidebarOpen && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={handleLogout}
                                style={{ color: 'var(--color-gray-400)', padding: 'var(--space-2)' }}
                                title="Logout"
                            >
                                <LogOut size={18} />
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
