# UKM Kemasan ERP - QUICK FIX GUIDE

Panduan step-by-step untuk memperbaiki 11 critical issues yang ditemukan.

---

## Issue #1: Missing LandingContent Export

**Severity**: 🔴 CRITICAL  
**File**: [models/LandingContent.js](models/LandingContent.js)  
**Current Status**: Model tidak di-export (aplikasi crash)

### ❌ Current (Lines 1-73)
```javascript
const mongoose = require('mongoose');

const LandingArticleSchema = new mongoose.Schema({
  // ... schema definition
}, { _id: true });

const LandingActivitySchema = new mongoose.Schema({
  // ... schema definition
}, { _id: true });

const LandingContentSchema = new mongoose.Schema({
  // ... schema definition
}, { timestamps: true });

// ❌ MISSING: module.exports = mongoose.model('LandingContent', LandingContentSchema);
```

### ✅ Fix: Tambahkan di akhir file
```javascript
module.exports = mongoose.model('LandingContent', LandingContentSchema);
```

### Why
- Tanpa export, `require('./models/LandingContent')` akan undefined
- Controller akan crash saat mengakses model

---

## Issue #2: Auth Middleware Logic Error

**Severity**: 🔴 CRITICAL  
**File**: [middleware/authMiddleware.js](middleware/authMiddleware.js)  
**Lines**: 1-29

### ❌ Current (Problem)
```javascript
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decode.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ message: 'User tidak ditemukan. Silakan login ulang.' });
            }
            
            return next();  // ✅ Kembali ke sini
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            return res.status(401).json({ message: 'Invalid token' });
        }
    }

    // ❌ BUG: Code ini tidak pernah terjangkau jika token valid
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
};
```

### ✅ Clean Version
```javascript
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Check 1: Authorization header exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Check 2: Extract & verify token
        const token = authHeader.split(' ')[1];
        const decode = jwt.verify(token, process.env.JWT_SECRET);

        // Check 3: User exists in database
        const user = await User.findById(decode.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User tidak ditemukan. Silakan login ulang.' });
        }

        // Success: Attach user to request
        req.user = user;
        return next();

    } catch (error) {
        // Handle JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Silakan login kembali.' });
        }
        return res.status(401).json({ message: 'Invalid or malformed token' });
    }
};
```

### Why
- Clearer flow: check → extract → verify → succeed
- Tidak ada unreachable code
- Better error messages

---

## Issue #3: Stock Card Wrong Balance Field

**Severity**: 🔴 CRITICAL  
**File**: [controllers/orderController.js](controllers/orderController.js)  
**Lines**: 54-91

### ❌ Current (Problem)
```javascript
// Update actual stock
if (selectedVariant) {
    selectedVariant.stock = Math.max(0, (selectedVariant.stock || 0) - qty);
} else {
    product.stockPolos = Math.max(0, (product.stockPolos || 0) - qty);
}
await product.save();

// Record movement in StockCard
const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });
await StockCard.create({
    product: product._id,
    warehouse: defaultWarehouse?._id,
    referenceType: 'Order',
    referenceId: savedOrder._id,
    referenceNo: savedOrder.orderNumber,
    quantityChange: -qty,
    balanceAfter: product.stockPolos,  // ❌ WRONG! Ini variabel polos, bukan variant
    note: selectedVariant
        ? `Pengurangan stok varian ${selectedVariant.size}/${selectedVariant.color} untuk order ${savedOrder.orderNumber}`
        : `Pengurangan stok untuk order ${savedOrder.orderNumber}`
});
```

### ✅ Fix
```javascript
// Update actual stock
const actualBalance = selectedVariant
    ? (selectedVariant.stock = Math.max(0, (selectedVariant.stock || 0) - qty))
    : (product.stockPolos = Math.max(0, (product.stockPolos || 0) - qty));

await product.save();

// Record movement in StockCard
const defaultWarehouse = await Warehouse.findOne({ 
    type: 'Main', 
    isActive: true 
}).sort({ createdAt: 1 });

if (!defaultWarehouse) {
    return res.status(400).json({ 
        message: 'Main warehouse tidak ditemukan' 
    });
}

await StockCard.create({
    product: product._id,
    variantId: selectedVariant?._id,
    warehouse: defaultWarehouse._id,
    referenceType: 'Order',
    referenceId: savedOrder._id,
    referenceNo: savedOrder.orderNumber,
    quantityChange: -qty,
    balanceAfter: actualBalance,  // ✅ CORRECT: actual balance setelah update
    note: selectedVariant
        ? `Pengurangan stok varian ${selectedVariant.size}/${selectedVariant.color} untuk order ${savedOrder.orderNumber}`
        : `Pengurangan stok untuk order ${savedOrder.orderNumber}`
});
```

