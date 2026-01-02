// =====================================================
// Pagination Component
// Reusable pagination with page navigation
// =====================================================

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect } from 'react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    showItemCount?: boolean;
}

export function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    showItemCount = true
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Don't render if only one page
    if (totalPages <= 1) return null;

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            onPageChange(page);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only if not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'ArrowLeft' && e.altKey) {
                e.preventDefault();
                goToPage(currentPage - 1);
            } else if (e.key === 'ArrowRight' && e.altKey) {
                e.preventDefault();
                goToPage(currentPage + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages]);

    return (
        <>
            <style>{`
                .pagination {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--space-4) 0;
                    margin-top: var(--space-4);
                    border-top: 1px solid var(--border-light);
                }

                .pagination-info {
                    font-size: var(--text-sm);
                    color: var(--text-secondary);
                }

                .pagination-controls {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }

                .pagination-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-md);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .pagination-btn:hover:not(:disabled) {
                    background: var(--color-primary-50);
                    border-color: var(--color-primary-300);
                    color: var(--color-primary-600);
                }

                .pagination-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .pagination-current {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: 0 var(--space-3);
                    font-size: var(--text-sm);
                    font-weight: var(--font-medium);
                    color: var(--text-primary);
                }

                .pagination-input {
                    width: 50px;
                    padding: var(--space-1) var(--space-2);
                    text-align: center;
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-md);
                    font-size: var(--text-sm);
                    font-family: var(--font-mono);
                }

                .pagination-input:focus {
                    outline: none;
                    border-color: var(--color-primary-500);
                }
            `}</style>

            <div className="pagination">
                {showItemCount && (
                    <div className="pagination-info">
                        Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{totalItems}</strong> items
                    </div>
                )}

                <div className="pagination-controls">
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        title="First page"
                    >
                        <ChevronsLeft size={18} />
                    </button>
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        title="Previous page (Alt + ←)"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="pagination-current">
                        <span>Page</span>
                        <input
                            type="number"
                            className="pagination-input"
                            value={currentPage}
                            min={1}
                            max={totalPages}
                            onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (!isNaN(page)) goToPage(page);
                            }}
                        />
                        <span>of {totalPages}</span>
                    </div>

                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        title="Next page (Alt + →)"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        className="pagination-btn"
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        title="Last page"
                    >
                        <ChevronsRight size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}

// Helper hook for pagination logic
export function usePagination<T>(items: T[], itemsPerPage: number = 50) {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const getPageItems = (page: number): T[] => {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return items.slice(start, end);
    };

    return {
        totalItems,
        totalPages,
        getPageItems
    };
}
