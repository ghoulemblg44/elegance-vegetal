'use strict';

require('dotenv').config();

const config = require('./config');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const tariffStore = require('./modules/delivery/delivery.tariff-store');
const app = require('./app');

const start = async () => {
  try {
    await connectDatabase();
    await tariffStore.ensureSeeded();
  } catch (error) {
    console.error('MongoDB connection failed.');
    console.error(error.message);
    process.exit(1);
  }

  if (!config.jwtSecret) {
    console.warn('JWT_SECRET is missing. Set it in backend/.env before using /api/auth.');
  }

  const server = app.listen(config.port, () => {
    console.log(`Élégance Végétal API running on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down…`);
    server.close(async () => {
      try {
        await disconnectDatabase();
      } catch (error) {
        console.error('Error while closing MongoDB.');
        console.error(error.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
};

start();
