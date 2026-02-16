// Run once to create tables: node api/migrate.js
// Requires DATABASE_URL in environment.
const { neon } = require('@neondatabase/serverless');

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Running Spring Bank migrations...');

  await sql`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id          SERIAL PRIMARY KEY,
      first_name  TEXT        NOT NULL,
      last_name   TEXT        NOT NULL,
      email       TEXT        NOT NULL,
      phone       TEXT,
      subject     TEXT        NOT NULL,
      message     TEXT        NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ contact_submissions');

  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      id         SERIAL PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      source     TEXT        DEFAULT 'footer',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ subscribers');

  await sql`
    CREATE TABLE IF NOT EXISTS stats (
      id         SERIAL PRIMARY KEY,
      key        TEXT UNIQUE NOT NULL,
      label      TEXT        NOT NULL,
      value      TEXT        NOT NULL,
      icon       TEXT,
      sort_order INT         DEFAULT 0,
      active     BOOLEAN     DEFAULT TRUE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ stats');

  // Seed initial stats values
  await sql`
    INSERT INTO stats (key, label, value, icon, sort_order) VALUES
      ('customers',  'Customers Served', '5M+',   'customers', 1),
      ('locations',  'ATMs & Branches',  '4,800+','locations',  2),
      ('monthly_fee','Monthly Fee',      '$0',    'fee',        3),
      ('uptime',     'App Uptime',       '99.9%', 'uptime',     4)
    ON CONFLICT (key) DO NOTHING
  `;
  console.log('✓ stats seeded');

  await sql`
    CREATE TABLE IF NOT EXISTS auth_attempts (
      id         SERIAL PRIMARY KEY,
      username   TEXT,
      ip         TEXT,
      success    BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ auth_attempts');

  console.log('\nAll migrations complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