### Why
- StockCard adalah audit trail - harus akurat
- Jika gunakan variant, harus catat variant balance
- Bug ini menyebabkan mis-reconciliation stock report

---

## Issue #4: Missing addons Default Value

**Severity**: 🔴 CRITICAL  
**File**: [controllers/orderController.js](controllers/orderController.js)  
**Lines**: 28-43

### ❌ Current (Problem)
```javascript
const quote = calculateQuote(product, qty, useValve, selectedVariant);
// ↓ di quoteCalculator.js
const calculateQuote = (product, quantity, useValve, selectedVariant = null) => {
    const priceSource = selectedVariant || product;
    let basePrice = quantity >= 1000 ? priceSource.priceB2B : priceSource.priceB2C;

    // ❌ BUG: product.addons bisa undefined
    const valveExtra = useValve ? product.addons.valvePrice : 0;
    // ^ Error: Cannot read property 'valvePrice' of undefined
};
```

### ✅ Fix
```javascript
// Option 1: Di quoteCalculator.js
const calculateQuote = (product, quantity, useValve, selectedVariant = null) => {
    const priceSource = selectedVariant || product;
    let basePrice = quantity >= 1000 ? priceSource.priceB2B : priceSource.priceB2C;

    // Safe access dengan default
    const valvePrice = product?.addons?.valvePrice ?? 600;  // 600 default
    const valveExtra = useValve ? valvePrice : 0;

    const unitPriceFinal = basePrice + valveExtra;
    const totalAmount = unitPriceFinal * quantity;

    return {
        category: quantity >= 1000 ? 'B2B (Wholesale)' : 'B2C (Retail)',
        basePrice,
        valveExtra,
        unitPriceFinal,
        totalAmount
    };
};

// Option 2: Di Controller (Validation)
// Sebelum call calculateQuote:
if (!product.addons || !product.addons.valvePrice) {
    return res.status(400).json({ 
        message: 'Produk tidak memiliki konfigurasi harga valve' 
    });
}
```

### Why
- Product bisa tidak memiliki addons field
- Harus handle gracefully dengan default value
- Jangan let user umami blank invoice

---

## Issue #5 & #6: Clear DB & Seed CSV Endpoints - SECURITY

**Severity**: 🔴 CRITICAL  
**File**: [server.js](server.js)  
**Lines**: 60-114

### ❌ Current (Problem)
```javascript
// TEMPORARY ROUTE: CLEAR DB
app.get('/api/clear-db-now', async (req, res) => {
    try {
        // ❌ NO AUTHENTICATION!
        // ❌ ALLOW GET METHOD!
        // Anyone can curl this and delete all data
        const Order = require('./models/Order');
        const Product = require('./models/Product');
        const User = require('./models/User');
        
        await Order.deleteMany({});
        await Product.deleteMany({});
        await User.deleteMany({ role: { $ne: 'admin' } });
        
        res.send('✅ Database berhasil dibersihkan (kecuali Admin)!');
    } catch (err) {
        res.status(500).send('❌ Gagal: ' + err.message);
    }
});

// TEMPORARY ROUTE: SEED CSV
app.get('/api/seed-csv-now', async (req, res) => {
    try {
        // ❌ NO AUTHENTICATION!
        const importCsv = require('./seederCsv');
        const Product = require('./models/Product');
        const count = await importCsv();
        const totalProducts = await Product.countDocuments();
        res.send(`✅ Berhasil import ${count} produk dari file CSV...`);
    } catch (err) {
        console.error('❌ seed-csv-now error:', err);
        res.status(500).json({ error: err.message, stack: err.stack, code: err.code });
    }
});
```

