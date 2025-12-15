#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n🔐 Encryption Key Generator for SecureBank\n');

// Generate a secure 32-byte key
const key = crypto.randomBytes(32).toString('hex');

console.log('Generated encryption key (256-bit AES):\n');
console.log(`ENCRYPTION_KEY=${key}\n`);

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

if (envExists) {
  // Read existing .env.local
  const envContent = fs.readFileSync(envPath, 'utf8');

  if (envContent.includes('ENCRYPTION_KEY=')) {
    console.log('⚠️  WARNING: .env.local already contains an ENCRYPTION_KEY');
    console.log('   To update it, replace the existing key with the one above.\n');
  } else {
    console.log('To add this to your .env.local file, you can:');
    console.log(`1. Run: echo "ENCRYPTION_KEY=${key}" >> .env.local`);
    console.log('2. Or manually copy and paste the line above into .env.local\n');
  }
} else {
  console.log('Creating .env.local file with encryption key...');
  fs.writeFileSync(envPath, `# Encryption key for SSN storage (DO NOT COMMIT)\nENCRYPTION_KEY=${key}\n`);
  console.log('✅ Created .env.local with encryption key\n');
}

console.log('📝 Important notes:');
console.log('   - Keep this key secret and secure');
console.log('   - Never commit .env.local to version control');
console.log('   - Use different keys for development and production');
console.log('   - Back up production keys securely\n');