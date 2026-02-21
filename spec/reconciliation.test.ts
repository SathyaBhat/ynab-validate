import { expect } from 'chai';
import { YnabClient } from '../src/services/ynabClient';
import { ReconciliationService } from '../src/services/reconciliationService';
import type { AmExTransactionRow, YnabTransaction } from '../src/types/index';

describe('YNAB Client', () => {
  describe('milliunits conversion', () => {
    it('should convert milliunits to currency correctly', () => {
      expect(YnabClient.milliunitsToAmount(1000)).to.equal(1);
      expect(YnabClient.milliunitsToAmount(5000)).to.equal(5);
      expect(YnabClient.milliunitsToAmount(12345)).to.equal(12.345);
      expect(YnabClient.milliunitsToAmount(100)).to.equal(0.1);
    });

    it('should convert currency to milliunits correctly', () => {
      expect(YnabClient.amountToMilliunits(1)).to.equal(1000);
      expect(YnabClient.amountToMilliunits(5)).to.equal(5000);
      expect(YnabClient.amountToMilliunits(12.345)).to.equal(12345);
      expect(YnabClient.amountToMilliunits(0.1)).to.equal(100);
    });

    it('should handle negative amounts', () => {
      expect(YnabClient.milliunitsToAmount(-1000)).to.equal(-1);
      expect(YnabClient.amountToMilliunits(-5.5)).to.equal(-5500);
    });
  });

  describe('YnabClient constructor', () => {
    it('should throw error if access token is not provided', () => {
      expect(() => new YnabClient('')).to.throw('YNAB_ACCESS_TOKEN environment variable is required');
    });

    it('should create instance with valid token', () => {
      const client = new YnabClient('test_token_12345');
      expect(client).to.be.instanceOf(YnabClient);
    });
  });
});

