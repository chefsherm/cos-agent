import { Pool } from "pg";

// Single shared pool across hot reloads / serverless invocations.
let pool = globalThis.__ccPool;

if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed Postgres (Neon / Vercel Postgres / Supabase) needs SSL.
    ssl:
      process.env.DATABASE_SSL === "disable"
        ? false
        : { rejectUnauthorized: false },
    max: 5,
  });
  globalThis.__ccPool = pool;
}

export function query(text, params) {
  return pool.query(text, params);
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
