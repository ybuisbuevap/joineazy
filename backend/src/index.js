require('dotenv').config();
const express = require('express');
const cors = require('cors');

const migrate = require('./db/migrate');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const groupRoutes = require('./routes/groups');
const assignmentRoutes = require('./routes/assignments');
const submissionRoutes = require('./routes/submissions');

const app = express();

// CORS_ORIGIN can be a comma separated list of allowed frontend URLs. Open by default for local use.
const origins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true;
app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/groups', groupRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/submissions', submissionRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Catches errors thrown outside a route's own try/catch, such as malformed JSON bodies.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;

// Apply the schema on every start so a fresh hosted database works with no manual step.
migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to apply schema, not starting:', err);
    process.exit(1);
  });

module.exports = app;