### ✅ Fix: Delete or Secure
```javascript
// OPTION 1: Delete these routes completely (RECOMMENDED)
// Just remove them entirely - use seeder scripts instead

// OPTION 2: If you need them, secure them properly
const isSuperAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id);
        
        if (user?.role !== 'admin' || user?.email !== 'super@admin.com') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Then:
app.delete('/api/admin/reset-database', isSuperAdmin, async (req, res) => {
    // Changed to DELETE
    // Added authentication
    // Added email check
    try {
        await Order.deleteMany({});
        await Product.deleteMany({});
        await User.deleteMany({ role: { $ne: 'admin' } });
        res.json({ message: '✅ Database berhasil direset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### Why
- **SECURITY VULNERABILITY**: Anyone can delete production database
- GET request tidak boleh modify data (REST violation)
- Harus ada authentication minimal
- Use regular seeder scripts untuk development

---

## Issue #7: Missing Warehouse Validation

**Severity**: 🔴 CRITICAL  
**File**: [controllers/orderController.js](controllers/orderController.js)  
**Lines**: 74-91

### ❌ Current (Problem)
```javascript
const defaultWarehouse = await Warehouse.findOne({ type: 'Main', isActive: true }).sort({ createdAt: 1 });

// ❌ Tidak ada validation jika warehouse tidak ditemukan
await StockCard.create({
    product: product._id,
    warehouse: defaultWarehouse?._id,  // Bisa undefined!
    // ...
});
```

### ✅ Fix
```javascript
// Get or create default warehouse
let defaultWarehouse = await Warehouse.findOne({ 
    type: 'Main', 
    isActive: true 
}).sort({ createdAt: 1 });

// Validate
if (!defaultWarehouse) {
    // Create default warehouse jika belum ada
    defaultWarehouse = await Warehouse.create({
        name: 'Main Warehouse',
        type: 'Main',
        location: 'Sidoarjo',  // Default location
        isActive: true
    });
}

// Now safe to use
await StockCard.create({
    product: product._id,
    warehouse: defaultWarehouse._id,  // ✅ Guaranteed not undefined
    // ...
});
```

### Why
- StockCard.warehouse seharusnya tidak null (foreign key)
- Default warehouse harus exist sebelum pertama order
- Better: ensure warehouse di setup saat app initialization

---

## Issue #8: Race Condition in Stock Updates

**Severity**: 🔴 CRITICAL  
**File**: [controllers/orderController.js](controllers/orderController.js)  
**Lines**: 54-70

### ❌ Current (Problem)
```javascript
// ❌ Race condition: T1 reads, T2 reads, both write
const selectedVariant = variantId ? product.variants?.id(variantId) : null;
const availableStock = selectedVariant ? selectedVariant.stock : product.stockPolos;

// Check 1: Both requests see stock = 500
if (availableStock < qty) {  // qty = 300
    return res.status(400).json({ message: 'Stok tidak mencukupi' });
}

// Update (both requests proceed)
if (selectedVariant) {
    selectedVariant.stock = Math.max(0, (selectedVariant.stock || 0) - qty);
} else {
    product.stockPolos = Math.max(0, (product.stockPolos || 0) - qty);
}
await product.save();
// ❌ Both save, result: stock = 200 instead of -100 (negative!)
```

### ✅ Fix: Use MongoDB Atomic Operations
```javascript
// Instead of read-modify-write, use atomic operation
try {
    // Single atomic operation: verify & reduce in one step
    const updatedProduct = await Product.findOneAndUpdate(
        {
            _id: productId,
            // For variant:
            'variants._id': variantId,
            'variants.stock': { $gte: qty }  // Only proceed if stock sufficient
        },
        {
            // Atomic decrement
            $inc: { 'variants.$.stock': -qty }
        },
        { new: true }
    );

    if (!updatedProduct) {
        return res.status(400).json({ 
            message: 'Stok tidak mencukupi atau produk tidak ditemukan' 
        });
    }

    // Continue with order creation using updatedProduct
} catch (error) {
    res.status(400).json({ message: error.message });
}
```

### Why
- MongoDB `$inc` is atomic - tidak bisa race condition
- Single database operation - tidak ada intermediate state
- Much safer untuk concurrent requests

---

## Issue #9: Payment Calculation Inconsistency

**Severity**: 🔴 CRITICAL  
**File**: [controllers/salesController.js](controllers/salesController.js)  
**Lines**: 12-41

### ❌ Current (Problem)
```javascript
const getUnitPriceFromOrder = (order) => {
    const quantity = Number(order?.details?.quantity) || 0;
    if (!quantity) return 0;

    const storedUnitPrice = Number(order?.details?.unitPrice);
    if (Number.isFinite(storedUnitPrice) && storedUnitPrice > 0) {
        return storedUnitPrice;  // ✅ Prefer stored
    }

    // ❌ Fallback: kalkulasi dari totalPrice
    // Bisa tidak akurat karena rounding atau pembulatan
    return Number(order?.totalPrice || 0) / quantity;
};

