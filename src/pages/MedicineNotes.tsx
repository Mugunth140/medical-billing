// =====================================================
// MedBill - Medicine Notes Page
// Track medicines requested by customers to buy later
// =====================================================

import {
    Check,
    Clock,
    Package,
    Plus,
    Search,
    ShoppingCart,
    StickyNote,
    Trash2
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import { useAuthStore } from '../stores';

interface MedicineNote {
    id: number;
    medicine_name: string;
    notes: string | null;
    quantity: number;
    priority: 'low' | 'normal' | 'high';
    status: 'pending' | 'ordered' | 'completed';
    created_by: number;
    created_at: string;
    completed_at: string | null;
    creator_name?: string;
}

type FilterStatus = 'all' | 'pending' | 'ordered' | 'completed';

export function MedicineNotes() {
    const { user } = useAuthStore();
    const { showToast } = useToast();

    const [notes, setNotes] = useState<MedicineNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ pending: 0, ordered: 0, completed: 0 });

    // Form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [medicineName, setMedicineName] = useState('');
    const [noteText, setNoteText] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadNotes();
        loadStats();
    }, [filterStatus]);

    const loadStats = async () => {
        try {
            const result = await query<{ pending: number, ordered: number, completed: number }>(`
                SELECT 
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) as ordered,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM medicine_notes
            `);
            if (result.length > 0) {
                setStats(result[0]);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const loadNotes = async () => {
        try {
            setLoading(true);
            let sql = `
                SELECT mn.*, u.full_name as creator_name
                FROM medicine_notes mn
                LEFT JOIN users u ON mn.created_by = u.id
            `;

            if (filterStatus !== 'all') {
                sql += ` WHERE mn.status = ?`;
            }

            sql += ` ORDER BY 
                CASE mn.priority 
                    WHEN 'high' THEN 1 
                    WHEN 'normal' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                mn.created_at DESC`;

            const params = filterStatus !== 'all' ? [filterStatus] : [];
            const result = await query<MedicineNote>(sql, params);
            setNotes(result);
        } catch (error) {
            console.error('Failed to load notes:', error);
            showToast('error', 'Failed to load medicine notes');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!medicineName.trim()) return;

        try {
            setSubmitting(true);
            await execute(
                `INSERT INTO medicine_notes (medicine_name, notes, quantity, priority, created_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [medicineName.trim(), noteText.trim() || null, quantity, priority, user?.id || 1]
            );

            showToast('success', 'Note added successfully');
            setMedicineName('');
            setNoteText('');
            setQuantity(1);
            setPriority('normal');
            setShowAddForm(false);
            loadNotes();
            loadStats();
        } catch (error) {
            console.error('Failed to add note:', error);
            showToast('error', 'Failed to add note');
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (id: number, newStatus: 'pending' | 'ordered' | 'completed') => {
        try {
            const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
            await execute(
                `UPDATE medicine_notes SET status = ?, completed_at = ? WHERE id = ?`,
                [newStatus, completedAt, id]
            );
            showToast('success', `Status updated to ${newStatus}`);
            loadNotes();
            loadStats();
        } catch (error) {
            console.error('Failed to update status:', error);
            showToast('error', 'Failed to update status');
        }
    };

    const deleteNote = async (id: number) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            await execute('DELETE FROM medicine_notes WHERE id = ?', [id]);
            showToast('success', 'Note deleted');
            loadNotes();
            loadStats();
        } catch (error) {
            console.error('Failed to delete note:', error);
            showToast('error', 'Failed to delete note');
        }
    };

    const filteredNotes = notes.filter(note =>
        note.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (note.notes && note.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getPriorityBadgeStyle = (priority: string) => {
        switch (priority) {
            case 'high': return { backgroundColor: '#fee2e2', color: '#dc2626' };
            case 'normal': return { backgroundColor: '#fef3c7', color: '#d97706' };
            case 'low': return { backgroundColor: '#f1f5f9', color: '#64748b' };
            default: return {};
        }
    };

    // Status counts for the summary cards
    // Using independent stats from database instead of derived from filtered execution
    const statusCounts = stats;

    return (
        <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Premium Header */}
            <div className="page-header" style={{
                background: 'transparent',
                borderBottom: 'none',
                paddingBottom: '0',
                marginBottom: 'var(--space-8)'
            }}>
                <div>
                    <h1 className="page-title">
                        <div style={{
                            padding: '10px',
                            background: 'white',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-sm)',
                            display: 'flex'
                        }}>
                            <StickyNote className="page-title-icon" />
                        </div>
                        Medicine Notes
                    </h1>
                    <p className="page-subtitle" style={{ marginLeft: '54px' }}>
                        Track and manage requested medicines
                    </p>
                </div>
                <button
                    className="btn btn-primary btn-lg"
                    style={{
                        boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)',
                        padding: '12px 24px',
                        borderRadius: '12px'
                    }}
                    onClick={() => setShowAddForm(true)}
                >
                    <Plus size={20} />
                    Add Note
                </button>
            </div>

            {/* Modern Stats Overview */}
            <div className="grid grid-cols-3 gap-4 mb-4 mt-2">
                <div
                    className={`card stat-card ${filterStatus === 'pending' ? 'ring-2 ring-warning-500' : ''}`}
                    onClick={() => setFilterStatus('pending')}
                    style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                        border: '1px solid #fef3c7',
                        transition: 'transform 0.2s',
                        transform: filterStatus === 'pending' ? 'translateY(-4px)' : 'none'
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-secondary text-sm font-medium uppercase tracking-wider mb-1">Pending Requests</div>
                            <div className="text-4xl font-bold" style={{ color: '#d97706' }}>{statusCounts.pending}</div>
                        </div>
                        <div style={{
                            padding: '12px',
                            background: '#fef3c7',
                            borderRadius: '16px',
                            color: '#d97706'
                        }}>
                            <Clock size={24} />
                        </div>
                    </div>
                </div>

                <div
                    className={`card stat-card ${filterStatus === 'ordered' ? 'ring-2 ring-primary-500' : ''}`}
                    onClick={() => setFilterStatus('ordered')}
                    style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
                        border: '1px solid #dbeafe',
                        transition: 'transform 0.2s',
                        transform: filterStatus === 'ordered' ? 'translateY(-4px)' : 'none'
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-secondary text-sm font-medium uppercase tracking-wider mb-1">Previously Ordered</div>
                            <div className="text-4xl font-bold" style={{ color: '#2563eb' }}>{statusCounts.ordered}</div>
                        </div>
                        <div style={{
                            padding: '12px',
                            background: '#dbeafe',
                            borderRadius: '16px',
                            color: '#2563eb'
                        }}>
                            <ShoppingCart size={24} />
                        </div>
                    </div>
                </div>

                <div
                    className={`card stat-card ${filterStatus === 'completed' ? 'ring-2 ring-success-500' : ''}`}
                    onClick={() => setFilterStatus('completed')}
                    style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                        border: '1px solid #dcfce7',
                        transition: 'transform 0.2s',
                        transform: filterStatus === 'completed' ? 'translateY(-4px)' : 'none'
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-secondary text-sm font-medium uppercase tracking-wider mb-1">Completed</div>
                            <div className="text-4xl font-bold" style={{ color: '#059669' }}>{statusCounts.completed}</div>
                        </div>
                        <div style={{
                            padding: '12px',
                            background: '#dcfce7',
                            borderRadius: '16px',
                            color: '#059669'
                        }}>
                            <Check size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex justify-between items-center mb-8">
                <div className="filter-bar">
                    {(['all', 'pending', 'ordered', 'completed'] as FilterStatus[]).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="input-group" style={{ maxWidth: '300px' }}>
                    <Search className="input-icon" size={18} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search medicines..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '40px' }}
                    />
                </div>
            </div>

            {/* Modern List View */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="loading-spinner"></div>
                </div>
            ) : filteredNotes.length === 0 ? (
                <div className="empty-state card border-dashed">
                    <div className="p-8 bg-gray-50 rounded-full mb-4">
                        <Package size={48} className="text-gray-400" />
                    </div>
                    <h3 className="empty-state-title">No medicines found</h3>
                    <p className="empty-state-description">
                        {searchTerm ? 'Try adjusting your search terms' : 'Start by adding a medicine request'}
                    </p>
                    {!searchTerm && (
                        <button
                            className="btn btn-primary mt-6"
                            onClick={() => setShowAddForm(true)}
                        >
                            <Plus size={18} /> Add First Note
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredNotes.map((note) => (
                        <div
                            key={note.id}
                            className="card hover:shadow-lg transition-all"
                            style={{
                                padding: '32px',
                                borderLeft: `4px solid ${note.priority === 'high' ? 'var(--color-danger-500)' :
                                    note.priority === 'normal' ? 'var(--color-warning-500)' :
                                        'var(--color-gray-300)'
                                    }`
                            }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-gray-800">{note.medicine_name}</h3>
                                        <span
                                            className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide"
                                            style={getPriorityBadgeStyle(note.priority)}
                                        >
                                            {note.priority} Priority
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(note.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-6 text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm font-mono">
                                                Qty: {note.quantity}
                                            </span>
                                        </div>
                                        {note.notes && (
                                            <p className="text-sm text-gray-500 m-0 flex items-center gap-2">
                                                <StickyNote size={14} />
                                                {note.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    {note.status === 'pending' && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => updateStatus(note.id, 'ordered')}
                                            title="Mark as Ordered"
                                        >
                                            <ShoppingCart size={16} className="text-primary-600" />
                                            <span className="ml-2">Order</span>
                                        </button>
                                    )}
                                    {note.status !== 'completed' && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            style={{ background: 'var(--color-success-50)', color: 'var(--color-success-700)', border: '1px solid var(--color-success-200)' }}
                                            onClick={() => updateStatus(note.id, 'completed')}
                                            title="Mark as Completed"
                                        >
                                            <Check size={16} />
                                            <span className="ml-2">Complete</span>
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-ghost btn-sm text-danger"
                                        onClick={() => deleteNote(note.id)}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Note Form Modal - Kept consistent but with better styling */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header bg-gray-50">
                            <h3 className="modal-title font-bold text-gray-800">New Medicine Request</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddNote}>
                            <div className="modal-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label font-bold text-gray-700">Medicine Name</label>
                                    <input
                                        type="text"
                                        className="form-input form-input-lg"
                                        value={medicineName}
                                        onChange={(e) => setMedicineName(e.target.value)}
                                        placeholder="e.g. Paracetamol 500mg"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Quantity</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select
                                            className="form-select"
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                                        >
                                            <option value="low">Low - Routine</option>
                                            <option value="normal">Normal</option>
                                            <option value="high">High - Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Additional Notes</label>
                                    <textarea
                                        className="form-input"
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Customer details or specific brand..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer bg-gray-50">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary shadow-lg"
                                    disabled={submitting || !medicineName.trim()}
                                >
                                    {submitting ? 'Adding...' : 'Add Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
