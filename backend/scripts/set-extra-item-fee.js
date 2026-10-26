'use strict';

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const DeliverySettings = require('../src/modules/delivery/delivery.settings.model');

const FEE = 250;

const run = async () => {
  await connectDatabase();
  const updated = await DeliverySettings.findOneAndUpdate(
    { key: 'delivery' },
    { $set: { extraItemFee: FEE } },
    { new: true }
  );
  if (!updated) {
    console.log('No saved delivery settings yet; the new default of 250 DA will apply.');
  } else {
    console.log('Extra-item delivery fee updated to 250 DA.');
  }
  await disconnectDatabase();
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
