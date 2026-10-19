require('dotenv').config();

const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const bcrypt = require('bcryptjs');

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Admin = require('../src/modules/users/admin.model');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

const askHidden = async (question) => {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('This script must be run in an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
    };

    const onData = (chunk) => {
      const char = String(chunk);

      if (char === '\u0003') {
        cleanup();
        output.write('\n');
        reject(new Error('Cancelled.'));
        return;
      }

      if (char === '\r' || char === '\n') {
        cleanup();
        output.write('\n');
        resolve(value);
        return;
      }

      if (char === '\u0008' || char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      if (char >= ' ') {
        value += char;
      }
    };

    input.on('data', onData);
  });
};

const run = async () => {
  await connectDatabase();

  const rl = readline.createInterface({ input, output });
  let email = '';

  try {
    email = (await rl.question('Admin email: ')).trim().toLowerCase();
  } finally {
    rl.close();
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    throw new Error('An admin with this email already exists.');
  }

  const password = await askHidden('Admin password (input hidden): ');
  if (!password) {
    throw new Error('Password is required.');
  }
  if (password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }

  const confirm = await askHidden('Confirm password: ');
  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const admin = await Admin.create({ email, passwordHash, role: 'admin' });
    console.log(`Admin created: ${admin.email}`);
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('An admin with this email already exists.');
    }
    throw error;
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
