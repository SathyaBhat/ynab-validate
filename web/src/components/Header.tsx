import { useEffect, useState } from 'react';
import { checkHealth } from '../api/client';
import './Header.css';

export function Header() {
  const [isHealthy, setIsHealthy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkServerHealth = async () => {
      setChecking(true);
      const healthy = await checkHealth();
      setIsHealthy(healthy);
      setChecking(false);

      // Check every 30 seconds
      const interval = setInterval(async () => {
        const h = await checkHealth();
        setIsHealthy(h);
      }, 30000);

      return () => clearInterval(interval);
    };

    checkServerHealth();
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <div className="title">
          <h1>AmEx Statement Importer</h1>
          <p>Upload and manage your American Express transactions</p>
        </div>

        <div className="status">
          {checking ? (
            <span className="status-checking">Checking...</span>
          ) : isHealthy ? (
            <span className="status-healthy">✓ Server Connected</span>
          ) : (
            <span className="status-offline">✗ Server Offline</span>
          )}
        </div>
      </div>
    </header>
  );
}
