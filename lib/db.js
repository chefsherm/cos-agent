// Postgres adapter for the AI CEO Action Ledger. Connect as the ceo_agent role
// (INSERT and SELECT only). Unset means no ledger, and external actions fail closed.
import pg from "pg";

let pool;

export function getLedgerDb() {
  const url = process.env.CEO_LEDGER_DATABASE_URL;
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 3 });
  return {
    query: (text, params) => pool.query(text, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({ query: (text, params) => client.query(text, params) });
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
