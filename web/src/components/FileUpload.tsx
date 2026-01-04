import { useState } from 'react';
import { importStatement, validateStatement } from '../api/client';
import { ImportResult, ValidationResult } from '../types';
import './FileUpload.css';

interface FileUploadProps {
  onImportComplete: (result: ImportResult) => void;
}

export function FileUpload({ onImportComplete }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setImportError(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await validateStatement(file);
      setValidationResult(result);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Validation failed',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await importStatement(file);
      onImportComplete(result);
      setFile(null);
      setValidationResult(null);
      setImportError(null);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Import failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload">
      <h2>Upload AmEx Statement</h2>

      <div className="upload-section">
        <label htmlFor="file-input" className="file-label">
          Choose XLSX File
        </label>
        <input
          id="file-input"
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          disabled={loading}
          className="file-input"
        />
        {file && <p className="file-name">Selected: {file.name}</p>}
      </div>

      {importError && <div className="error-message">{importError}</div>}

      <div className="button-group">
        <button
          onClick={handleValidate}
          disabled={!file || loading}
          className="btn btn-secondary"
        >
          {loading ? 'Validating...' : 'Validate'}
        </button>
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="btn btn-primary"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>

      {validationResult && (
        <div className="validation-result">
          <h3>Validation Results</h3>
          <div className="stats">
            <div className="stat">
              <span className="label">Total Records:</span>
              <span className="value">{validationResult.totalRecords}</span>
            </div>
            <div className="stat">
              <span className="label">Valid:</span>
              <span className="value valid">{validationResult.validRecords}</span>
            </div>
            <div className="stat">
              <span className="label">Invalid:</span>
              <span className="value invalid">{validationResult.invalidRecords}</span>
            </div>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="errors">
              <h4>Errors Found:</h4>
              <ul>
                {validationResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>
                    <strong>Row {err.rowNumber}:</strong> {err.errors.join(', ')}
                  </li>
                ))}
                {validationResult.errors.length > 5 && (
                  <li>... and {validationResult.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
