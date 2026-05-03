const express = require('express');
const router = express.Router();
const { 
    getProducts, 
    getPopularProducts,
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    exportProducts,
    getLowStockProducts
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, admin, upload.array('images', 5), createProduct);

router.get('/popular', getPopularProducts);
router.get('/low-stock', protect, admin, getLowStockProducts);
router.get('/export', protect, admin, exportProducts);

router.route('/:id')
    .get(getProductById)
    .put(protect, admin, upload.array('images', 5), updateProduct)
    .delete(protect, admin, deleteProduct);

module.exports = router;
