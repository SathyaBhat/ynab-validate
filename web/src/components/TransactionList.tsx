import { useState, useEffect } from 'react';
import { listTransactions, deleteTransaction } from '../api/client';
import { AmExTransactionRow } from '../types';
import './TransactionList.css';

interface TransactionListProps {
  refreshTrigger?: number;
}

export function TransactionList({ refreshTrigger = 0 }: TransactionListProps) {
  const [transactions, setTransactions] = useState<AmExTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadTransactions(0);
  }, [refreshTrigger]);

  const loadTransactions = async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = page * ITEMS_PER_PAGE;
      const response = await listTransactions(ITEMS_PER_PAGE, offset);
      setTransactions(response.transactions);
      setTotalPages(response.pages);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    setDeleting(id);
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
    } finally {
      setDeleting(null);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      loadTransactions(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      loadTransactions(currentPage + 1);
    }
  };

  if (loading && transactions.length === 0) {
    return <div className="transaction-list"><p>Loading transactions...</p></div>;
  }

  if (error) {
    return (
      <div className="transaction-list">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="transaction-list">
        <p>No transactions found. Upload a statement to get started.</p>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <h2>Transactions</h2>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Card Member</th>
              <th>Amount</th>
              <th>Country</th>
              <th>Reference</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id}>
                <td>{new Date(txn.date).toLocaleDateString('en-GB')}</td>
                <td className="description">{txn.description}</td>
                <td>{txn.card_member}</td>
                <td className={txn.amount < 0 ? 'negative' : 'positive'}>
                  ${Math.abs(txn.amount).toFixed(2)}
                </td>
                <td>{txn.country || '—'}</td>
                <td className="reference" title={txn.reference}>
                  {txn.reference.substring(0, 10)}...
                </td>
                <td>
                  <button
                    onClick={() => handleDelete(txn.id)}
                    disabled={deleting === txn.id}
                    className="btn-delete"
                  >
                    {deleting === txn.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          onClick={handlePreviousPage}
          disabled={currentPage === 0}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <span className="page-info">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages - 1}
          className="btn btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );
}
