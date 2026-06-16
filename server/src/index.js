const express = require('express');
const cors = require('cors');
const instructionsRouter = require('./routes/instructions');
const validateRouter = require('./routes/validate');
const logsRouter = require('./routes/logs');
const authConfigRouter = require('./routes/authConfig');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/instructions', instructionsRouter);
app.use('/api/validate', validateRouter);
app.use('/api/logs', logsRouter);
app.use('/api/auth-config', authConfigRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
