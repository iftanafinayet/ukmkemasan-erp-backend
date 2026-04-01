const Product = require('../models/Product');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// @desc    Ambil semua produk
// @route   GET /api/products
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
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
        res.json(product);
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

        const product = new Product(productData);
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

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
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