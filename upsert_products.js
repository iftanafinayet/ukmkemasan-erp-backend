const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./models/Product');

dotenv.config();

const filePath = path.join(__dirname, 'data', 'ukm_kemasan_clean_export.csv');

const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const parsePrice = (valStr) => {
    if (!valStr) return 0;
    let val = parseFloat(valStr);
    if (valStr.includes('.') && val < 100) {
        return Math.round(val * 1000);
    }
    return Math.round(val);
};

async function upsertProducts() {
    try {
        await connectDB();
        console.log('Connected to database...');

        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        const rows = lines.slice(1);

        const productGroups = {};

        rows.forEach(line => {
            if (!line.trim()) return;

            const parts = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') inQuotes = !inQuotes;
                else if (line[i] === ',' && !inQuotes) {
                    parts.push(current);
                    current = '';
                } else {
                    current += line[i];
                }
            }
            parts.push(current);

            if (parts.length < 12) return;

            const sku = parts[0] || '';
            let rawName = (parts[1] || '').trim();
            const category = (parts[2] || '').trim();
            const description = (parts[3] || '').trim();
            const material = (parts[4] || '').trim();
            const size = (parts[6] || '').trim();
            const capacity = (parts[7] || '').trim();
            const unit = (parts[8] || '').trim();
            const color = (parts[9] || '').trim();
            const retailPrice = parsePrice(parts[10]);
            const b2bPrice = parsePrice(parts[11]);
            const moq = parseInt(parts[12]) || 100;

            // Pastikan nama produk menyertakan ukuran jika belum ada
            let sizeLabel = '';
            if (capacity && unit) {
                const cleanCapacity = capacity.replace(/\.0+$/, '');
                sizeLabel = `${cleanCapacity} ${unit}`;
            }

            let productDisplayName = rawName;
            // Jika nama belum mengandung ukuran (misal: "Standing Pouch Liquid"), tambahkan ukurannya
            if (sizeLabel && !productDisplayName.toLowerCase().includes(sizeLabel.toLowerCase())) {
                productDisplayName = `${productDisplayName} ${sizeLabel}`;
            }

            if (!productGroups[productDisplayName]) {
                productGroups[productDisplayName] = {
                    name: productDisplayName,
                    category: category,
                    description: description,
                    material: material,
                    minOrder: moq,
                    variants: []
                };
            }

            productGroups[productDisplayName].variants.push({
                sku: sku || `SKU-${Math.random().toString(36).substr(2, 9)}`,
                color: color || 'Default',
                size: size || sizeLabel || 'Default',
                priceB2C: retailPrice,
                priceB2B: b2bPrice,
                stock: 1000
            });
        });

        const products = Object.values(productGroups);
        console.log(`Parsed ${products.length} products (separated by size) from CSV.`);

        let updatedCount = 0;
        let createdCount = 0;

        for (const productData of products) {
            try {
                const existingProduct = await Product.findOne({ name: productData.name });

                if (existingProduct) {
                    existingProduct.category = productData.category;
                    existingProduct.description = productData.description;
                    existingProduct.material = productData.material;
                    existingProduct.minOrder = productData.minOrder;
                    existingProduct.variants = productData.variants;
                    await existingProduct.save();
                    updatedCount++;
                } else {
                    await Product.create(productData);
                    createdCount++;
                }
            } catch (err) {
                console.error(`Error processing product ${productData.name}:`, err.message);
            }
        }

        console.log(`✅ Upsert finished.`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Created: ${createdCount}`);
        process.exit(0);

    } catch (err) {
        console.error('❌ Error during upsert:', err);
        process.exit(1);
    }
}

upsertProducts();
