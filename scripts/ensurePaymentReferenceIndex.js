const dotenv = require('dotenv');
const mongoose = require('mongoose');
const PaymentReceived = require('../models/PaymentReceived');

dotenv.config();

const INDEX_NAME = 'referenceNo_1_unique';

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI belum dikonfigurasi');
  }

  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

const findDuplicateReferenceNumbers = async () => {
  return PaymentReceived.aggregate([
    {
      $match: {
        referenceNo: {
          $type: 'string',
          $ne: '',
        },
      },
    },
    {
      $group: {
        _id: '$referenceNo',
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);
};

const ensureReferenceIndex = async () => {
  const indexes = await PaymentReceived.collection.indexes();
  const existingIndex = indexes.find((index) => index.name === INDEX_NAME);

  if (existingIndex) {
    console.log(`Index ${INDEX_NAME} sudah ada`);
    return;
  }

  await PaymentReceived.collection.createIndex(
    { referenceNo: 1 },
    {
      unique: true,
      name: INDEX_NAME,
      partialFilterExpression: {
        referenceNo: { $type: 'string', $gt: '' },
      },
    }
  );

  console.log(`Index ${INDEX_NAME} berhasil dibuat`);
};

const main = async () => {
  try {
    await connectDB();

    const duplicates = await findDuplicateReferenceNumbers();
    if (duplicates.length > 0) {
      console.error('Ditemukan duplicate referenceNo. Bersihkan data ini sebelum membuat unique index:');
      duplicates.forEach((entry) => {
        console.error(`- ${entry._id}: ${entry.count} dokumen (${entry.ids.join(', ')})`);
      });
      process.exitCode = 1;
      return;
    }

    console.log('Tidak ada duplicate referenceNo');
    await ensureReferenceIndex();
  } catch (error) {
    console.error(`Gagal memastikan unique index payment reference: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

main();
