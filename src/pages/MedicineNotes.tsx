// =====================================================
// MedBill - Medicine Notes Page
// Track medicines requested by customers to buy later
// =====================================================

import {
    AlertCircle,
    Check,
    Clock,
    Package,
    Plus,
    Search,
    ShoppingCart,
    StickyNote,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

    // Form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [medicineName, setMedicineName] = useState('');
    const [noteText, setNoteText] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadNotes();
    }, [filterStatus]);

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
                [medicineName.trim(), noteText.trim() || null, quantity, priority, user?.id]
            );

            showToast('success', 'Note added successfully');
            setMedicineName('');
            setNoteText('');
            setQuantity(1);
            setPriority('normal');
            setShowAddForm(false);
            loadNotes();
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
        } catch (error) {
            console.error('Failed to delete note:', error);
            showToast('error', 'Failed to delete note');
        }
    };

    const filteredNotes = notes.filter(note =>
        note.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (note.notes && note.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'var(--color-danger-600)';
            case 'normal': return 'var(--color-warning-600)';
            case 'low': return 'var(--color-gray-500)';
            default: return 'var(--text-secondary)';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={16} />;
            case 'ordered': return <ShoppingCart size={16} />;
            case 'completed': return <Check size={16} />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'var(--color-warning-600)';
            case 'ordered': return 'var(--color-primary-600)';
            case 'completed': return 'var(--color-success-600)';
            default: return 'var(--text-secondary)';
        }
    };

    const statusCounts = {
        pending: notes.filter(n => n.status === 'pending').length,
        ordered: notes.filter(n => n.status === 'ordered').length,
        completed: notes.filter(n => n.status === 'completed').length
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <StickyNote className="page-title-icon" />
                        Medicine Notes
                    </h1>
                    <p className="page-subtitle">Track medicines to buy for customers</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddForm(true)}
                >
                    <Plus size={18} />
                    Add Note
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div className="flex items-center gap-3">
                        <div style={{
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-warning-100)'
                        }}>
                            <Clock size={20} style={{ color: 'var(--color-warning-600)' }} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{statusCounts.pending}</div>
                            <div className="text-sm text-secondary">Pending</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div className="flex items-center gap-3">
                        <div style={{
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-primary-100)'
                        }}>
                            <ShoppingCart size={20} style={{ color: 'var(--color-primary-600)' }} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{statusCounts.ordered}</div>
                            <div className="text-sm text-secondary">Ordered</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div className="flex items-center gap-3">
                        <div style={{
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-success-100)'
                        }}>
                            <Check size={20} style={{ color: 'var(--color-success-600)' }} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{statusCounts.completed}</div>
                            <div className="text-sm text-secondary">Completed</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <div className="input-group">
                                <Search className="input-icon" size={18} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search medicines..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'pending', 'ordered', 'completed'] as FilterStatus[]).map((status) => (
                                <button
                                    key={status}
                                    className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setFilterStatus(status)}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Note Form Modal */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Medicine Note</h3>
                        </div>
                        <form onSubmit={handleAddNote}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Medicine Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={medicineName}
                                        onChange={(e) => setMedicineName(e.target.value)}
                                        placeholder="Enter medicine name"
                                        autoFocus
                                        required
                                    />
                                </div>
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
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes (optional)</label>
                                    <textarea
                                        className="form-input"
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Customer name, phone, or any additional details..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting || !medicineName.trim()}
                                >
                                    {submitting ? 'Adding...' : 'Add Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notes List */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {loading ? (
                        <div className="flex items-center justify-center" style={{ padding: 'var(--space-8)' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center" style={{ padding: 'var(--space-8)' }}>
                            <Package size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }} />
                            <p className="text-secondary">No medicine notes found</p>
                            <button
                                className="btn btn-primary mt-4"
                                onClick={() => setShowAddForm(true)}
                            >
                                <Plus size={18} />
                                Add First Note
                            </button>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>Priority</th>
                                    <th>Medicine</th>
                                    <th>Qty</th>
                                    <th>Notes</th>
                                    <th>Added By</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th style={{ width: '150px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNotes.map((note) => (
                                    <tr key={note.id}>
                                        <td>
                                            <div title={note.priority.toUpperCase()}>
                                                <AlertCircle
                                                    size={18}
                                                    style={{ color: getPriorityColor(note.priority) }}
                                                />
                                            </div>
                                        </td>
                                        <td className="font-medium">{note.medicine_name}</td>
                                        <td>{note.quantity}</td>
                                        <td className="text-secondary" style={{ maxWidth: '200px' }}>
                                            {note.notes ? (
                                                <span title={note.notes}>
                                                    {note.notes.length > 50 ? note.notes.substring(0, 50) + '...' : note.notes}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="text-secondary">{note.creator_name || 'Unknown'}</td>
                                        <td className="text-secondary">
                                            {new Date(note.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: getStatusColor(note.status) + '20',
                                                    color: getStatusColor(note.status),
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {getStatusIcon(note.status)}
                                                {note.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                {note.status === 'pending' && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => updateStatus(note.id, 'ordered')}
                                                        title="Mark as Ordered"
                                                    >
                                                        <ShoppingCart size={16} />
                                                    </button>
                                                )}
                                                {note.status !== 'completed' && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => updateStatus(note.id, 'completed')}
                                                        title="Mark as Completed"
                                                        style={{ color: 'var(--color-success-600)' }}
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => deleteNote(note.id)}
                                                    title="Delete"
                                                    style={{ color: 'var(--color-danger-600)' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
