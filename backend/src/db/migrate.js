require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

// Applies schema.sql. The file is idempotent, so this is safe to run on every start.
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Schema applied');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrate;
