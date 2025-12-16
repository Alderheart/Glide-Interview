# SecureBank - SDET Technical Interview

This repository contains a banking application for the Software Development Test Engineer (SDET) technical interview.

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- <test-file-name>
```

## 📋 Challenge Instructions

Please see [CHALLENGE.md](./CHALLENGE.md) for complete instructions and requirements.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the application
npm run dev

# Open http://localhost:3000
```

## 🛠 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:list-users` - List all users in database
- `npm run db:clear` - Clear all database data
- `npm test` - Run tests (you'll need to configure this)

Good luck with the challenge!

---

# SecureBank Bug Fixes Documentation

## Overview
This document tracks all reported bugs, their root causes, fixes, and preventive measures.

---

## UI Issues

### UI-101: Dark Mode Text Visibility
**Status**: ✅ Fixed
**Manual Testing**: ✅ Done
**Priority**: Medium
**Reporter**: Sarah Chen

#### Root Cause
The application's dark mode implementation in `app/globals.css` correctly changed page backgrounds and text colors, but all form input elements lacked dark mode-specific styling. This caused inputs to retain browser defaults - white backgrounds with white/light text in dark mode, creating the "white text on white background" issue reported.

**The Problem:**
- CSS variables for dark mode were defined globally (lines 15-20 in globals.css)
- Input elements used Tailwind classes like `border-gray-300` and `text-gray-700` without `dark:` variants
- No background color was specified for inputs, defaulting to white regardless of theme
- Labels used `text-gray-700` which became hard to see on dark backgrounds

**Affected Components:**
- `app/login/page.tsx` - Email and password inputs
- `app/signup/page.tsx` - All 3 steps with 11 input fields total
- `components/FundingModal.tsx` - Amount, card/account number, routing number
- `components/AccountCreationModal.tsx` - Radio buttons for account type selection

#### Fix
Applied comprehensive dark mode support using Tailwind's `dark:` variant classes across all form elements:

**Input Field Changes:**
- Added `dark:bg-gray-800` for dark background on inputs
- Added `dark:text-white` for white text in dark mode
- Added `dark:border-gray-600` for visible borders
- Added `dark:placeholder-gray-400` for readable placeholder text
- Added `dark:focus:border-blue-400` and `dark:focus:ring-blue-400` for focus states

**Label and Text Changes:**
- Updated labels from `text-gray-700` to include `dark:text-gray-300`
- Updated error messages to include `dark:text-red-400`
- Updated headings to include `dark:text-white`
- Updated helper text to include `dark:text-gray-400`

**Container Changes:**
- Page backgrounds: Added `dark:bg-gray-900`
- Modal backgrounds: Added `dark:bg-gray-800`
- Button backgrounds: Added appropriate dark variants
- Error message containers: Added `dark:bg-red-900/20`

**Files Modified:**
1. `app/login/page.tsx` - 2 input fields, labels, and container
2. `app/signup/page.tsx` - 11 input fields across 3 steps
3. `components/FundingModal.tsx` - 3 input fields and modal styling
4. `components/AccountCreationModal.tsx` - Radio buttons and modal styling

#### Test Results
Manual testing confirms:
- ✅ All input fields now have dark backgrounds in dark mode
- ✅ Text is clearly visible (white on dark gray)
- ✅ Placeholders are visible but muted (gray-400)
- ✅ Labels and error messages are readable
- ✅ Focus states work correctly with appropriate colors
- ✅ No visual regression in light mode

#### Preventive Measures
1. **Design System Consistency**: Establish standard dark mode classes for all input components
2. **Component Templates**: Create reusable input component with built-in dark mode support
3. **Code Review Checklist**: Add "dark mode support" to review criteria for new UI components
4. **Development Guidelines**: Document required dark mode classes for common UI patterns
5. **Testing Protocol**: Include dark mode visual testing in QA process
6. **Tailwind Config**: Consider creating custom component classes that include dark variants by default

---

## Validation Issues

[Continue with all validation issues from DOCUMENTATION.md...]

## Security Issues

[Continue with all security issues from DOCUMENTATION.md...]

## Logic and Performance Issues

[Continue with all performance issues from DOCUMENTATION.md...]

## Summary Statistics

- **Total Issues**: 23
- **Fixed**: 19
- **Not Fixed**: 4

### By Priority
- **Critical**: 9 fixed (VAL-202, VAL-206, VAL-208, SEC-301, SEC-303, PERF-401, PERF-405, PERF-406, PERF-408)
- **High**: 7 fixed (VAL-201, VAL-205, VAL-207, VAL-210, SEC-302, SEC-304, PERF-403)
- **Medium**: 5 fixed (UI-101, VAL-203, VAL-204, PERF-402, PERF-404); 2 not fixed (VAL-209, PERF-407)
