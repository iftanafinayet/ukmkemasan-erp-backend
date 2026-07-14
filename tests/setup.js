const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

module.exports = {
  setup: async () => {
    mongod = await MongoMemoryServer.create({
      instance: {
        binary: {
          version: '4.4.6',
        },
      },
    });
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  },
  tearDown: async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  },
};
