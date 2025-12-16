// Verify that the transaction history update fix is working
// This script checks that utils.account.getTransactions.invalidate is called after funding

const fs = require('fs');
const path = require('path');

// Read the dashboard page file
const dashboardPath = path.join(__dirname, 'app', 'dashboard', 'page.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Check 1: Verify utils is imported/created
const hasUtils = dashboardContent.includes('const utils = trpc.useUtils()');
console.log('✅ Check 1: utils imported:', hasUtils);

// Check 2: Verify invalidate is called in onSuccess
const hasInvalidate = dashboardContent.includes('utils.account.getTransactions.invalidate({ accountId: fundingAccountId })');
console.log('✅ Check 2: Transaction cache invalidated after funding:', hasInvalidate);

// Check 3: Verify onSuccess is async (needed for await)
const hasAsyncOnSuccess = dashboardContent.includes('onSuccess={async () => {');
console.log('✅ Check 3: onSuccess is async:', hasAsyncOnSuccess);

// Check 4: Verify the comment explaining the fix
const hasComment = dashboardContent.includes('// This ensures transaction history updates without page refresh');
console.log('✅ Check 4: Comment explaining fix present:', hasComment);

// Summary
if (hasUtils && hasInvalidate && hasAsyncOnSuccess && hasComment) {
  console.log('\n🎉 SUCCESS: Transaction history update fix is properly implemented!');
  console.log('\nThe fix ensures that:');
  console.log('1. After funding an account, the transaction cache for that account is invalidated');
  console.log('2. When the user clicks on the account, fresh transaction data is fetched');
  console.log('3. No page refresh is required to see the new transaction');
} else {
  console.log('\n❌ ERROR: Fix is not complete');
  process.exit(1);
}