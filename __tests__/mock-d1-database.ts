/**
 * Pure in-memory mock implementation of D1Database
 * No native dependencies required - uses JavaScript Maps/Objects
 */

import type { D1Database, D1PreparedStatement, D1Result } from '../lib/db';

interface Row {
  [key: string]: unknown;
}

interface Table {
  name: string;
  rows: Map<string, Row>; // Keyed by primary key (id column)
  indexes: Map<string, Map<string, Set<string>>>; // indexName -> value -> set of primary keys
}

export class MockD1Database implements D1Database {
  private tables: Map<string, Table> = new Map();
  private schema: Map<string, { primaryKey: string; indexes: string[] }> = new Map();

  constructor() {
    this.initializeSchema();
  }

  private initializeSchema() {
    // Users table schema
    this.schema.set('users', {
      primaryKey: 'id',
      indexes: ['email_normalized'],
    });

    // Alerts table schema
    this.schema.set('alerts', {
      primaryKey: 'id',
      indexes: ['user_id', 'symbol', 'status', 'earnings_date'],
    });

    // Watchlists table schema
    this.schema.set('watchlists', {
      primaryKey: 'user_id',
      indexes: [],
    });

    // Initialize tables
    for (const [tableName] of this.schema) {
      this.tables.set(tableName, {
        name: tableName,
        rows: new Map(),
        indexes: new Map(),
      });
    }
  }

  prepare(query: string): D1PreparedStatement {
    const normalizedQuery = query.trim().toUpperCase();
    const queryStr = query; // Capture query string
    
    const createBoundStatement = (executeFn: (values: unknown[]) => Promise<D1Result>, isSelect = false) => {
      // Each statement gets its own closure for bound values
      // This must be inside createBoundStatement so each call gets its own
      let statementValues: unknown[] = [];
      
      const statement: D1PreparedStatement = {
        bind: (...values: unknown[]) => {
          // Clear and repopulate the array to ensure closure sees updates
          statementValues.length = 0;
          statementValues.push(...values);
          return statement;
        },
        first: async <T = unknown>(): Promise<T | null> => {
          if (isSelect) {
            const results = await this.executeSelect(queryStr, statementValues);
            return (results[0] as T) || null;
          }
          const result = await executeFn(statementValues);
          return null;
        },
        run: async (): Promise<D1Result> => {
          if (isSelect) {
            const results = await this.executeSelect(queryStr, statementValues);
            return {
              success: true,
              meta: {
                duration: 0,
                rows_read: results.length,
                rows_written: 0,
                last_row_id: 0,
                changed_db: false,
                changes: 0,
              },
            };
          }
          const result = await executeFn(statementValues);
          return result;
        },
        all: async <T = unknown>(): Promise<D1Result<T>> => {
          if (isSelect) {
            const results = await this.executeSelect(queryStr, statementValues);
            return {
              success: true,
              meta: {
                duration: 0,
                rows_read: results.length,
                rows_written: 0,
                last_row_id: 0,
                changed_db: false,
                changes: 0,
              },
              results: results as T[],
            };
          }
          const result = await executeFn(statementValues);
          return {
            ...result,
            results: [],
          } as D1Result<T>;
        },
      };
      return statement;
    };
    
    if (normalizedQuery.startsWith('SELECT')) {
      return createBoundStatement(async (values) => {
        const results = await this.executeSelect(queryStr, values);
        return {
          success: true,
          meta: {
            duration: 0,
            rows_read: results.length,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0,
          },
        };
      }, true);
    } else if (normalizedQuery.startsWith('INSERT')) {
      return createBoundStatement(async (values) => await this.executeInsert(queryStr, values));
    } else if (normalizedQuery.startsWith('UPDATE')) {
      return createBoundStatement(async (values) => await this.executeUpdate(queryStr, values));
    } else if (normalizedQuery.startsWith('DELETE')) {
      return createBoundStatement(async (values) => await this.executeDelete(queryStr, values));
    }

    // Fallback for other queries
    return createBoundStatement(async () => ({
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    }));
  }

