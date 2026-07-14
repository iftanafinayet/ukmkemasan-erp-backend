const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'ukm_kemasan_clean_export.csv');

function fixCatalog() {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        const header = lines[0];
        const rows = lines.slice(1);

        const updatedRows = rows.map(line => {
            if (!line.trim()) return line;
            
            // Sederhana split by comma (hati-hati dengan comma dalam quote)
            // Untuk CSV ini, kita gunakan regex untuk handle comma dalam quotes
            let parts = line.match(/(".*?"|[^",]+|(?<=,)(?=,)|(?<=^)(?=,)|(?<=,)(?=$))/g);
            
            if (!parts || parts.length < 5) return line; // Minimal ada sku, name, cat, desc, mat

            let sku = parts[0] || '';
            let productName = (parts[1] || '').replace(/"/g, '');
            let category = (parts[2] || '').replace(/"/g, '');
            let material = (parts[4] || '').replace(/"/g, '');

            // 1. Perbaiki Material
            if (productName.includes('Rice Paper')) {
                material = 'Rice Paper / LLDPE (Food Grade)';
            } else if (productName.includes('Filter Drip')) {
                material = 'Food Grade Filter Paper';
            } else if (productName.includes('Valve')) {
                material = 'One-way Degassing Valve (Food Grade Plastic)';
            }

            // 2. Standarisasi Nama (Hapus kapasitas dari Standing Pouch Liquid)
            if (productName.includes('Standing Pouch Liquid')) {
                productName = productName.replace(/\s\d+\sml/g, '').trim();
            }

            // 3. Improvisasi Deskripsi
            let cleanMat = material || 'food-grade material';
            let newDesc = `"Kemasan ${productName} kualitas premium dari kategori ${category}. Dibuat dengan ${cleanMat} yang menjamin keamanan produk Anda. Sangat ideal untuk menjaga kesegaran kopi, snack, atau produk UMKM lainnya. Tampilan profesional untuk meningkatkan nilai jual brand Anda."`;

            // Update parts
            parts[1] = productName.includes(',') ? `"${productName}"` : productName;
            parts[3] = newDesc;
            parts[4] = material.includes(',') ? `"${material}"` : material;

            return parts.map(p => p === undefined ? '' : p).join(',');
        });

        const finalContent = [header, ...updatedRows].join('\n');
        fs.writeFileSync(filePath, finalContent);
        console.log(`Successfully updated ${filePath}`);

    } catch (err) {
        console.error('Error processing CSV:', err);
    }
}

fixCatalog();
