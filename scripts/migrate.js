#!/usr/bin/env node
/*
 * Applies db/schema.sql then db/seed.sql to the database in DATABASE_URL.
 * Usage: DATABASE_URL=postgres://... npm run db:migrate
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const dir = path.resolve(__dirname, "..", "db");
  for (const file of ["schema.sql", "seed.sql"]) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`Applying ${file}…`);
    await client.query(sql);
  }

  await client.end();
  console.log("✓ Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