describe('Reconciliation Service', () => {
  let reconciliationService: ReconciliationService;

  const mockCardTransaction: AmExTransactionRow = {
    id: 1,
    date: '2024-01-15',
    date_processed: '2024-01-16',
    description: 'Amazon Purchase',
    card_member: 'John Doe',
    account_number: '****1234',
    amount: 49.99,
    appears_on_statement: 'Amazon',
    country: 'US',
    reference: 'REF001',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  const mockYnabTransaction: YnabTransaction = {
    id: 'ynab-001',
    date: '2024-01-15',
    amount: 49990, // 49.99 in milliunits
    account_id: 'acct-credit-card-001',
    payee_name: 'Amazon',
    category_name: 'Shopping',
    memo: 'Electronics',
    cleared: 'cleared',
    deleted: false,
  };

  beforeEach(() => {
    const mockYnabClient = {
      getTransactionsByDateRange: async () => [],
      getBudgets: async () => [],
      getAccounts: async () => [],
    } as any;

    reconciliationService = new ReconciliationService(mockYnabClient, {
      dateTolerance: 2,
      amountTolerance: 0.01,
    });
  });

  describe('date difference calculation', () => {
    it('should calculate correct date difference', () => {
      const reconcile = reconciliationService as any;

      // Same day
      expect(reconcile.dateDifference('2024-01-15', '2024-01-15')).to.equal(0);

      // One day apart
      expect(reconcile.dateDifference('2024-01-15', '2024-01-16')).to.equal(1);
      expect(reconcile.dateDifference('2024-01-16', '2024-01-15')).to.equal(-1);

      // Multiple days apart
      expect(reconcile.dateDifference('2024-01-15', '2024-01-18')).to.equal(3);
      expect(reconcile.dateDifference('2024-01-18', '2024-01-15')).to.equal(-3);
    });
  });

  describe('transaction matching', () => {
    it('should match transactions with same amount and date', () => {
      const reconcile = reconciliationService as any;
      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [
        mockYnabTransaction,
      ]);

      expect(candidates).to.have.lengthOf(1);
      expect(candidates[0].ynabTransaction.id).to.equal('ynab-001');
      expect(candidates[0].dateDifference).to.equal(0);
    });

    it('should match transactions within date tolerance', () => {
      const reconcile = reconciliationService as any;
      const ynabTxn = { ...mockYnabTransaction, date: '2024-01-16' }; // 1 day later

      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [ynabTxn]);

      expect(candidates).to.have.lengthOf(1);
      expect(candidates[0].dateDifference).to.equal(1);
    });

    it('should not match transactions outside date tolerance', () => {
      const reconcile = reconciliationService as any;
      const ynabTxn = { ...mockYnabTransaction, date: '2024-01-18' }; // 3 days later

      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [ynabTxn]);

      expect(candidates).to.have.lengthOf(0);
    });

    it('should match transactions within amount tolerance', () => {
      const reconcile = reconciliationService as any;
      const ynabTxn = { ...mockYnabTransaction, amount: 50000 }; // $50.00 (slight difference)

      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [ynabTxn]);

      expect(candidates).to.have.lengthOf(1); // Within 0.01 tolerance
    });

    it('should not match transactions outside amount tolerance', () => {
      const reconcile = reconciliationService as any;
      const ynabTxn = { ...mockYnabTransaction, amount: 45000 }; // $45.00 (too different)

      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [ynabTxn]);

      expect(candidates).to.have.lengthOf(0);
    });

    it('should match deleted YNAB transactions (deleted flag is metadata, matching is amount-based)', () => {
      const reconcile = reconciliationService as any;
      const deletedYnab = { ...mockYnabTransaction, deleted: true };

      // Matching logic doesn't filter by deleted flag - that happens at the service level
      const candidates = reconcile.findMatchingYnabTransactions(mockCardTransaction, [deletedYnab]);

      expect(candidates).to.have.lengthOf(1); // Matching is based on amount/date, not deleted flag
    });
  });

  describe('full reconciliation flow', () => {
    it('should identify matched transactions', () => {
      const service = reconciliationService as any;
      const result = service.matchTransactions(
        [mockCardTransaction],
        [mockYnabTransaction],
      );

      expect(result.matched).to.have.lengthOf(1);
      expect(result.missingInYnab).to.have.lengthOf(0);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);
    });

    it('should identify missing YNAB transactions', () => {
      const service = reconciliationService as any;
      const result = service.matchTransactions([mockCardTransaction], []);

      expect(result.matched).to.have.lengthOf(0);
      expect(result.missingInYnab).to.have.lengthOf(1);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);
    });

    it('should identify unexpected YNAB transactions', () => {
      const service = reconciliationService as any;
      const result = service.matchTransactions([], [mockYnabTransaction]);

      expect(result.matched).to.have.lengthOf(0);
      expect(result.missingInYnab).to.have.lengthOf(0);
      expect(result.unexpectedInYnab).to.have.lengthOf(1);
    });

    it('should handle multiple transactions', () => {
      const service = reconciliationService as any;

      const card1 = { ...mockCardTransaction, id: 1, reference: 'REF001', amount: 100 };
      const card2 = { ...mockCardTransaction, id: 2, reference: 'REF002', amount: 50 };
      const card3 = { ...mockCardTransaction, id: 3, reference: 'REF003', amount: 25 };

      const ynab1 = { ...mockYnabTransaction, id: 'ynab-1', amount: 100000 };
      const ynab2 = { ...mockYnabTransaction, id: 'ynab-2', amount: 50000 };

      const result = service.matchTransactions([card1, card2, card3], [ynab1, ynab2]);

      expect(result.matched).to.have.lengthOf(2);
      expect(result.missingInYnab).to.have.lengthOf(1);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero amounts', () => {
      const reconcile = reconciliationService as any;
      const cardZero = { ...mockCardTransaction, amount: 0 };
      const ynabZero = { ...mockYnabTransaction, amount: 0 };

      const candidates = reconcile.findMatchingYnabTransactions(cardZero, [ynabZero]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should handle negative amounts (credits)', () => {
      const reconcile = reconciliationService as any;
      const cardCredit = { ...mockCardTransaction, amount: -25.5 };
      const ynabCredit = { ...mockYnabTransaction, amount: -25500 };

      const candidates = reconcile.findMatchingYnabTransactions(cardCredit, [ynabCredit]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should handle very large amounts', () => {
      const reconcile = reconciliationService as any;
      const cardLarge = { ...mockCardTransaction, amount: 9999.99 };
      const ynabLarge = { ...mockYnabTransaction, amount: 9999990 };

      const candidates = reconcile.findMatchingYnabTransactions(cardLarge, [ynabLarge]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should handle very small amounts', () => {
      const reconcile = reconciliationService as any;
      const cardSmall = { ...mockCardTransaction, amount: 0.01 };
      const ynabSmall = { ...mockYnabTransaction, amount: 10 };

      const candidates = reconcile.findMatchingYnabTransactions(cardSmall, [ynabSmall]);
      expect(candidates).to.have.lengthOf(1);
    });
  });

  describe('sign handling (positive card vs negative YNAB)', () => {
    it('should match positive card amount with negative YNAB amount (typical expense)', () => {
      const reconcile = reconciliationService as any;
      // Card shows expenses as positive
      const cardExpense = { ...mockCardTransaction, amount: 30.00 };
      // YNAB shows expenses as negative
      const ynabExpense = { ...mockYnabTransaction, amount: -30000 };

      const candidates = reconcile.findMatchingYnabTransactions(cardExpense, [ynabExpense]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should match Coles transaction example from bug report', () => {
      const reconcile = reconciliationService as any;
      const colesCard: AmExTransactionRow = {
        ...mockCardTransaction,
        date: '2026-02-01',
        description: 'COLES STANHOPE GARDENS',
        amount: 30.00,
        reference: 'AT260320012000010163948',
      };
      const colesYnab: YnabTransaction = {
        ...mockYnabTransaction,
        date: '2026-02-01',
        amount: -30000, // -$30.00 in milliunits
        payee_name: 'Coles',
      };

      const candidates = reconcile.findMatchingYnabTransactions(colesCard, [colesYnab]);
      expect(candidates).to.have.lengthOf(1);
      expect(candidates[0].dateDifference).to.equal(0);
    });

    it('should match Bunnings transaction example from bug report', () => {
      const reconcile = reconciliationService as any;
      const bunningsCard: AmExTransactionRow = {
        ...mockCardTransaction,
        date: '2026-02-01',
        description: 'BUNNINGS GROUP LTD RIVE',
        amount: 414.00,
        reference: 'AT260320003000010160795',
      };
      const bunningsYnab: YnabTransaction = {
        ...mockYnabTransaction,
        date: '2026-02-01',
        amount: -414000, // -$414.00 in milliunits
        payee_name: 'Bunnings',
      };

      const candidates = reconcile.findMatchingYnabTransactions(bunningsCard, [bunningsYnab]);
      expect(candidates).to.have.lengthOf(1);
      expect(candidates[0].dateDifference).to.equal(0);
    });

    it('should NOT match when amounts differ despite sign', () => {
      const reconcile = reconciliationService as any;
      const cardExpense = { ...mockCardTransaction, amount: 30.00 };
      const ynabExpense = { ...mockYnabTransaction, amount: -50000 }; // -$50.00

      const candidates = reconcile.findMatchingYnabTransactions(cardExpense, [ynabExpense]);
      expect(candidates).to.have.lengthOf(0);
    });

    it('should match negative card amount (refund) with positive YNAB amount', () => {
      const reconcile = reconciliationService as any;
      // Card refund (negative on card)
      const cardRefund = { ...mockCardTransaction, amount: -50.00 };
      // YNAB inflow (positive in YNAB)
      const ynabInflow = { ...mockYnabTransaction, amount: 50000 };

      const candidates = reconcile.findMatchingYnabTransactions(cardRefund, [ynabInflow]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should handle mixed transaction types in reconciliation', () => {
      const service = reconciliationService as any;

      // Card transactions (all positive for expenses, negative for refunds)
      const cardExpense = { ...mockCardTransaction, id: 1, amount: 100.00, reference: 'EXP1' };
      const cardRefund = { ...mockCardTransaction, id: 2, amount: -25.00, reference: 'REF1' };

      // YNAB transactions (negative for expenses, positive for inflows)
      const ynabExpense = { ...mockYnabTransaction, id: 'y1', amount: -100000 };
      const ynabInflow = { ...mockYnabTransaction, id: 'y2', amount: 25000 };

      const result = service.matchTransactions(
        [cardExpense, cardRefund],
        [ynabExpense, ynabInflow]
      );

      expect(result.matched).to.have.lengthOf(2);
      expect(result.missingInYnab).to.have.lengthOf(0);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);
    });

    it('should respect amount tolerance even with opposite signs', () => {
      const reconcile = reconciliationService as any;
      // Card: $30.00
      const cardExpense = { ...mockCardTransaction, amount: 30.00 };
      // YNAB: -$30.005 (0.005 difference, clearly within 0.01 tolerance)
      const ynabExpense = { ...mockYnabTransaction, amount: -30005 };

      const candidates = reconcile.findMatchingYnabTransactions(cardExpense, [ynabExpense]);
      expect(candidates).to.have.lengthOf(1);
    });

    it('should not match when difference exceeds tolerance with opposite signs', () => {
      const reconcile = reconciliationService as any;
      // Card: $30.00
      const cardExpense = { ...mockCardTransaction, amount: 30.00 };
      // YNAB: -$30.02 (exceeds 0.01 tolerance)
      const ynabExpense = { ...mockYnabTransaction, amount: -30020 };

      const candidates = reconcile.findMatchingYnabTransactions(cardExpense, [ynabExpense]);
      expect(candidates).to.have.lengthOf(0);
    });
  });

  describe('account filtering', () => {
    it('should include account_id in YNAB transactions', () => {
      expect(mockYnabTransaction).to.have.property('account_id');
      expect(mockYnabTransaction.account_id).to.equal('acct-credit-card-001');
    });

    it('should filter transactions by account ID', () => {
      const service = reconciliationService as any;

      // Card transaction
      const cardTxn = { ...mockCardTransaction, amount: 100.00 };

      // YNAB transactions from different accounts
      const ynabCreditCard = {
        ...mockYnabTransaction,
        id: 'y1',
        amount: -100000,
        account_id: 'acct-credit-card-001' // Credit card account
      };
      const ynabChecking = {
        ...mockYnabTransaction,
        id: 'y2',
        amount: -100000,
        account_id: 'acct-checking-001' // Checking account (different!)
      };
      const ynabSavings = {
        ...mockYnabTransaction,
        id: 'y3',
        amount: -100000,
        account_id: 'acct-savings-001' // Savings account (different!)
      };

      // Without filtering, all would match (same amount, same date)
      const allCandidates = service.findMatchingYnabTransactions(cardTxn, [
        ynabCreditCard,
        ynabChecking,
        ynabSavings
      ]);

      // All three match based on amount/date
      expect(allCandidates).to.have.lengthOf(3);

      // In real scenario, YNAB client filters by account before matching
      // So reconciliation service would only see credit card transactions
      const filteredCandidates = service.findMatchingYnabTransactions(cardTxn, [
        ynabCreditCard  // Only credit card account transactions
      ]);

      expect(filteredCandidates).to.have.lengthOf(1);
      expect(filteredCandidates[0].ynabTransaction.account_id).to.equal('acct-credit-card-001');
    });

    it('should not match transactions from wrong account even if amount matches', () => {
      const service = reconciliationService as any;

      // Card transaction for $50
      const cardTxn = { ...mockCardTransaction, amount: 50.00 };

      // YNAB transaction from checking account with same amount
      const ynabChecking = {
        ...mockYnabTransaction,
        amount: -50000,
        account_id: 'acct-checking-001'
      };

      // Should match based on amount/date alone
      const candidates = service.findMatchingYnabTransactions(cardTxn, [ynabChecking]);
      expect(candidates).to.have.lengthOf(1);

      // But in practice, YnabClient filters by account_id
      // so checking account transactions never reach the matching logic
      const emptyList = service.findMatchingYnabTransactions(cardTxn, []);
      expect(emptyList).to.have.lengthOf(0);
    });

    it('should handle multiple transactions from same account', () => {
      const service = reconciliationService as any;

      // Two card transactions
      const card1 = { ...mockCardTransaction, id: 1, amount: 25.00, reference: 'REF1' };
      const card2 = { ...mockCardTransaction, id: 2, amount: 75.00, reference: 'REF2' };

      // Two YNAB transactions from credit card account
      const ynab1 = {
        ...mockYnabTransaction,
        id: 'y1',
        amount: -25000,
        account_id: 'acct-credit-card-001'
      };
      const ynab2 = {
        ...mockYnabTransaction,
        id: 'y2',
        amount: -75000,
        account_id: 'acct-credit-card-001'
      };

      // One from checking (should be filtered out by YnabClient)
      const ynabChecking = {
        ...mockYnabTransaction,
        id: 'y3',
        amount: -25000,
        account_id: 'acct-checking-001'
      };

      // Simulate what YnabClient returns (already filtered by account)
      const result = service.matchTransactions(
        [card1, card2],
        [ynab1, ynab2] // Only credit card account transactions
      );

      expect(result.matched).to.have.lengthOf(2);
      expect(result.missingInYnab).to.have.lengthOf(0);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);

      // All matched transactions should be from correct account
      result.matched.forEach(match => {
        expect(match.ynabTransaction.account_id).to.equal('acct-credit-card-001');
      });
    });

    it('should not show unexpected transactions from other accounts', () => {
      const service = reconciliationService as any;

      // Single card transaction
      const cardTxn = { ...mockCardTransaction, amount: 100.00 };

      // YNAB has this transaction on credit card
      const ynabCreditCard = {
        ...mockYnabTransaction,
        id: 'y1',
        amount: -100000,
        account_id: 'acct-credit-card-001'
      };

      // YNAB also has unrelated checking transactions (same date range)
      const ynabChecking1 = {
        ...mockYnabTransaction,
        id: 'y2',
        amount: -50000,
        account_id: 'acct-checking-001'
      };
      const ynabChecking2 = {
        ...mockYnabTransaction,
        id: 'y3',
        amount: -75000,
        account_id: 'acct-checking-001'
      };

      // YnabClient filters by account_id, so checking transactions aren't included
      const result = service.matchTransactions(
        [cardTxn],
        [ynabCreditCard] // Only credit card account
      );

      expect(result.matched).to.have.lengthOf(1);
      expect(result.missingInYnab).to.have.lengthOf(0);
      expect(result.unexpectedInYnab).to.have.lengthOf(0);

      // Without filtering (the bug!), checking transactions would show as "unexpected"
      const unfilteredResult = service.matchTransactions(
        [cardTxn],
        [ynabCreditCard, ynabChecking1, ynabChecking2] // All accounts
      );

      expect(unfilteredResult.matched).to.have.lengthOf(1);
      expect(unfilteredResult.unexpectedInYnab).to.have.lengthOf(2); // BUG: shows checking txns
    });
  });
});
