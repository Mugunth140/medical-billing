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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Status counts for the summary cards
    // Using independent stats from database instead of derived from filtered execution
    const statusCounts = stats;

    return (
        <>
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <StickyNote className="page-title-icon" />
                        Medicine Notes
                    </h1>
                    <p className="page-subtitle">Track and manage requested medicines</p>
                </div>
                <div className="page-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddForm(true)}
                    >
                        <Plus size={18} />
                        Add Note
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .notes-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          }

          .notes-stat-card {
            text-align: left;
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            cursor: pointer;
            transition: all var(--transition-fast);
          }

          .notes-stat-card:hover {
            box-shadow: var(--shadow-sm);
            transform: translateY(-1px);
          }

          .notes-stat-card.active {
            box-shadow: var(--shadow-md);
            border-color: var(--color-primary-300);
          }

          .notes-stat-card.warning.active { border-color: var(--color-warning-500); }
          .notes-stat-card.primary.active { border-color: var(--color-primary-500); }
          .notes-stat-card.success.active { border-color: var(--color-success-500); }

          .notes-stat-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: var(--space-3);
          }

          .notes-stat-label {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: var(--space-1);
          }

          .notes-stat-value {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
          }

          .notes-stat-icon {
            width: 42px;
            height: 42px;
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .notes-stat-card.warning .notes-stat-icon { background: var(--color-warning-100); color: var(--color-warning-600); }
          .notes-stat-card.primary .notes-stat-icon { background: var(--color-primary-100); color: var(--color-primary-600); }
          .notes-stat-card.success .notes-stat-icon { background: var(--color-success-100); color: var(--color-success-600); }

          .notes-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-4);
            margin-bottom: var(--space-6);
            flex-wrap: wrap;
          }

          .notes-filters {
            display: flex;
            gap: var(--space-2);
            flex-wrap: wrap;
          }

          .notes-filter-btn {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-4);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-full);
            background: var(--bg-secondary);
            cursor: pointer;
            transition: all var(--transition-fast);
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }

          .notes-filter-btn:hover {
            border-color: var(--color-primary-300);
            color: var(--text-primary);
          }

          .notes-filter-btn.active {
            background: var(--color-primary-600);
            color: var(--text-inverse);
            border-color: var(--color-primary-600);
          }

          .notes-search {
            position: relative;
            min-width: 220px;
            max-width: 320px;
            flex: 1;
          }

          .notes-search input {
            padding-left: var(--space-10);
          }

          .notes-search-icon {
            position: absolute;
            left: var(--space-3);
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
          }

          .notes-list {
            display: grid;
            gap: var(--space-3);
          }

          .note-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            display: flex;
            justify-content: space-between;
            gap: var(--space-4);
            transition: box-shadow var(--transition-fast);
          }

          .note-card:hover {
            box-shadow: var(--shadow-md);
          }

          .note-card.priority-high { border-left: 4px solid var(--color-danger-500); }
          .note-card.priority-normal { border-left: 4px solid var(--color-warning-500); }
          .note-card.priority-low { border-left: 4px solid var(--color-gray-300); }

          .note-title-row {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            flex-wrap: wrap;
            margin-bottom: var(--space-2);
          }

          .note-title {
            font-size: var(--text-lg);
            font-weight: var(--font-semibold);
            color: var(--text-primary);
          }

          .note-badge {
            padding: 4px 10px;
            border-radius: var(--radius-full);
            font-size: var(--text-xs);
            font-weight: var(--font-semibold);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .note-badge.priority-high { background: var(--color-danger-50); color: var(--color-danger-700); }
          .note-badge.priority-normal { background: var(--color-warning-50); color: var(--color-warning-700); }
          .note-badge.priority-low { background: var(--color-gray-100); color: var(--color-gray-600); }

          .note-badge.status-pending { background: var(--color-warning-50); color: var(--color-warning-700); }
          .note-badge.status-ordered { background: var(--color-primary-100); color: var(--color-primary-700); }
          .note-badge.status-completed { background: var(--color-success-100); color: var(--color-success-700); }

          .note-meta {
            display: flex;
            gap: var(--space-4);
            flex-wrap: wrap;
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-2);
          }

          .note-qty {
            font-family: var(--font-mono);
            background: var(--color-gray-100);
            padding: 4px 8px;
            border-radius: var(--radius-md);
            color: var(--text-primary);
          }

          .note-notes {
            color: var(--text-secondary);
            font-size: var(--text-sm);
          }

          .note-actions {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            flex-wrap: wrap;
            justify-content: flex-end;
          }
        `}</style>

                <div className="notes-stats">
                    <button
                        className={`notes-stat-card warning ${filterStatus === 'pending' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('pending')}
                    >
                        <div className="notes-stat-header">
                            <div>
                                <div className="notes-stat-label">Pending Requests</div>
                                <div className="notes-stat-value">{statusCounts.pending}</div>
                            </div>
                            <div className="notes-stat-icon">
                                <Clock size={20} />
                            </div>
                        </div>
                    </button>

                    <button
                        className={`notes-stat-card primary ${filterStatus === 'ordered' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('ordered')}
                    >
                        <div className="notes-stat-header">
                            <div>
                                <div className="notes-stat-label">Previously Ordered</div>
                                <div className="notes-stat-value">{statusCounts.ordered}</div>
                            </div>
                            <div className="notes-stat-icon">
                                <ShoppingCart size={20} />
                            </div>
                        </div>
                    </button>

                    <button
                        className={`notes-stat-card success ${filterStatus === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('completed')}
                    >
                        <div className="notes-stat-header">
                            <div>
                                <div className="notes-stat-label">Completed</div>
                                <div className="notes-stat-value">{statusCounts.completed}</div>
                            </div>
                            <div className="notes-stat-icon">
                                <Check size={20} />
                            </div>
                        </div>
                    </button>
                </div>

                <div className="notes-toolbar">
                    <div className="notes-filters">
                        {(['all', 'pending', 'ordered', 'completed'] as FilterStatus[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`notes-filter-btn ${filterStatus === status ? 'active' : ''}`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="notes-search">
                        <Search className="notes-search-icon" size={16} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search medicines..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="loading-spinner"></div>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="empty-state card border-dashed">
                        <Package size={48} className="empty-state-icon" />
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
                    <div className="notes-list">
                        {filteredNotes.map((note) => (
                            <div
                                key={note.id}
                                className={`note-card priority-${note.priority}`}
                            >
                                <div>
                                    <div className="note-title-row">
                                        <div className="note-title">{note.medicine_name}</div>
                                        <span className={`note-badge priority-${note.priority}`}>
                                            {note.priority} priority
                                        </span>
                                        <span className={`note-badge status-${note.status}`}>
                                            {note.status}
                                        </span>
                                    </div>
                                    <div className="note-meta">
                                        <span className="note-qty">Qty: {note.quantity}</span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(note.created_at).toLocaleDateString()}
                                        </span>
                                        {note.creator_name && <span>Added by {note.creator_name}</span>}
                                    </div>
                                    {note.notes && (
                                        <div className="note-notes">{note.notes}</div>
                                    )}
                                </div>

                                <div className="note-actions">
                                    {note.status === 'pending' && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => updateStatus(note.id, 'ordered')}
                                            title="Mark as Ordered"
                                        >
                                            <ShoppingCart size={16} />
                                            Order
                                        </button>
                                    )}
                                    {note.status !== 'completed' && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => updateStatus(note.id, 'completed')}
                                            title="Mark as Completed"
                                        >
                                            <Check size={16} />
                                            Complete
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
                        ))}
                    </div>
                )}

                {showAddForm && (
                    <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-header bg-gray-50">
                                <h3 className="modal-title">New Medicine Request</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>✕</button>
                            </div>
                            <form onSubmit={handleAddNote}>
                                <div className="modal-body space-y-4">
                                    <div className="form-group">
                                        <label className="form-label">Medicine Name</label>
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
                                        className="btn btn-primary"
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
        </>
    );
}
