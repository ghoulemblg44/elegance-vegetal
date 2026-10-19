'use strict';

const mongoose = require('mongoose');

const config = require('./index');

/** Reuse one connection across Vercel serverless invocations. */
let cached = global.__eleganceMongo;
if (!cached) {
  cached = global.__eleganceMongo = { conn: null, promise: null };
}

const connectDatabase = async () => {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is missing. Set it in backend/.env (local) or Vercel env vars (production).');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(config.mongoUri).then((connection) => {
      console.log('MongoDB connected');
      return connection;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('MongoDB disconnected');
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