  exec(query: string) {
    // For exec, we just parse and execute
    const statements = query.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        this.prepare(stmt).run();
      }
    }
    return {
      count: statements.length,
      duration: 0,
    };
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map(stmt => stmt.run() as Promise<D1Result<T>>));
  }


  private async executeSelect(query: string, values: unknown[]): Promise<Row[]> {
    // Parse SELECT query
    const match = query.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY.*)?$/i);
    if (!match) {
      return [];
    }

    const [, columns, tableName, whereClause] = match;
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) {
      return [];
    }

    let results: Row[] = Array.from(table.rows.values());

    // Apply WHERE clause
    if (whereClause && values.length > 0) {
      const whereParts = whereClause.split(/\s+(AND|OR)\s+/i);
      const conditions: Array<{ column: string; operator: string; value: unknown }> = [];
      
      let valueIndex = 0;
      for (let i = 0; i < whereParts.length; i += 2) {
        const condition = whereParts[i].trim();
        const match = condition.match(/(\w+)\s*=\s*\?/);
        if (match && valueIndex < values.length) {
          conditions.push({
            column: match[1],
            operator: '=',
            value: values[valueIndex++],
          });
        }
      }

      results = results.filter(row => {
        return conditions.every(cond => {
          const rowValue = row[cond.column];
          if (cond.operator === '=') {
            return rowValue === cond.value;
          }
          return true;
        });
      });
    }

    // Handle SELECT *
    if (columns.trim() === '*') {
      return results;
    }

    // Handle specific columns (simplified - just return all for now)
    return results;
  }

  private async executeInsert(query: string, values: unknown[]): Promise<D1Result> {
    // Parse INSERT query - handle multiple spaces and newlines
    // Normalize whitespace but preserve structure
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    
    // Match INSERT INTO table (columns) VALUES (placeholders)
    // The VALUES clause may have ? placeholders, but values come from bind()
    // Updated regex to handle multi-line queries better
    const match = normalizedQuery.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (!match) {
      // Debug: log failed regex match
      if (process.env.NODE_ENV === 'test') {
        console.log('[MockDB] INSERT regex failed. Query:', normalizedQuery);
      }
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const [, tableName, columnsStr] = match;
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) {
      if (process.env.NODE_ENV === 'test') {
        console.log('[MockDB] Table not found:', tableName.toLowerCase(), 'Available tables:', Array.from(this.tables.keys()));
      }
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const columns = columnsStr.split(',').map(c => c.trim());
    const row: Row = {};
    
    // Map values to columns - must have exact match
    if (values.length !== columns.length) {
      if (process.env.NODE_ENV === 'test') {
        console.log('[MockDB] Value count mismatch. Expected:', columns.length, 'Got:', values.length, 'Columns:', columns, 'Values:', values);
      }
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }
    
    for (let i = 0; i < columns.length; i++) {
      const columnName = columns[i];
      row[columnName] = values[i];
    }

    const schema = this.schema.get(tableName.toLowerCase());
    if (!schema) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const primaryKey = row[schema.primaryKey] as string;
    if (!primaryKey) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    // Check for duplicates (primary key constraint)
    if (table.rows.has(primaryKey)) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    // Check unique constraints (email, email_normalized)
    if (tableName.toLowerCase() === 'users') {
      const email = row['email'] as string;
      const emailNormalized = row['email_normalized'] as string;
      
      for (const existingRow of table.rows.values()) {
        if (existingRow['email'] === email || existingRow['email_normalized'] === emailNormalized) {
          return {
            success: false,
            meta: {
              duration: 0,
              rows_read: 0,
              rows_written: 0,
              last_row_id: 0,
              changed_db: false,
              changes: 0,
            },
          };
        }
      }
    }

    table.rows.set(primaryKey, row);
    this.updateIndexes(table, row, schema);

    return {
      success: true,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: 0,
        changed_db: true,
        changes: 1,
      },
    };
  }

  private async executeUpdate(query: string, values: unknown[]): Promise<D1Result> {
    // Parse UPDATE query
    const match = query.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (!match) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const [, tableName, setClause, whereClause] = match;
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    // Parse SET clause
    const setParts = setClause.split(',').map(p => p.trim());
    const updates: Array<{ column: string; value: unknown }> = [];
    let valueIndex = 0;

    for (const part of setParts) {
      const match = part.match(/(\w+)\s*=\s*\?/);
      if (match && valueIndex < values.length) {
        updates.push({
          column: match[1],
          value: values[valueIndex++],
        });
      }
    }

    // Parse WHERE clause
    const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/);
    if (!whereMatch || valueIndex >= values.length) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const whereColumn = whereMatch[1];
    const whereValue = values[valueIndex];

    let changes = 0;
    for (const [key, row] of table.rows.entries()) {
      if (row[whereColumn] === whereValue) {
        // Apply updates
        for (const update of updates) {
          row[update.column] = update.value;
        }
        changes++;
      }
    }

    return {
      success: changes > 0,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: changes,
        last_row_id: 0,
        changed_db: changes > 0,
        changes,
      },
    };
  }

  private async executeDelete(query: string, values: unknown[]): Promise<D1Result> {
    // Parse DELETE query
    const match = query.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    if (!match) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const [, tableName, whereClause] = match;
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    if (!whereClause || values.length === 0) {
      // Delete all (cascade handled by caller)
      const count = table.rows.size;
      table.rows.clear();
      return {
        success: true,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: count,
          last_row_id: 0,
          changed_db: count > 0,
          changes: count,
        },
      };
    }

    // Parse WHERE clause
    const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/);
    if (!whereMatch) {
      return {
        success: false,
        meta: {
          duration: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
      };
    }

    const whereColumn = whereMatch[1];
    const whereValue = values[0];

    // Handle cascade delete for alerts
    if (tableName.toLowerCase() === 'users') {
      const alertsTable = this.tables.get('alerts');
      if (alertsTable) {
        for (const [alertKey, alertRow] of alertsTable.rows.entries()) {
          if (alertRow['user_id'] === whereValue) {
            alertsTable.rows.delete(alertKey);
          }
        }
      }
      const watchlistsTable = this.tables.get('watchlists');
      if (watchlistsTable) {
        watchlistsTable.rows.delete(whereValue as string);
      }
    }

    const keysToDelete: string[] = [];
    for (const [key, row] of table.rows.entries()) {
      if (row[whereColumn] === whereValue) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      table.rows.delete(key);
    }

    return {
      success: keysToDelete.length > 0,
      meta: {
        duration: 0,
        rows_read: 0,
        rows_written: keysToDelete.length,
        last_row_id: 0,
        changed_db: keysToDelete.length > 0,
        changes: keysToDelete.length,
      },
    };
  }

  private updateIndexes(table: Table, row: Row, schema: { primaryKey: string; indexes: string[] }) {
    for (const indexColumn of schema.indexes) {
      const indexValue = row[indexColumn] as string;
      if (indexValue !== undefined) {
        if (!table.indexes.has(indexColumn)) {
          table.indexes.set(indexColumn, new Map());
        }
        const index = table.indexes.get(indexColumn)!;
        if (!index.has(indexValue)) {
          index.set(indexValue, new Set());
        }
        index.get(indexValue)!.add(row[schema.primaryKey] as string);
      }
    }
  }

  // Helper method to clear all data (useful for tests)
  clear() {
    for (const table of this.tables.values()) {
      table.rows.clear();
      table.indexes.clear();
    }
  }
}

