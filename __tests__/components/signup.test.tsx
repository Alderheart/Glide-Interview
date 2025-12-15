import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupPage from '@/app/signup/page';

/**
 * VAL-202: Frontend Date of Birth Validation Tests
 *
 * These tests verify that the signup form properly validates date of birth on the frontend.
 * Tests will FAIL until validation is implemented in app/signup/page.tsx
 */

// Mock the tRPC client
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    auth: {
      signup: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('VAL-202: Signup Form - Date of Birth Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillStep1 = async (user: ReturnType<typeof userEvent.setup>) => {
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'Password123');

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);
  };

  const fillStep2Names = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const phoneInput = screen.getByLabelText(/phone number/i);

    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    await user.type(phoneInput, '1234567890');
  };

  describe('Future Date Validation', () => {
    it('should show error when future date is entered', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, '2025-12-15');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot be in the future/i)).toBeInTheDocument();
      });
    });

    it('should show error when today is entered as birth date', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      const today = new Date().toISOString().split('T')[0];
      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, today);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/must be at least 18 years old/i)).toBeInTheDocument();
      });
    });
  });

  describe('Minimum Age Validation', () => {
    it('should show error when user is under 18', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      // Date 17 years ago
      const date17YearsAgo = new Date();
      date17YearsAgo.setFullYear(date17YearsAgo.getFullYear() - 17);
      const dateString = date17YearsAgo.toISOString().split('T')[0];

      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, dateString);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/must be at least 18 years old/i)).toBeInTheDocument();
      });
    });

    it('should allow proceeding when user is exactly 18', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      // Date exactly 18 years ago
      const date18YearsAgo = new Date();
      date18YearsAgo.setFullYear(date18YearsAgo.getFullYear() - 18);
      const dateString = date18YearsAgo.toISOString().split('T')[0];

      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, dateString);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
      });
    });
  });

  describe('Maximum Age Validation', () => {
    it('should show error when date is more than 120 years ago', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, '1800-01-01');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/valid date of birth/i)).toBeInTheDocument();
      });
    });
  });

  describe('Valid Date Scenarios', () => {
    it('should allow proceeding with valid birth date (25 years old)', async () => {
      const user = userEvent.setup();
      render(<SignupPage />);

      await fillStep1(user);
      await fillStep2Names(user);

      const date25YearsAgo = new Date();
      date25YearsAgo.setFullYear(date25YearsAgo.getFullYear() - 25);
      const dateString = date25YearsAgo.toISOString().split('T')[0];

      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.type(dobInput, dateString);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
      });
    });
  });
});
