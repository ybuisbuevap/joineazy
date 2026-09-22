const { Pool, types } = require('pg');

// Timestamps are stored as UTC clock values (TIMESTAMP without time zone).
// Parse them as UTC so due dates and acknowledgment times are the same instant on any server.
types.setTypeParser(1114, (value) => new Date(`${value.replace(' ', 'T')}Z`));

// Hosted Postgres (Neon, Render, Railway) gives one DATABASE_URL and needs SSL.
// Locally and in Docker Compose we fall back to the separate DB_* variables.
const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'joineazy',
    };

const pool = new Pool(config);

module.exports = pool;
