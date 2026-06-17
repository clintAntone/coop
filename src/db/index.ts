import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Function to create a new connection pool using the safe Object Method
export const createPool = () => {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host || !user || !password || !database) {
    console.warn("SQL Server connection credentials are not fully set in the environment variables!");
  }

  return new Pool({
    host: host,
    user: user,
    password: password,
    database: database,
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });
};

// Create the pool instance
const pool = createPool();

// Prevent unhandled pool-level errors from breaking the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and explicit schema
export const db = drizzle(pool, { schema });
