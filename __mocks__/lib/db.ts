/**
 * Manual mock for lib/db module
 * This ensures createDB() returns the mock database instance
 */

import { MockD1Database } from '../../__tests__/mock-d1-database';

// Create a shared mock database instance
let mockDbInstance: MockD1Database | null = null;

export function createDB() {
  if (!mockDbInstance) {
    mockDbInstance = new MockD1Database();
  }
  return mockDbInstance;
}

// Export types
export type { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '../../lib/db';

// Helper to reset the mock database (useful for tests)
export function resetMockDB() {
  if (mockDbInstance) {
    mockDbInstance.clear();
  } else {
    mockDbInstance = new MockD1Database();
  }
}

// Helper to get the current mock instance (useful for tests)
export function getMockDB(): MockD1Database {
  if (!mockDbInstance) {
    mockDbInstance = new MockD1Database();
  }
  return mockDbInstance;
}

