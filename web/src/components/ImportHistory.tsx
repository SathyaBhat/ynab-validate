import { useState, useEffect } from 'react';
import { getImportHistory } from '../api/client';
import { ImportLog } from '../types';
import './ImportHistory.css';

interface ImportHistoryProps {
  refreshTrigger?: number;
}

export function ImportHistory({ refreshTrigger = 0 }: ImportHistoryProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getImportHistory(50, 0);
      setLogs(response.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="import-history"><p>Loading history...</p></div>;
  }

  if (error) {
    return (
      <div className="import-history">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="import-history">
        <h2>Import History</h2>
        <p>No imports yet.</p>
      </div>
    );
  }

  return (
    <div className="import-history">
      <h2>Import History</h2>

      <div className="history-list">
        {logs.map((log) => (
          <div key={log.id} className="history-item">
            <div className="header">
              <h3>{log.fileName}</h3>
              <span className="timestamp">
                {new Date(log.importTimestamp).toLocaleDateString('en-GB')}
              </span>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="label">Total Records:</span>
                <span className="value">{log.totalRecords}</span>
              </div>
              <div className="stat">
                <span className="label">Imported:</span>
                <span className="value success">{log.importedRecords}</span>
              </div>
              <div className="stat">
                <span className="label">Skipped:</span>
                <span className="value">{log.skippedRecords}</span>
              </div>
              <div className="stat">
                <span className="label">Errors:</span>
                <span className={`value ${log.errorCount > 0 ? 'error' : ''}`}>
                  {log.errorCount}
                </span>
              </div>
            </div>

            {log.errors && log.errors.length > 0 && (
              <div className="errors">
                <h4>Issues ({log.errors.length}):</h4>
                <ul>
                  {log.errors.slice(0, 3).map((err, i) => (
                    <li key={i}>
                      {err.error}
                      {err.reference && <code>{err.reference}</code>}
                    </li>
                  ))}
                  {log.errors.length > 3 && (
                    <li>... and {log.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
