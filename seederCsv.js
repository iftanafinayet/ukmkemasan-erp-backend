const fs = require('fs');
const readline = require('readline');
const path = require('path');
const Product = require('./models/Product');

const parseIndoNumber = (str) => {
    if (!str) return 0;
    const clean = str.replace(/\./g, '');
    return parseInt(clean, 10) || 0;
};

const importCsv = async () => {
    const filePath = path.join(__dirname, 'data', 'Price List Product UKM Kemasan Juli.csv');
    if (!fs.existsSync(filePath)) {
        throw new Error('File CSV tidak ditemukan di ' + filePath);
    }
    
    // Hapus data Product yang lama
    await Product.deleteMany({});
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isFirstLine = true;
    const products = [];

    for await (const line of rl) {
        if (isFirstLine) {
            isFirstLine = false;
            continue;
        }
        
        const cols = line.split(';');
        if (cols.length < 10) continue;
        
        let jenis = cols[2]?.trim();
        if (!jenis) continue; // baris kosong atau pemisah

        const sku = cols[1]?.trim() || '';
        const rawName = cols[4]?.trim() || 'Tanpa Nama';
        const thickness = cols[5]?.trim() || '';
        const size = cols[6]?.trim() || '';
        const color = cols[7]?.trim() || '';
        const retailStr = cols[8]?.trim();
        const b2bStr = cols[9]?.trim();
        
        const retailPrice = parseIndoNumber(retailStr);
        const b2bPrice = parseIndoNumber(b2bStr);
        
        const finalName = sku ? `${rawName} - ${color} (${sku})` : `${rawName} - ${color} (Random-${Math.floor(Math.random()*1000)})`;

        // Normalize Jenis to Schema Enum
        let category = jenis;
        if (category.toLowerCase().includes('rice papper') && !category.includes('Square')) {
            category = 'Flatbottom Rice Papper';
        }
        if (category === 'Gusset') {
            if (rawName.toLowerCase().includes('quad')) category = 'Gusset Quad Seal';
            else if (rawName.toLowerCase().includes('centre seal')) category = 'Gusset Side Seal'; 
        }

        const material = cols[3]?.trim() || '-';
        
        // Deskripsi format
        let description = "";
        if (size) description += `Ukuran: ${size}. `;
        if (thickness) description += `Ketebalan: ${thickness}.`;

        products.push({
            sku: sku || undefined,
            name: finalName,
            category: category,
            material: material,
            priceBase: b2bPrice,
            priceB2C: retailPrice,
            priceB2B: b2bPrice,
            description: description,
            stockPolos: 1000, // Default stock
            minOrder: 100
        });
    }
    
    if (products.length > 0) {
        await Product.insertMany(products);
    }
    
    return products.length;
};

module.exports = importCsv;
