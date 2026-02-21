import axios from 'axios';
import type {
  ImportResult,
  ValidationResult,
  AmExTransactionRow,
  ImportLog,
  ReconciliationResultWithActions,
  ReconciliationParams,
  MatchPair,
  PersistResult,
  FlagResult,
  CreateResult,
  UnmatchResult,
  ReconciliationLog,
  YnabBudget,
  YnabAccount,
} from '../types';

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

// Reconciliation endpoints
export const getBudgets = async (): Promise<YnabBudget[]> => {
  const response = await apiClient.get<{ data: YnabBudget[] }>('/api/reconcile/budgets');
  return response.data.data;
};

export const getAccountsForBudget = async (budgetId: string): Promise<YnabAccount[]> => {
  const response = await apiClient.get<{ data: YnabAccount[] }>(
    `/api/reconcile/accounts/${budgetId}`,
  );
  return response.data.data;
};

export const runReconciliation = async (
  params: ReconciliationParams,
): Promise<ReconciliationResultWithActions> => {
  const response = await apiClient.post<{ data: ReconciliationResultWithActions }>(
    '/api/reconcile',
    params,
    {
      params: {
        persist: params.persist || false,
      },
    },
  );
  return response.data.data;
};

export const persistMatches = async (
  matches: MatchPair[],
  budgetId: string,
  startDate: string,
  endDate: string,
): Promise<PersistResult> => {
  const response = await apiClient.post<{ data: PersistResult }>('/api/reconcile/persist', {
    matches,
    budgetId,
    startDate,
    endDate,
  });
  return response.data.data;
};

export const flagTransactions = async (
  budgetId: string,
  transactionIds: string[],
  flagColor: string = 'orange',
): Promise<FlagResult> => {
  const response = await apiClient.post<{ data: FlagResult }>('/api/reconcile/flag', {
    budgetId,
    transactionIds,
    flagColor,
  });
  return response.data.data;
};

export const createTransactionsInYnab = async (
  budgetId: string,
  accountId: string,
  cardTransactionIds: number[],
): Promise<CreateResult> => {
  const response = await apiClient.post<{ data: CreateResult }>('/api/reconcile/create', {
    budgetId,
    accountId,
    cardTransactionIds,
  });
  return response.data.data;
};

export const unmatchTransaction = async (cardId: number): Promise<UnmatchResult> => {
  const response = await apiClient.delete<{ data: UnmatchResult }>(
    `/api/reconcile/match/${cardId}`,
  );
  return response.data.data;
};

export const getReconciliationHistory = async (
  budgetId?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ReconciliationLog[]> => {
  const response = await apiClient.get<{ data: ReconciliationLog[] }>(
    '/api/reconcile/history',
    {
      params: { budgetId, limit, offset },
    },
  );
  return response.data.data;
};
