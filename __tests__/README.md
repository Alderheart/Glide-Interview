# Testing Guide

This project uses **Vitest** for testing.

## ⚠️ IMPORTANT: PostCSS Workaround

Before running tests, the PostCSS config must be disabled:

```bash
# If postcss.config.mjs exists, rename it:
mv postcss.config.mjs postcss.config.mjs.disabled

# Now you can run tests
npm test
```

To run the dev server later, rename it back:
```bash
mv postcss.config.mjs.disabled postcss.config.mjs
npm run dev
```

See `.claude/context.md` for more details.

## Running Tests

### Run all tests in watch mode (recommended during development)
```bash
npm test
```

### Run all tests once (for CI/CD)
```bash
npm run test:run
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npx vitest run __tests__/validation/dateOfBirth.test.ts
```

### Run tests matching a pattern
```bash
npx vitest run -t "Future Date"
```

## Test Structure

```
__tests__/
├── validation/          # Backend validation tests (Zod schemas)
│   └── dateOfBirth.test.ts
├── components/          # Frontend component tests
│   └── signup.test.tsx
└── README.md           # This file
```

## Current Test Status

### VAL-202: Date of Birth Validation

**Status**: Tests created, implementation pending

**Test Files**:
- `__tests__/validation/dateOfBirth.test.ts` - Backend Zod schema validation tests
- `__tests__/components/signup.test.tsx` - Frontend form validation tests

**Expected Results**:
- ❌ **All tests will FAIL** until the validation is implemented
- This is intentional - we're using Test-Driven Development (TDD)

**To Fix**:
1. Update backend validation in `server/routers/auth.ts`
2. Update frontend validation in `app/signup/page.tsx`
3. Run tests again - they should pass!

## Test Coverage

Tests verify:
- ✅ Future dates are rejected
- ✅ Users must be at least 18 years old
- ✅ Dates older than 120 years are rejected
- ✅ Valid dates are accepted
- ✅ Invalid date formats are rejected
- ✅ Edge cases (leap years, etc.)

## Writing New Tests

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

## Debugging Tests

### View test output in detail
```bash
npm test -- --reporter=verbose
```

### Run tests in a specific file with detailed output
```bash
npx vitest run __tests__/validation/dateOfBirth.test.ts --reporter=verbose
```

### Debug a specific test
Add `.only` to run just one test:
```typescript
it.only('should do something', () => {
  // This is the only test that will run
});
```

## Useful Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:ui` | Run with UI dashboard |
| `npm run test:coverage` | Generate coverage report |
| `npx vitest --help` | See all available options |
