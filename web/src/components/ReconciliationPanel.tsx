import { useState, useEffect } from 'react';
import {
  getBudgets,
  getAccountsForBudget,
  runReconciliation,
  persistMatches,
  flagTransactions,
  createTransactionsInYnab,
} from '../api/client';
import type {
  YnabBudget,
  YnabAccount,
  ReconciliationResultWithActions,
} from '../types';
import './ReconciliationPanel.css';

export function ReconciliationPanel() {
  // State for budgets and accounts
  const [budgets, setBudgets] = useState<YnabBudget[]>([]);
  const [accounts, setAccounts] = useState<YnabAccount[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Date range state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Results state
  const [result, setResult] = useState<ReconciliationResultWithActions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state for bulk actions
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [selectedMissing, setSelectedMissing] = useState<Set<number>>(new Set());
  const [selectedUnexpected, setSelectedUnexpected] = useState<Set<string>>(new Set());

  // Action loading states
  const [savingMatches, setSavingMatches] = useState(false);
  const [flaggingTransactions, setFlaggingTransactions] = useState(false);
  const [creatingTransactions, setCreatingTransactions] = useState(false);

  // Load budgets on mount
  useEffect(() => {
    loadBudgets();
    // Set default dates (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // Load accounts when budget changes
  useEffect(() => {
    if (selectedBudget) {
      loadAccounts(selectedBudget);
    }
  }, [selectedBudget]);

  const loadBudgets = async () => {
    try {
      const budgetList = await getBudgets();
      setBudgets(budgetList);
      if (budgetList.length > 0) {
        setSelectedBudget(budgetList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    }
  };

  const loadAccounts = async (budgetId: string) => {
    try {
      const accountList = await getAccountsForBudget(budgetId);
      setAccounts(accountList);
      if (accountList.length > 0) {
        // Try to find credit card account or use first account
        const creditCardAccount = accountList.find((acc) =>
          acc.type.toLowerCase().includes('credit'),
        );
        setSelectedAccount(creditCardAccount?.id || accountList[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleRunReconciliation = async () => {
    if (!selectedBudget || !selectedAccount || !startDate || !endDate) {
      setError('Please select budget, account, and date range');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedMatches(new Set());
    setSelectedMissing(new Set());
    setSelectedUnexpected(new Set());

    try {
      const reconciliationResult = await runReconciliation({
        budgetId: selectedBudget,
        accountId: selectedAccount,
        startDate,
        endDate,
        persist: false,
      });
      setResult(reconciliationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMatches = async () => {
    if (!result || selectedMatches.size === 0) return;

    setSavingMatches(true);
    try {
      const matches = Array.from(selectedMatches).map((cardId) => {
        const match = result.discrepancies.matched.find((m) => m.cardTransaction.id === cardId);
        return {
          cardId,
          ynabId: match!.ynabTransaction.id,
        };
      });

      await persistMatches(matches, selectedBudget, startDate, endDate);
      alert(`Successfully saved ${matches.length} matches!`);
      setSelectedMatches(new Set());
      // Re-run reconciliation to refresh
      handleRunReconciliation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save matches');
    } finally {
      setSavingMatches(false);
    }
  };

  const handleFlagSelected = async () => {
    if (selectedUnexpected.size === 0) return;

    setFlaggingTransactions(true);
    try {
      const transactionIds = Array.from(selectedUnexpected);
      const flagResult = await flagTransactions(selectedBudget, transactionIds, 'orange');
      alert(
        `Successfully flagged ${flagResult.flagged} transactions${flagResult.errors.length > 0 ? ` (${flagResult.errors.length} errors)` : ''}`,
      );
      setSelectedUnexpected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag transactions');
    } finally {
      setFlaggingTransactions(false);
    }
  };

  const handleCreateSelected = async () => {
    if (selectedMissing.size === 0 || !selectedAccount) {
      setError('Please select transactions and an account');
      return;
    }

    setCreatingTransactions(true);
    try {
      const cardTransactionIds = Array.from(selectedMissing);
      const createResult = await createTransactionsInYnab(
        selectedBudget,
        selectedAccount,
        cardTransactionIds,
      );
      alert(
        `Created ${createResult.created} transactions, skipped ${createResult.skipped} duplicates${createResult.errors.length > 0 ? `, ${createResult.errors.length} errors` : ''}`,
      );
      setSelectedMissing(new Set());
      // Re-run reconciliation to refresh
      handleRunReconciliation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transactions');
    } finally {
      setCreatingTransactions(false);
    }
  };

  const toggleMatchSelection = (cardId: number) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedMatches(newSelected);
  };

  const toggleMissingSelection = (cardId: number) => {
    const newSelected = new Set(selectedMissing);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedMissing(newSelected);
  };

  const toggleUnexpectedSelection = (ynabId: string) => {
    const newSelected = new Set(selectedUnexpected);
    if (newSelected.has(ynabId)) {
      newSelected.delete(ynabId);
    } else {
      newSelected.add(ynabId);
    }
    setSelectedUnexpected(newSelected);
  };

  const formatAmount = (amount: number, isMilliunits: boolean = false) => {
    const value = isMilliunits ? amount / 1000 : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getDateDiffBadge = (daysDiff: number) => {
    const absDiff = Math.abs(daysDiff);
    if (absDiff === 0) return <span className="badge badge-success">Same day</span>;
    if (absDiff === 1)
      return <span className="badge badge-warning">{daysDiff > 0 ? '+1 day' : '-1 day'}</span>;
    return (
      <span className="badge badge-warning">
        {daysDiff > 0 ? `+${absDiff}` : `-${absDiff}`} days
      </span>
    );
  };

  return (
    <div className="reconciliation-panel">
      <h2>YNAB Reconciliation</h2>

      {/* Controls */}
      <div className="controls">
        <div className="control-group">
          <label htmlFor="budget">Budget:</label>
          <select
            id="budget"
            value={selectedBudget}
            onChange={(e) => setSelectedBudget(e.target.value)}
            disabled={loading}
          >
            <option value="">Select budget...</option>
            {budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="account">Account:</label>
          <select
            id="account"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            disabled={loading || !selectedBudget}
          >
            <option value="">Select account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.type})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="startDate">Start Date:</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="control-group">
          <label htmlFor="endDate">End Date:</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunReconciliation}
          disabled={loading || !selectedBudget || !selectedAccount || !startDate || !endDate}
        >
          {loading ? 'Running...' : 'Run Reconciliation'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Results */}
      {result && result.success && (
        <div className="results">
          <div className="results-summary">
            <p>
              <strong>Card Transactions:</strong> {result.cardTransactionCount} |{' '}
              <strong>YNAB Transactions:</strong> {result.ynabTransactionCount} |{' '}
              <strong>Matched:</strong> {result.matchedCount}
            </p>
          </div>

          {/* Matched Transactions */}
          {result.discrepancies.matched.length > 0 && (
            <div className="section section-matched">
              <div className="section-header">
                <h3>Matched Transactions ({result.discrepancies.matched.length})</h3>
                <button
                  className="btn btn-save"
                  onClick={handleSaveMatches}
                  disabled={selectedMatches.size === 0 || savingMatches}
                >
                  {savingMatches
                    ? 'Saving...'
                    : `Save ${selectedMatches.size} Selected Match${selectedMatches.size !== 1 ? 'es' : ''}`}
                </button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            selectedMatches.size === result.discrepancies.matched.length &&
                            result.discrepancies.matched.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMatches(
                                new Set(
                                  result.discrepancies.matched.map((m) => m.cardTransaction.id),
                                ),
                              );
                            } else {
                              setSelectedMatches(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>Date</th>
                      <th>Description (Card)</th>
                      <th>Amount</th>
                      <th>YNAB Payee</th>
                      <th>Date Diff</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.discrepancies.matched.map((match) => (
                      <tr key={match.cardTransaction.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedMatches.has(match.cardTransaction.id)}
                            onChange={() => toggleMatchSelection(match.cardTransaction.id)}
                          />
                        </td>
                        <td>{match.cardTransaction.date}</td>
                        <td>{match.cardTransaction.description}</td>
                        <td>{formatAmount(match.cardTransaction.amount)}</td>
                        <td>{match.ynabTransaction.payee_name || '(no payee)'}</td>
                        <td>{getDateDiffBadge(match.dateDifference)}</td>
                        <td className="reference">{match.cardTransaction.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing in YNAB */}
          {result.discrepancies.missingInYnab.length > 0 && (
            <div className="section section-missing">
              <div className="section-header">
                <h3>Missing in YNAB ({result.discrepancies.missingInYnab.length})</h3>
                <button
                  className="btn btn-create"
                  onClick={handleCreateSelected}
                  disabled={
                    selectedMissing.size === 0 || !selectedAccount || creatingTransactions
                  }
                >
                  {creatingTransactions
                    ? 'Creating...'
                    : `Create ${selectedMissing.size} Selected in YNAB`}
                </button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            selectedMissing.size === result.discrepancies.missingInYnab.length &&
                            result.discrepancies.missingInYnab.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMissing(
                                new Set(result.discrepancies.missingInYnab.map((t) => t.id)),
                              );
                            } else {
                              setSelectedMissing(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Card Member</th>
                      <th>Amount</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.discrepancies.missingInYnab.map((txn) => (
                      <tr key={txn.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedMissing.has(txn.id)}
                            onChange={() => toggleMissingSelection(txn.id)}
                          />
                        </td>
                        <td>{txn.date}</td>
                        <td>{txn.description}</td>
                        <td>{txn.card_member}</td>
                        <td>{formatAmount(txn.amount)}</td>
                        <td className="reference">{txn.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unexpected in YNAB */}
          {result.discrepancies.unexpectedInYnab.length > 0 && (
            <div className="section section-unexpected">
              <div className="section-header">
                <h3>Unexpected in YNAB ({result.discrepancies.unexpectedInYnab.length})</h3>
                <button
                  className="btn btn-flag"
                  onClick={handleFlagSelected}
                  disabled={selectedUnexpected.size === 0 || flaggingTransactions}
                >
                  {flaggingTransactions
                    ? 'Flagging...'
                    : `Flag ${selectedUnexpected.size} Selected (Orange)`}
                </button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            selectedUnexpected.size ===
                              result.discrepancies.unexpectedInYnab.length &&
                            result.discrepancies.unexpectedInYnab.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUnexpected(
                                new Set(result.discrepancies.unexpectedInYnab.map((t) => t.id)),
                              );
                            } else {
                              setSelectedUnexpected(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>Date</th>
                      <th>Payee</th>
                      <th>Amount</th>
                      <th>Memo</th>
                      <th>Category</th>
                      <th>Cleared</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.discrepancies.unexpectedInYnab.map((txn) => (
                      <tr key={txn.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedUnexpected.has(txn.id)}
                            onChange={() => toggleUnexpectedSelection(txn.id)}
                          />
                        </td>
                        <td>{txn.date}</td>
                        <td>{txn.payee_name || '(no payee)'}</td>
                        <td>{formatAmount(txn.amount, true)}</td>
                        <td>{txn.memo || ''}</td>
                        <td>{txn.category_name || '(uncategorized)'}</td>
                        <td>{txn.cleared}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.discrepancies.matched.length === 0 &&
            result.discrepancies.missingInYnab.length === 0 &&
            result.discrepancies.unexpectedInYnab.length === 0 && (
              <div className="no-results">
                <p>No discrepancies found! All transactions match perfectly.</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
