/**
 * Menghitung harga UKM Kemasan (B2C < 1000pcs, B2B >= 1000pcs)
 * @param {Object} product - Data produk dari DB
 * @param {Number} quantity - Jumlah pesanan (kelipatan 100)
 * @param {Boolean} useValve - Apakah pakai valve kopi
 */
const calculateQuote = (product, quantity, useValve) => {
  // 1. Tentukan Harga Dasar (Base Price)
  // B2B jika >= 1000, selain itu B2C
  let basePrice = quantity >= 1000 ? product.priceB2B : product.priceB2C;

  // 2. Tambahan Biaya Valve (jika request)
  // Biasanya valve dihitung per pcs
  const valveExtra = useValve ? product.addons.valvePrice : 0;

  // 3. Kalkulasi Final
  const unitPriceFinal = basePrice + valveExtra;
  const totalAmount = unitPriceFinal * quantity;

  return {
    category: quantity >= 1000 ? 'B2B (Wholesale)' : 'B2C (Retail)',
    basePrice: basePrice,
    valveExtra: valveExtra,
    unitPriceFinal: unitPriceFinal,
    totalAmount: totalAmount
  };
};

module.exports = calculateQuote;