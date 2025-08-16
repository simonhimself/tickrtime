#!/usr/bin/env node

/**
 * Script to replace console.log statements with logger calls
 * Run with: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/api/auth/login/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/auth/verify-email/route.ts',
  'app/api/earnings-next-30-days/route.ts',
  'app/api/earnings-previous-30-days/route.ts',
  'app/api/earnings-today/route.ts',
  'app/api/earnings-tomorrow/route.ts',
  'components/earnings-dashboard.tsx',
  'lib/email.ts',
  'lib/kv-dev-edge.ts',
  'lib/kv-dev.ts',
  'lib/kv-factory.ts',
];

function updateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if logger is already imported
  const hasLoggerImport = content.includes("import { logger }");
  
  // Add logger import if not present (for .ts files)
  if (!hasLoggerImport && filePath.endsWith('.ts')) {
    // Find the last import statement
    const importMatch = content.match(/(import[\s\S]*?from\s+['"][^'"]+['"];?\n)(?!import)/);
    if (importMatch) {
      const lastImport = importMatch[0];
      content = content.replace(lastImport, lastImport + "import { logger } from '@/lib/logger';\n");
    }
  }
  
  // Replace console statements
  content = content.replace(/console\.log\(/g, 'logger.debug(');
  content = content.replace(/console\.info\(/g, 'logger.info(');
  content = content.replace(/console\.warn\(/g, 'logger.warn(');
  content = content.replace(/console\.error\(/g, 'logger.error(');
  
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Updated ${filePath}`);
}

// Process all files
filesToUpdate.forEach(file => {
  try {
    updateFile(file);
  } catch (error) {
    console.error(`❌ Failed to update ${file}:`, error.message);
  }
});

console.log('\n✨ All files updated! Run "npm run lint" to verify.');