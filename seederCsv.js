const fs = require('fs');
const readline = require('readline');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Product = require('./models/Product');

dotenv.config();

const parseIndoNumber = (value) => {
  if (!value) return 0;
  return parseInt(String(value).replace(/\./g, ''), 10) || 0;
};

const normalizeCategory = (jenis = '', rawName = '') => {
  let category = jenis.trim();

  if (/rice papper/i.test(category) && !/square/i.test(category)) {
    category = 'Flatbottom Rice Papper';
  }

  if (/gusset/i.test(category)) {
    if (/quad/i.test(rawName)) category = 'Gusset Quad Seal';
    if (/centre seal|side seal/i.test(rawName)) category = 'Gusset Side Seal';
  }

  const allowedCategories = new Set([
    'Standing Pouch',
    'Gusset Side Seal',
    'Gusset Quad Seal',
    'Gusset',
    'Flat Bottom',
    'Flatbottom Square',
    'Flatbottom Rice Papper',
    'Flatbottom Rice Papper Square',
    'Sachet',
    'Dripbag',
    'Vacuum Pack',
    'Roll',
    'Lain Lain'
  ]);

  return allowedCategories.has(category) ? category : 'Lain Lain';
};

const buildProductsFromCsv = async () => {
  const filePath = path.join(__dirname, 'data', 'Price List Product UKM Kemasan Juli.csv');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File CSV tidak ditemukan di ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  const products = [];
  const seenNames = new Set();

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const cols = line.split(';');
    if (cols.length < 10) continue;

    const jenis = cols[2]?.trim();
    if (!jenis) continue;

    const sku = cols[1]?.trim() || '';
    const material = cols[3]?.trim() || '-';
    const rawName = cols[4]?.trim() || 'Tanpa Nama';
    const thickness = cols[5]?.trim() || '';
    const size = cols[6]?.trim() || '';
    const color = cols[7]?.trim() || '';
    const retailPrice = parseIndoNumber(cols[8]?.trim());
    const b2bPrice = parseIndoNumber(cols[9]?.trim());

    const baseName = [rawName, color].filter(Boolean).join(' - ');
    const finalName = [baseName || rawName, sku ? `(${sku})` : ''].join(' ').trim();
    if (!finalName || seenNames.has(finalName)) continue;
    seenNames.add(finalName);

    const descriptionParts = [];
    if (size) descriptionParts.push(`Ukuran: ${size}`);
    if (thickness) descriptionParts.push(`Ketebalan: ${thickness}`);
    if (color) descriptionParts.push(`Warna: ${color}`);

    products.push({
      sku: sku || undefined,
      name: finalName,
      category: normalizeCategory(jenis, rawName),
      material,
      priceBase: b2bPrice || retailPrice,
      priceB2C: retailPrice || b2bPrice,
      priceB2B: b2bPrice || retailPrice,
      description: descriptionParts.join('. '),
      stockPolos: 500 + (products.length % 12) * 250,
      minOrder: 100,
      addons: {
        valvePrice: /sachet|dripbag/i.test(jenis) ? 0 : 600
      }
    });
  }

  return products;
};

const importCsv = async ({ reset = true } = {}) => {
  const products = await buildProductsFromCsv();

  if (reset) {
    await Product.deleteMany({});
  }

  if (products.length > 0) {
    await Product.insertMany(products, { ordered: false });
  }

  return products.length;
};

const run = async () => {
  try {
    await connectDB();
    const count = await importCsv({ reset: true });
    console.log(`✅ Berhasil import ${count} produk dari CSV`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Gagal import CSV: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  run();
}

module.exports = importCsv;
