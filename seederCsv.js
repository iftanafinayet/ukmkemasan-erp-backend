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

const buildSkuFallback = (rawName = 'product', color = 'default', size = 'default', index = 0) => {
  const base = [rawName, color, size]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'product'}-${String(index + 1).padStart(2, '0')}`;
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
  const productMap = new Map();
  const variantTracker = new Map();

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

    const category = normalizeCategory(jenis, rawName);
    const productKey = [category, material, rawName, thickness].join('::').toLowerCase();
    const displayName = [rawName || 'Tanpa Nama', material, thickness].filter(Boolean).join(' - ');
    const defaultValvePrice = /sachet|dripbag/i.test(jenis) ? 0 : 600;

    if (!productMap.has(productKey)) {
      const descriptionParts = [];
      if (thickness) descriptionParts.push(`Ketebalan: ${thickness}`);

      productMap.set(productKey, {
        sku: sku || undefined,
        name: displayName,
        category,
        material,
        priceBase: b2bPrice || retailPrice,
        priceB2C: retailPrice || b2bPrice,
        priceB2B: b2bPrice || retailPrice,
        description: descriptionParts.join('. '),
        stockPolos: 0,
        minOrder: 100,
        addons: {
          valvePrice: defaultValvePrice
        },
        variants: []
      });
      variantTracker.set(productKey, new Set());
    }

    const product = productMap.get(productKey);
    const productVariantKeys = variantTracker.get(productKey);
    const stock = 500 + (product.variants.length % 12) * 250;
    const variantSku = sku || buildSkuFallback(rawName, color, size, product.variants.length);
    const variant = {
      sku: variantSku,
      color: color || 'Default',
      size: size || 'Default',
      priceB2C: retailPrice || b2bPrice,
      priceB2B: b2bPrice || retailPrice,
      stock
    };
    const variantKey = [variant.sku, variant.color, variant.size].join('::').toLowerCase();

    if (productVariantKeys.has(variantKey)) continue;

    productVariantKeys.add(variantKey);
    product.variants.push(variant);
    product.stockPolos += stock;

    if (!product.sku) {
      product.sku = variantSku;
    }
  }

  return Array.from(productMap.values());
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
