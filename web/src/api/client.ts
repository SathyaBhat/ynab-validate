import axios from 'axios';
import type { ImportResult, ValidationResult, AmExTransactionRow, ImportLog } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/health');
    return response.data.success === true;
  } catch {
    return false;
  }
};

// Import endpoints
export const importStatement = async (file: File): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ data: ImportResult }>('/api/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
};

export const validateStatement = async (file: File): Promise<ValidationResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ data: ValidationResult }>(
    '/api/import/validate',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return response.data.data;
};

// Transaction endpoints
export interface ListTransactionsResponse {
  transactions: AmExTransactionRow[];
  total: number;
  limit: number;
  offset: number;
  pages: number;
}

export const listTransactions = async (
  limit: number = 50,
  offset: number = 0,
): Promise<ListTransactionsResponse> => {
  const response = await apiClient.get<{ data: ListTransactionsResponse }>(
    '/api/transactions',
    {
      params: { limit, offset },
    },
  );

  return response.data.data;
};

export const getTransaction = async (reference: string): Promise<AmExTransactionRow> => {
  const response = await apiClient.get<{ data: AmExTransactionRow }>(
    `/api/transactions/${reference}`,
  );

  return response.data.data;
};

export const deleteTransaction = async (id: number): Promise<{ deleted: boolean; id: number }> => {
  const response = await apiClient.delete<{ data: { deleted: boolean; id: number } }>(
    `/api/transactions/${id}`,
  );

  return response.data.data;
};

// Import history endpoints
export interface ImportHistoryResponse {
  logs: ImportLog[];
  total: number;
  limit: number;
  offset: number;
}

export const getImportHistory = async (
  limit: number = 50,
  offset: number = 0,
): Promise<ImportHistoryResponse> => {
  const response = await apiClient.get<{ data: ImportHistoryResponse }>(
    '/api/import-history',
    {
      params: { limit, offset },
    },
  );

  return response.data.data;
};
