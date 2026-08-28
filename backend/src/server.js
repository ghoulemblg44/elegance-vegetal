require('dotenv').config();

const express = require('express');
const cors = require('cors');

const config = require('./config');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);

app.listen(config.port, () => {
  console.log(`Élégance Végétal API running on http://localhost:${config.port}`);
});
