const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const importCsv = require('./seederCsv');

dotenv.config();

const destroyData = async () => {
  try {
    await connectDB();
    const result = await Product.deleteMany({});
    console.log(`🗑️  Menghapus ${result.deletedCount} product`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Gagal menghapus product: ${error.message}`);
    process.exit(1);
  }
};

const importData = async () => {
  try {
    await connectDB();
    const includeSingleVariant = !process.argv.includes('--only-multi-variant');
    const reset = !process.argv.includes('--keep-existing');
    const count = await importCsv({ reset, includeSingleVariant });
    console.log(`✅ Berhasil restore ${count} product dari CSV`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Gagal restore product: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv.includes('-d')) {
  destroyData();
} else {
  importData();
}
