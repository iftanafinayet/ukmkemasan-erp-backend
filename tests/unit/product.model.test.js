const mongoose = require('mongoose');
const Product = require('../../models/Product');

describe('Product Model Logic Tests', () => {
  describe('syncSummaryFieldsFromVariants', () => {
    it('should correctly sync summary fields from variants', () => {
      const product = new Product({
        name: 'Test Product',
        category: 'Standing Pouch',
        material: 'Plastic',
        priceB2C: 0,
        priceB2B: 0,
        variants: [
          {
            sku: 'VAR1',
            color: 'Red',
            size: '10x20',
            priceB2C: 1000,
            priceB2B: 800,
            stock: 100,
          },
          {
            sku: 'VAR2',
            color: 'Blue',
            size: '10x20',
            priceB2C: 1200,
            priceB2B: 900,
            stock: 200,
          },
        ],
      });

      product.syncSummaryFieldsFromVariants();

      expect(product.sku).toBe('VAR1');
      expect(product.priceB2C).toBe(1000);
      expect(product.priceB2B).toBe(800);
      expect(product.stockPolos).toBe(300);
    });

    it('should handle case with one variant', () => {
      const product = new Product({
        name: 'Single Variant',
        category: 'Standing Pouch',
        material: 'Plastic',
        variants: [
          {
            sku: 'V1',
            color: 'Green',
            size: 'S',
            priceB2C: 500,
            priceB2B: 400,
            stock: 50,
          },
        ],
      });

      product.syncSummaryFieldsFromVariants();

      expect(product.sku).toBe('V1');
      expect(product.priceB2C).toBe(500);
      expect(product.priceB2B).toBe(400);
      expect(product.stockPolos).toBe(50);
    });

    it('should handle empty variants without crashing', () => {
      const product = new Product({
        name: 'No Variants',
        category: 'Standing Pouch',
        material: 'Plastic',
        variants: [],
      });

      // Should not throw
      expect(() => product.syncSummaryFieldsFromVariants()).not.toThrow();
    });

    it('should handle null variants without crashing', () => {
      const product = new Product({
        name: 'Null Variants',
        category: 'Standing Pouch',
        material: 'Plastic',
        variants: null,
      });

      expect(() => product.syncSummaryFieldsFromVariants()).not.toThrow();
    });
  });

  describe('Validators', () => {
    it('should fail validation if variants array is empty', async () => {
      const product = new Product({
        name: 'Invalid Product',
        category: 'Standing Pouch',
        material: 'Plastic',
        priceB2C: 100,
        priceB2B: 80,
        variants: [],
      });

      try {
        await product.validate();
        fail('Should have thrown a validation error');
      } catch (error) {
        expect(error.message).toMatch(/Minimal satu varian produk harus tersedia/);
      }
    });

    it('should fail validation if variants is not an array', async () => {
      const product = new Product({
        name: 'Invalid Product',
        category: 'Standing Pouch',
        material: 'Plastic',
        priceB2C: 100,
        priceB2B: 80,
        variants: 'not an array',
      });

      try {
        await product.validate();
        fail('Should have thrown a validation error');
      } catch (error) {
        expect(error.message).toMatch(/Minimal satu varian produk harus tersedia|Cast to embedded failed/);
      }
    });
  });
});
