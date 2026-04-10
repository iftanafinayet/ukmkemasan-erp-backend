const Product = require('../models/Product');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const extractLegacyDescriptionField = (description = '', label = '') => {
    const match = normalizeWhitespace(description).match(new RegExp(`${label}\\s*:\\s*([^\\.]+)`, 'i'));
    return normalizeWhitespace(match?.[1] || '');
};

const extractWeightFromName = (name = '') => {
    const match = normalizeWhitespace(name).match(/(\d+(?:[.,]\d+)?)\s*(gr|kg)\b/i);
    if (!match) return '';

    return `${match[1].replace(/([.,]0+)$/, '')} ${match[2].toLowerCase()}`;
};

const removeSkuSuffixFromName = (name = '') => normalizeWhitespace(name).replace(/\s*\([^)]*\)\s*$/, '').trim();

const extractColorFromName = (name = '') => {
    const cleanedName = removeSkuSuffixFromName(name);
    const parts = cleanedName.split(' - ').map(normalizeWhitespace).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : '';
};

const toNumberOrFallback = (...values) => {
    for (const value of values) {
        if (value === '' || value === null || value === undefined) continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const parseJsonField = (value, fieldName) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`Format ${fieldName} tidak valid`);
    }
};

const buildVariantSku = (name = 'product', index = 0) => {
    const slug = String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${slug || 'product'}-${String(index + 1).padStart(2, '0')}`;
};

const normalizeVariant = (variant = {}, index = 0, fallbackName = 'product') => ({
    ...(variant._id ? { _id: variant._id } : {}),
    sku: String(variant.sku || buildVariantSku(fallbackName, index)).trim(),
    color: String(variant.color || 'Default').trim(),
    size: String(variant.size || 'Default').trim(),
    priceB2C: toNumberOrFallback(variant.priceB2C, variant.priceBase),
    priceB2B: toNumberOrFallback(variant.priceB2B, variant.priceBase, variant.priceB2C),
    stock: Math.max(0, toNumberOrFallback(variant.stock))
});

const stripLegacyVariantFields = (payload) => {
    delete payload.sku;
    delete payload.color;
    delete payload.size;
    delete payload.stock;
    delete payload.stockPolos;
    delete payload.priceBase;
    delete payload.priceB2C;
    delete payload.priceB2B;
};

const hasLegacyVariantFields = (payload = {}) => (
    ['sku', 'color', 'size', 'stock', 'stockPolos', 'priceBase', 'priceB2C', 'priceB2B']
        .some((field) => hasOwn(payload, field))
);

const buildLegacyVariant = (payload = {}, existingVariant = {}) => normalizeVariant({
    _id: existingVariant._id,
    sku: payload.sku ?? existingVariant.sku,
    color: payload.color
        || existingVariant.color
        || extractLegacyDescriptionField(payload.description, 'Warna')
        || extractColorFromName(payload.name)
        || 'Default',
    size: payload.size
        || existingVariant.size
        || extractWeightFromName(payload.name)
        || extractLegacyDescriptionField(payload.description, 'Ukuran')
        || 'Default',
    priceB2C: payload.priceB2C ?? existingVariant.priceB2C ?? payload.priceBase,
    priceB2B: payload.priceB2B ?? existingVariant.priceB2B ?? payload.priceBase ?? payload.priceB2C,
    stock: payload.stock ?? payload.stockPolos ?? existingVariant.stock ?? 0
}, 0, payload.name || 'product');

const serializeProduct = (product) => {
    const productData = typeof product.toObject === 'function' ? product.toObject() : { ...product };
    productData.variants = getNormalizedVariants(product);
    productData.availableColors = [...new Set(productData.variants.map((variant) => variant.color))];
    productData.availableSizes = [...new Set(productData.variants.map((variant) => variant.size))];
    return productData;
};

const normalizeProductPayload = (payload = {}, existingProduct = null) => {
    const normalizedPayload = { ...payload };

    if (hasOwn(normalizedPayload, 'addons')) {
        normalizedPayload.addons = parseJsonField(normalizedPayload.addons, 'addons');
        if (normalizedPayload.addons && hasOwn(normalizedPayload.addons, 'valvePrice')) {
            normalizedPayload.addons.valvePrice = toNumberOrFallback(normalizedPayload.addons.valvePrice);
        }
    }

    if (hasOwn(normalizedPayload, 'minOrder')) {
        normalizedPayload.minOrder = Math.max(1, toNumberOrFallback(normalizedPayload.minOrder, existingProduct?.minOrder, 100));
    }

    if (hasOwn(normalizedPayload, 'variants')) {
        const parsedVariants = parseJsonField(normalizedPayload.variants, 'variants');
        if (!Array.isArray(parsedVariants)) {
            throw new Error('Format variants harus berupa array');
        }

        normalizedPayload.variants = parsedVariants.map((variant, index) =>
            normalizeVariant(variant, index, normalizedPayload.name || existingProduct?.name || 'product')
        );
        stripLegacyVariantFields(normalizedPayload);
        return normalizedPayload;
    }

    if (!hasLegacyVariantFields(normalizedPayload)) {
        return normalizedPayload;
    }

    const existingVariants = existingProduct?.variants?.map((variant) =>
        typeof variant.toObject === 'function' ? variant.toObject() : variant
    ) || [];

    if (existingVariants.length > 1) {
        stripLegacyVariantFields(normalizedPayload);
        return normalizedPayload;
    }

    normalizedPayload.variants = [
        buildLegacyVariant(normalizedPayload, existingVariants[0] || {})
    ];
    stripLegacyVariantFields(normalizedPayload);

    return normalizedPayload;
};

const getNormalizedVariants = (product) => {
    if (!product) return [];

    const variants = (product.variants || []).map((variant) =>
        typeof variant?.toObject === 'function' ? variant.toObject() : variant
    );

    if (variants.length > 0) {
        return variants;
    }

    const source = typeof product.toObject === 'function' ? product.toObject() : product;
    return [buildLegacyVariant(source)];
};

// @desc    Ambil semua produk
// @route   GET /api/products
exports.getProducts = async (req, res) => {
    try {
        const filter = {};

        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { sku: { $regex: req.query.search, $options: 'i' } },
                { material: { $regex: req.query.search, $options: 'i' } },
                { 'variants.sku': { $regex: req.query.search, $options: 'i' } },
                { 'variants.color': { $regex: req.query.search, $options: 'i' } },
                { 'variants.size': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const products = await Product.find(filter).sort({ category: 1, name: 1, createdAt: -1 });
        res.json(products.map(serializeProduct));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Ambil produk berdasarkan ID
// @route   GET /api/products/:id
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

        res.json(serializeProduct(product));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Tambah produk baru
// @route   POST /api/products
exports.createProduct = async (req, res) => {
    try {
        const productData = { ...req.body };

        // Upload images to Cloudinary as AVIF
        if (req.files && req.files.length > 0) {
            const imagePromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, 'products')
            );
            const uploadedImages = await Promise.all(imagePromises);
            productData.images = uploadedImages.map((img, idx) => ({
                url: img.url,
                publicId: img.publicId,
                alt: req.body.name || `Product image ${idx + 1}`
            }));
        }

        const normalizedProductData = normalizeProductPayload(productData);
        const product = new Product(normalizedProductData);
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update produk
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

        const updateData = { ...req.body };

        // Handle image deletion requests
        if (req.body.deleteImageIds) {
            let deleteIds;
            try {
                deleteIds = typeof req.body.deleteImageIds === 'string'
                    ? JSON.parse(req.body.deleteImageIds)
                    : req.body.deleteImageIds;
            } catch { deleteIds = []; }

            // Delete from Cloudinary
            for (const publicId of deleteIds) {
                await deleteFromCloudinary(publicId);
            }
            // Remove from product images
            product.images = product.images.filter(
                img => !deleteIds.includes(img.publicId)
            );
        }

        // Upload new images
        if (req.files && req.files.length > 0) {
            const imagePromises = req.files.map(file =>
                uploadToCloudinary(file.buffer, 'products')
            );
            const uploadedImages = await Promise.all(imagePromises);
            const newImages = uploadedImages.map((img, idx) => ({
                url: img.url,
                publicId: img.publicId,
                alt: req.body.name || product.name || `Product image ${idx + 1}`
            }));
            product.images = [...(product.images || []), ...newImages];
        }

        // Update other fields
        updateData.images = product.images;
        delete updateData.deleteImageIds;

        const normalizedUpdateData = normalizeProductPayload(updateData, product);
        Object.assign(product, normalizedUpdateData);

        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Ambil produk dengan stok rendah (Contoh: < 500 pcs)
exports.getLowStockProducts = async (req, res) => {
    try {
        const lowStock = await Product.find({ stockPolos: { $lt: 500 } });
        res.json(lowStock);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Hapus produk berdasarkan ID
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

        // Delete all images from Cloudinary
        if (product.images && product.images.length > 0) {
            for (const img of product.images) {
                await deleteFromCloudinary(img.publicId);
            }
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Produk berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
