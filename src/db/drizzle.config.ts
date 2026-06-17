import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  console.warn("SQL_HOST must be set in environment variables for drizzle-kit.");
}
if (!sqlDbName) {
  console.warn("SQL_DB_NAME must be set in environment variables for drizzle-kit.");
}
if (!user) {
  console.warn("SQL_ADMIN_USER must be set in environment variables for drizzle-kit.");
}
if (!password) {
  console.warn("SQL_ADMIN_PASSWORD must be set in environment variables for drizzle-kit.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: sqlHost || 'localhost',
    user: user || 'admin',
    password: password || 'admin_pass',
    database: sqlDbName || 'coop_db',
    ssl: false,
  },
  verbose: true,
});
