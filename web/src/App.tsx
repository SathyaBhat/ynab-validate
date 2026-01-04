import { useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { TransactionList } from './components/TransactionList';
import { ImportHistory } from './components/ImportHistory';
import { ImportResult } from './types';
import './App.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  const handleImportComplete = (result: ImportResult) => {
    setLastImportResult(result);
    setShowNotification(true);
    setRefreshTrigger((prev) => prev + 1);

    // Hide notification after 5 seconds
    setTimeout(() => setShowNotification(false), 5000);
  };

  return (
    <div className="app">
      <Header />

      {showNotification && lastImportResult && (
        <div className={`notification ${lastImportResult.success ? 'success' : 'partial'}`}>
          <div className="notification-content">
            <strong>
              {lastImportResult.success ? '✓ Import Successful' : '⚠ Import Completed'}
            </strong>
            <p>
              Imported {lastImportResult.importedRecords} of {lastImportResult.totalRecords} records.
              {lastImportResult.skippedRecords > 0 && ` ${lastImportResult.skippedRecords} skipped.`}
            </p>
          </div>
          <button
            className="notification-close"
            onClick={() => setShowNotification(false)}
          >
            ×
          </button>
        </div>
      )}

      <main className="container">
        <FileUpload onImportComplete={handleImportComplete} />

        <div className="tabs">
          <div className="tab-content">
            <h2>Transactions</h2>
            <TransactionList refreshTrigger={refreshTrigger} />
          </div>

          <div className="tab-content">
            <ImportHistory refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>AmEx Statement Importer © 2025</p>
      </footer>
    </div>
  );
}

export default App;