// Kemudian:
exports.createInvoice = async (req, res) => {
    const quantity = Number(order?.details?.quantity) || 0;
    const unitPrice = getUnitPriceFromOrder(order);  // Bisa berbeda dari storedharga
    const totalAmount = Number(order?.totalPrice || quantity * unitPrice);
    // ❌ Tapi totalAmount dari order.totalPrice, jadi reconciliation error
};
```

### ✅ Fix: Always Store Unit Price in Order
```javascript
// FIX 1: Ensure unitPrice always stored in order.details
// In orderController.js createOrder:
const quote = calculateQuote(product, qty, useValve, selectedVariant);

const order = new Order({
    orderNumber,
    customer: req.user._id,
    product: productId,
    details: {
        quantity: qty,
        variantId: selectedVariant?._id,
        sku: selectedVariant?.sku || product.sku,
        material: product.material,
        size: selectedVariant?.size || '',
        color: selectedVariant?.color || '',
        useValve: useValve || false,
        unitPrice: quote.unitPriceFinal  // ✅ ALWAYS store this
    },
    totalPrice: quote.totalAmount,
    // ...
});

// FIX 2: Simplify getUnitPriceFromOrder
const getUnitPriceFromOrder = (order) => {
    return Number(order?.details?.unitPrice) || 0;
};

