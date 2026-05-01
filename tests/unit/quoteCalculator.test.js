const calculateQuote = require('../../utils/quoteCalculator');

describe('calculateQuote', () => {
  const product = {
    priceB2C: 1000,
    priceB2B: 800,
    addons: { valvePrice: 500 }
  };

  it('should calculate B2C price correctly without valve', () => {
    const result = calculateQuote(product, 100, false);
    expect(result.category).toBe('B2C (Retail)');
    expect(result.unitPriceFinal).toBe(1000);
    expect(result.totalAmount).toBe(100000);
  });

  it('should calculate B2C price correctly with valve', () => {
    const result = calculateQuote(product, 100, true);
    expect(result.unitPriceFinal).toBe(1500);
    expect(result.totalAmount).toBe(150000);
  });

  it('should calculate B2B price correctly without valve', () => {
    const result = calculateQuote(product, 1000, false);
    expect(result.category).toBe('B2B (Wholesale)');
    expect(result.unitPriceFinal).toBe(800);
    expect(result.totalAmount).toBe(800000);
  });

  it('should calculate B2B price correctly with valve', () => {
    const result = calculateQuote(product, 1000, true);
    expect(result.unitPriceFinal).toBe(1300);
    expect(result.totalAmount).toBe(1300000);
  });

  it('should use default valve price if addons.valvePrice is missing', () => {
    const productNoAddons = { priceB2C: 1000, priceB2B: 800 };
    const result = calculateQuote(productNoAddons, 100, true);
    expect(result.valveExtra).toBe(600);
    expect(result.unitPriceFinal).toBe(1600);
  });

  it('should use selectedVariant price if provided', () => {
    const variant = { priceB2C: 1200, priceB2B: 1000 };
    const result = calculateQuote(product, 100, false, variant);
    expect(result.unitPriceFinal).toBe(1200);
  });
});
