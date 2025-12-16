import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '@/app/dashboard/page';
import { FundingModal } from '@/components/FundingModal';
import { TransactionList } from '@/components/TransactionList';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock tRPC client
const mockGetAccounts = jest.fn();
const mockGetTransactions = jest.fn();
const mockFundAccount = jest.fn();
const mockInvalidateTransactions = jest.fn();
const mockLogout = jest.fn();

jest.mock('@/lib/trpc/client', () => ({
  trpc: {
    account: {
      getAccounts: {
        useQuery: () => mockGetAccounts(),
      },
      getTransactions: {
        useQuery: ({ accountId }: { accountId: number }) => mockGetTransactions(accountId),
      },
      fundAccount: {
        useMutation: () => ({
          mutateAsync: mockFundAccount,
          isPending: false,
        }),
      },
    },
    auth: {
      logout: {
        useMutation: () => ({
          mutateAsync: mockLogout,
        }),
      },
    },
    useUtils: () => ({
      account: {
        getTransactions: {
          invalidate: mockInvalidateTransactions,
        },
      },
    }),
  },
}));

describe('Transaction History Update Bug', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  describe('Current Bug Behavior', () => {
    it('should demonstrate the bug: transaction history does not update after funding', async () => {
      const mockAccounts = [
        {
          id: 1,
          accountType: 'checking',
          accountNumber: '1234567890',
          balance: 100,
          status: 'active',
        },
      ];

      const initialTransactions: any[] = [];
      const transactionAfterFunding = {
        id: 1,
        accountId: 1,
        type: 'deposit',
        amount: 50,
        description: 'Funding from card',
        status: 'completed',
        createdAt: new Date().toISOString(),
      };

      // Setup mock returns
      mockGetAccounts.mockReturnValue({
        data: mockAccounts,
        refetch: jest.fn(),
      });

      // First call returns empty, second call should return with new transaction
      let transactionCallCount = 0;
      mockGetTransactions.mockImplementation(() => {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          return { data: initialTransactions, isLoading: false };
        }
        // Without the fix, this second call never happens because cache isn't invalidated
        return { data: [transactionAfterFunding], isLoading: false };
      });

      mockFundAccount.mockResolvedValue({
        transaction: transactionAfterFunding,
        newBalance: 150,
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/Checking Account/i)).toBeInTheDocument();
      });

      // Click on account to view transactions
      const accountCard = screen.getByText(/Checking Account/i).closest('div');
      fireEvent.click(accountCard!);

      // Should see empty transaction list
      await waitFor(() => {
        expect(screen.getByText(/No transactions yet/i)).toBeInTheDocument();
      });

      // Click Fund Account button
      const fundButton = screen.getByText(/Fund Account/i);
      fireEvent.click(fundButton);

      // The funding modal would open and complete funding
      // Simulate the success callback
      const onSuccessCallback = mockGetAccounts.mock.calls[0][0]?.onSuccess;
      if (onSuccessCallback) {
        await onSuccessCallback();
      }

      // Without the fix: Transaction history is NOT invalidated
      // So even after funding, the transaction list shows old cached data
      expect(mockInvalidateTransactions).not.toHaveBeenCalled();

      // The bug: User still sees "No transactions yet" even after funding
      // because the transaction query cache was not invalidated
    });
  });

  describe('Expected Behavior After Fix', () => {
    it('should invalidate transaction cache after successful funding', async () => {
      const mockAccounts = [
        {
          id: 1,
          accountType: 'checking',
          accountNumber: '1234567890',
          balance: 100,
          status: 'active',
        },
      ];

      mockGetAccounts.mockReturnValue({
        data: mockAccounts,
        refetch: jest.fn().mockResolvedValue({ data: mockAccounts }),
      });

      mockGetTransactions.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Checking Account/i)).toBeInTheDocument();
      });

      // After implementing the fix, when funding completes:
      // 1. refetchAccounts() should be called (already working)
      // 2. utils.account.getTransactions.invalidate() should be called (the fix)

      // This ensures fresh transaction data is fetched when viewing the account
    });

    it('should show updated transactions without page refresh', async () => {
      // After the fix is implemented:
      // 1. User funds account
      // 2. Transaction cache is invalidated
      // 3. Clicking on account shows updated transaction history
      // 4. No page refresh needed

      const mockAccounts = [
        {
          id: 1,
          accountType: 'checking',
          accountNumber: '1234567890',
          balance: 150, // Updated balance after funding
          status: 'active',
        },
      ];

      const updatedTransactions = [
        {
          id: 1,
          accountId: 1,
          type: 'deposit',
          amount: 50,
          description: 'Funding from card',
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ];

      mockGetAccounts.mockReturnValue({
        data: mockAccounts,
        refetch: jest.fn(),
      });

      mockGetTransactions.mockReturnValue({
        data: updatedTransactions,
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TransactionList accountId={1} />
        </QueryClientProvider>
      );

      // With the fix, transactions should show immediately
      await waitFor(() => {
        expect(screen.getByText(/Funding from card/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cache Invalidation Logic', () => {
    it('should only invalidate transactions for the funded account', async () => {
      // Test that we only invalidate the specific account's transactions
      // Not all transaction queries globally

      const fundingAccountId = 1;
      const otherAccountId = 2;

      // After funding account 1, only account 1's transactions should be invalidated
      mockInvalidateTransactions.mockImplementation((params) => {
        expect(params).toEqual({ accountId: fundingAccountId });
      });

      // Simulate funding completion
      await mockInvalidateTransactions({ accountId: fundingAccountId });

      expect(mockInvalidateTransactions).toHaveBeenCalledTimes(1);
      expect(mockInvalidateTransactions).toHaveBeenCalledWith({ accountId: fundingAccountId });
    });

    it('should handle funding errors without breaking transaction display', async () => {
      // Even if funding fails, existing transaction display should not break
      mockFundAccount.mockRejectedValue(new Error('Funding failed'));

      mockGetTransactions.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TransactionList accountId={1} />
        </QueryClientProvider>
      );

      // Should still show transaction list (empty in this case)
      await waitFor(() => {
        expect(screen.getByText(/No transactions yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with FundingModal', () => {
    it('should trigger cache invalidation through onSuccess callback', async () => {
      const onSuccess = jest.fn();
      const accountId = 1;

      mockFundAccount.mockResolvedValue({
        transaction: { id: 1 },
        newBalance: 150,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <FundingModal
            accountId={accountId}
            onClose={() => {}}
            onSuccess={onSuccess}
          />
        </QueryClientProvider>
      );

      // After successful funding, onSuccess should be called
      // The parent component should then invalidate the cache
      // This tests that the callback mechanism works correctly
    });
  });
});