// FIX 3: Validation in createInvoice
exports.createInvoice = async (req, res) => {
    const quantity = Number(order?.details?.quantity) || 0;
    const unitPrice = getUnitPriceFromOrder(order);
    
    // Validate both exist
    if (!quantity || unitPrice <= 0) {
        return res.status(400).json({ 
            message: 'Order tidak valid untuk invoice (missing quantity atau unitPrice)' 
        });
    }
    
    // Always trust order.totalPrice (pre-calculated)
    const totalAmount = Number(order.totalPrice);
    
    // Cross-check
    const calculatedTotal = quantity * unitPrice;
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
        console.warn(`Price mismatch Order ${order.orderNumber}: ${calculatedTotal} vs ${totalAmount}`);
    }
    
    // Create invoice using order totals
    const invoice = await Invoice.create({
        invoiceNumber: await generateDocumentNumber(Invoice, SALES_INVOICE_PREFIX),
        order: order._id,
        customer: order.customer._id,
        product: order.product._id,
        issuedDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        quantity,
        unitPrice,
        subtotal: totalAmount,
        totalAmount,
        notes: notes?.trim?.() || '',
        createdBy: req.user?._id
    });
};
```

### Why
- Audit trail harus akurat
- Invoice harus match order price
- Jangan kalkulasi ulang dari totalPrice - bisa rounding error

---

## Issue #10: Input Validation Missing

**Severity**: 🔴 CRITICAL  
**File**: [controllers/productController.js](controllers/productController.js)  
**Lines**: 55-100

### ❌ Current (Problem)
```javascript
exports.createProduct = async (req, res) => {
    try {
        const productData = { ...req.body };
        // ❌ No validation of required fields

        if (req.files && req.files.length > 0) {
            // ... image upload
        }

        const normalizedProductData = normalizeProductPayload(productData);
        // ❌ normalizeProductPayload mungkin lolos validation
        
        const product = new Product(normalizedProductData);
        const createdProduct = await product.save();  // ❌ Baru check saat save
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
```

### ✅ Fix: Add Validation Middleware
```javascript
// OPTION 1: Simple inline validation
exports.createProduct = async (req, res) => {
    try {
        const { name, category, material, variants } = req.body;

        // 1. Validate required fields
        if (!name?.trim()) {
            return res.status(400).json({ message: 'Nama produk wajib diisi' });
        }
        if (!category) {
            return res.status(400).json({ message: 'Kategori wajib dipilih' });
        }
        if (!material?.trim()) {
            return res.status(400).json({ message: 'Material wajib diisi' });
        }

        // 2. Validate variants
        let parsedVariants;
        if (typeof variants === 'string') {
            try {
                parsedVariants = JSON.parse(variants);
            } catch {
                return res.status(400).json({ message: 'Format variants harus JSON' });
            }
        } else {
            parsedVariants = variants;
        }

        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
            return res.status(400).json({ message: 'Minimal satu varian harus ada' });
        }

        // 3. Validate each variant
        for (const variant of parsedVariants) {
            if (!variant.sku?.trim()) {
                return res.status(400).json({ message: 'SKU varian wajib diisi' });
            }
            if (!Number.isFinite(variant.priceB2C) || variant.priceB2C < 0) {
                return res.status(400).json({ message: 'Harga B2C varian tidak valid' });
            }
            if (!Number.isFinite(variant.priceB2B) || variant.priceB2B < 0) {
                return res.status(400).json({ message: 'Harga B2B varian tidak valid' });
            }
        }

        const productData = { name, category, material, variants: parsedVariants };

        // ... rest of creation
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// OPTION 2: Dedicated validation module (Better for scalability)
// validators/productValidator.js
const validateProduct = (data) => {
    const errors = [];
    
    if (!data.name?.trim()) errors.push('Nama produk wajib');
    if (!data.category) errors.push('Kategori wajib');
    if (!data.material?.trim()) errors.push('Material wajib');
    
    if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
};

// Usage:
exports.createProduct = async (req, res) => {
    try {
        validateProduct(req.body);  // ✅ Validate first
        
        const productData = normalizeProductPayload(req.body);
        const product = new Product(productData);
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
```

---

## Issue #11: Inconsistent Error Response Format

**Severity**: 🟠 HIGH  
**File**: Multiple controllers  

### ❌ Current (Inconsistent)
```javascript
// Format 1 (Most controllers):
res.status(400).json({ message: error.message });

// Format 2 (server.js seed):
res.status(500).json({
    error: err.message,
    stack: err.stack,
    code: err.code
});

// Format 3 (errorMiddleware):
res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
});
```

### ✅ Standardized Format
```javascript
// middleware/responseFormatter.js
const responseFormatter = {
    success: (data, message = 'Success') => ({
        success: true,
        message,
        data
    }),

    error: (message, details = null, statusCode = 500) => ({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? details : null,
        statusCode
    })
};

// Standardized error handler
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || res.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json(
        responseFormatter.error(
            message,
            {
                code: err.code,
                field: err.field,
                stack: err.stack
            },
            statusCode
        )
    );
};

// Usage in controller:
res.status(201).json(
    responseFormatter.success(createdProduct, 'Produk berhasil dibuat')
);

// All errors consistent:
res.status(400).json(
    responseFormatter.error('Nama produk wajib diisi')
);
```

### Frontend Consistency
```javascript
// Frontend bisa rely on format:
const response = await fetch('/api/products', {...});
const { success, data, message, error } = await response.json();

if (success) {
    // Handle success
    processData(data);
} else {
    // Handle error
    showError(message);
    if (isDev) console.error(error);
}
```

---

## SUMMARY: Implementation Order

1. **IMMEDIATE** (Do first):
   - [ ] Export LandingContent model
   - [ ] Delete unsafe endpoints (#5, #6)
   - [ ] Fix auth middleware logic
   - [ ] Fix stock card balance field
   - [ ] Add addons validation

2. **SHORT-TERM** (This week):
   - [ ] Fix race condition with atomic $inc
   - [ ] Add warehouse validation
   - [ ] Fix payment calculation
   - [ ] Add input validation

3. **FOLLOW-UP** (Sprint):
   - [ ] Standardize error responses
   - [ ] Add database indexes
   - [ ] Add pagination
   - [ ] Improve error handling

---

**Target**: All critical fixes should take ~2-3 hours total if done sequentially
