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

const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();

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

const extractWeightLabel = (rawName = '') => {
  const match = normalizeWhitespace(rawName).match(/(\d+(?:[.,]\d+)?)\s*(gr|kg)\b/i);
  if (!match) return '';

  return `${match[1].replace(/([.,]0+)$/, '')} ${match[2].toLowerCase()}`;
};

const extractFamilyName = (rawName = '', fallbackCategory = 'Produk') => {
  const normalizedName = normalizeWhitespace(rawName);
  const withoutWeight = normalizedName.replace(/(\d+(?:[.,]\d+)?)\s*(gr|kg)\b/ig, '');
  return normalizeWhitespace(withoutWeight) || fallbackCategory;
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
    const familyName = extractFamilyName(rawName, category);
    const productKey = [category, familyName].join('::').toLowerCase();
    const defaultValvePrice = /sachet|dripbag/i.test(jenis) ? 0 : 600;
    const variantSize = extractWeightLabel(rawName) || normalizeWhitespace(size) || 'Default';
    const variantColor = normalizeWhitespace(color) || 'Default';

    if (!productMap.has(productKey)) {
      productMap.set(productKey, {
        sku: sku || undefined,
        name: familyName,
        category,
        material,
        priceBase: b2bPrice || retailPrice,
        priceB2C: retailPrice || b2bPrice,
        priceB2B: b2bPrice || retailPrice,
        description: '',
        stockPolos: 0,
        minOrder: 100,
        addons: {
          valvePrice: defaultValvePrice
        },
        variants: [],
        _materials: new Set(material ? [material] : []),
        _thicknesses: new Set(thickness ? [normalizeWhitespace(thickness)] : [])
      });
      variantTracker.set(productKey, new Set());
    }

    const product = productMap.get(productKey);
    const productVariantKeys = variantTracker.get(productKey);
    const stock = 500 + (product.variants.length % 12) * 250;
    const variantSku = sku || buildSkuFallback(familyName, variantColor, variantSize, product.variants.length);
    const variant = {
      sku: variantSku,
      color: variantColor,
      size: variantSize,
      priceB2C: retailPrice || b2bPrice,
      priceB2B: b2bPrice || retailPrice,
      stock
    };
    const variantKey = [variant.sku, variant.color, variant.size].join('::').toLowerCase();

    if (productVariantKeys.has(variantKey)) continue;

    productVariantKeys.add(variantKey);
    product.variants.push(variant);
    product.stockPolos += stock;
    if (material) product._materials.add(material);
    if (thickness) product._thicknesses.add(normalizeWhitespace(thickness));

    if (!product.sku) {
      product.sku = variantSku;
    }
  }

  return Array.from(productMap.values()).map((product) => {
    const materials = Array.from(product._materials);
    const thicknesses = Array.from(product._thicknesses);
    const descriptionParts = [];

    if (product.variants.length > 0) {
      descriptionParts.push(`Varian ukuran: ${product.variants.map((variant) => variant.size).join(', ')}`);
    }
    if (materials.length > 0) {
      descriptionParts.push(`Material: ${materials.join(', ')}`);
    }
    if (thicknesses.length > 0) {
      descriptionParts.push(`Ketebalan: ${thicknesses.join(', ')}`);
    }

    return {
      sku: product.sku,
      name: product.name,
      category: product.category,
      material: materials.length === 1 ? materials[0] : 'Multi Material',
      priceBase: product.priceBase,
      priceB2C: product.priceB2C,
      priceB2B: product.priceB2B,
      description: descriptionParts.join('. '),
      stockPolos: product.stockPolos,
      minOrder: product.minOrder,
      addons: product.addons,
      variants: product.variants
    };
  });
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
