# UKM Kemasan ERP Backend - Struktur & Spesifikasi Teknis

---

## 📊 ARCHITECTURE OVERVIEW

### System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                        │
│         http://localhost:5173 / vercel.app                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/REST
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    Express Server                               │
│                   (Node.js 18+)                                 │
│                 Port: 5000                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Routes (8 modules)                                     │   │
│  │  ├─ /api/auth                                           │   │
│  │  ├─ /api/products                                       │   │
│  │  ├─ /api/orders                                         │   │
│  │  ├─ /api/dashboard                                      │   │
│  │  ├─ /api/customers                                      │   │
│  │  ├─ /api/inventory                                      │   │
│  │  ├─ /api/sales                                          │   │
│  │  └─ /api/landing-content                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Controllers (8 modules)                                │  │
│  │  ├─ authController      (User auth)                    │  │
│  │  ├─ productController   (Catalog)                      │  │
│  │  ├─ orderController     (Orders & Orders CRUD)         │  │
│  │  ├─ customerController  (Customer list)                │  │
│  │  ├─ dashboardController (Analytics)                    │  │
│  │  ├─ inventoryController (Warehouse & Stock)            │  │
│  │  ├─ salesController     (Invoicing & Payments)         │  │
│  │  └─ landingContentController (CMS)                     │  │
│  └────────────────────────────────────────────────────────┘   │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Middleware                                             │  │
│  │  ├─ authMiddleware  (JWT auth + role checking)         │  │
│  │  ├─ errorMiddleware (Error handling & formatting)      │  │
│  │  └─ uploadMiddleware(Multer + file validation)         │  │
│  └────────────────────────────────────────────────────────┘   │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Data Models (9 collections)                            │  │
│  │  ├─ User              (Employees + Customers)           │  │
│  │  ├─ Product           (Catalog with variants)           │  │
│  │  ├─ Order             (Customer orders)                 │  │
│  │  ├─ Invoice           (Billing)                         │  │
│  │  ├─ PaymentReceived   (Payment receipts)                │  │
│  │  ├─ SalesReturn       (Product returns)                 │  │
│  │  ├─ Warehouse         (Storage locations)               │  │
│  │  ├─ InventoryAdjustment (Stock adjustments)             │  │
│  │  ├─ StockCard         (Stock movement history)          │  │
│  │  └─ LandingContent    (CMS content)                     │  │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼────┐  ┌──────▼──────┐ ┌────▼──────┐
│   MongoDB  │  │ Cloudinary  │ │ Uploads   │
│ Database   │  │   CDN/API   │ │ (Static)  │
└────────────┘  └─────────────┘ └───────────┘
```

---

## 📦 DEPENDENCIES ANALYSIS

### Production Dependencies
```json
{
  "bcryptjs": "^3.0.3",           // Password hashing
  "cloudinary": "^2.9.0",         // Image hosting & CDN
  "cors": "^2.8.6",               // Cross-origin requests
  "dotenv": "^17.3.1",            // Environment variables
  "express": "^5.2.1",            // Web framework
  "helmet": "^8.1.0",             // Security headers
  "jsonwebtoken": "^9.0.3",       // JWT authentication
  "mongoose": "^9.2.4",           // MongoDB ODM
  "morgan": "^1.10.1",            // HTTP logging
  "multer": "^2.1.1"              // File upload handling
}
```

### Dev Dependencies
```json
{
  "nodemon": "^3.1.14"            // Auto-reload on file changes
}
```

**Assessment**: ✅ Minimal, focused set. May consider adding later:
- `joi` or `zod` - input validation
- `jest` - unit testing
- `supertest` - API testing
- `pino` - structured logging
- `bull` - job queue (for async tasks)

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### JWT Flow
```
1. User Login
   POST /api/auth/login
   Body: { email, password }
   ↓
2. Generate JWT Token
   jwt.sign(
     { id: user._id, role: user.role },
     SECRET,
     { expiresIn: '2h' }
   )
   ↓
3. Client stores token in localStorage/cookie
   ↓
4. Protected requests
   GET /api/orders/myorders
   Headers: { Authorization: 'Bearer xxx.yyy.zzz' }
   ↓
5. Middleware verifies token
   jwt.verify(token, SECRET)
   Sets req.user = { id, role }
   ↓
6. Controller gets req.user for context
```

### Role-Based Access Control (RBAC)
```
Roles:
├─ admin         (Full access to system)
│  └─ Can: create products, manage inventory, invoicing, dashboard
├─ designer      (Design workflow)
│  └─ Can: update order design/mockup
├─ production    (Production management)
│  └─ Can: update order status, create adjustments
└─ customer      (Marketplace access)
   └─ Can: browse products, create orders, view own orders

Middleware:
├─ protect()      - Verify JWT token exists & valid
└─ admin()        - Verify req.user.role === 'admin'
```

**Issues Found**:
- ❌ No `designer`, `production` specific middleware
- ❌ No permission matrix documented
- ❌ Password reset feature missing
- ❌ Token refresh not implemented (2h fixed expiry)

---

## 💾 DATABASE SCHEMA DESIGN

### User Collection
```javascript
{
  _id: ObjectId,
  name: String,               // Required
  email: String,              // Required, Unique
  password: String,           // Bcrypt hash, Required
  role: String,               // Enum: admin|designer|production|customer
  phone: String,              // Optional
  address: String,            // Optional
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: ✅ Unique on email

---

### Product Collection
```javascript
{
  _id: ObjectId,
  name: String,               // Required, Unique
  category: String,           // Enum: Standing Pouch, Gusset, etc
  material: String,           // Required
  description: String,
  images: [{
    url: String,
    publicId: String,         // Cloudinary public ID
    alt: String
  }],
  minOrder: Number,           // Default: 100 pcs
  addons: {
    valvePrice: Number        // Default: 600 per pcs
  },
  variants: [{                // Array of product variants
    _id: ObjectId,
    sku: String,              // Required per variant
    color: String,
    size: String,
    priceB2C: Number,         // Retail price
    priceB2B: Number,         // Wholesale price
    stock: Number             // Current stock
  }],
  // Summary fields (synced from variants):
  sku: String,                // Primary variant SKU
  priceBase: Number,
  priceB2C: Number,
  priceB2B: Number,
  stockPolos: Number,         // Total stock
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: ⚠️ Missing indexes for category, search

---

### Order Collection
```javascript
{
  _id: ObjectId,
  orderNumber: String,        // Unique, e.g., "UKM-2026-0001"
  customer: ObjectId,         // Ref: User
  product: ObjectId,          // Ref: Product
  details: {
    quantity: Number,
    variantId: ObjectId,
    sku: String,
    material: String,
    size: String,
    color: String,
    unitPrice: Number,
    useValve: Boolean
  },
  branding: {
    clientDesignUrl: String,
    mockupUrl: String,
    status: String,           // Enum: Pending|Reviewing|Revision|Approved
    notes: String
  },
  status: String,             // Enum: Quotation|Payment|Production|QC|Shipping|Completed
  totalPrice: Number,
  isPaid: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Issues**:
- ⚠️ Single product per order (limitation)
- ⚠️ No shipping address
- ⚠️ No audit trail

---

### Invoice Collection
```javascript
{
  _id: ObjectId,
  invoiceNumber: String,      // Unique, e.g., "INV-2026-0001"
  order: ObjectId,            // Ref: Order, Unique
  customer: ObjectId,         // Ref: User
  product: ObjectId,          // Ref: Product
  issuedDate: Date,
  dueDate: Date,              // 14 days default
  quantity: Number,
  unitPrice: Number,
  subtotal: Number,
  totalAmount: Number,
  paidAmount: Number,         // Running total of payments
  status: String,             // Enum: Draft|Issued|Partially Paid|Paid|Overdue
  notes: String,
  createdBy: ObjectId,        // Ref: User (who created)
  createdAt: Date,
  updatedAt: Date
}
```

**Issues**:
- ⚠️ No discount/tax fields
- ⚠️ subtotal === totalAmount (missing calc logic)

---

### PaymentReceived Collection
```javascript
{
  _id: ObjectId,
  paymentNumber: String,      // Unique, e.g., "PAY-2026-0001"
  invoice: ObjectId,          // Ref: Invoice, Required
  order: ObjectId,            // Ref: Order, Required
  customer: ObjectId,         // Ref: User, Required
  amount: Number,             // Min: 0
  paymentDate: Date,          // Default: now
  method: String,             // Enum: Cash|Bank Transfer|QRIS|Giro|Other
  referenceNo: String,        // e.g., bank transfer ref
  notes: String,
  receivedBy: ObjectId,       // Ref: User (who received)
  createdAt: Date,
  updatedAt: Date
}
```

---

### SalesReturn Collection
```javascript
{
  _id: ObjectId,
  returnNumber: String,       // Unique, e.g., "RET-2026-0001"
  order: ObjectId,            // Ref: Order, Required
  invoice: ObjectId,          // Ref: Invoice, Optional
  customer: ObjectId,         // Ref: User, Required
  product: ObjectId,          // Ref: Product, Required
  warehouse: ObjectId,        // Ref: Warehouse where restocked
  quantity: Number,           // Min: 1
  unitPrice: Number,
  totalAmount: Number,
  reason: String,             // Required
  notes: String,
  returnDate: Date,           // Default: now
  restocked: Boolean,         // If true, add back to inventory
  createdBy: ObjectId,        // Ref: User
  createdAt: Date,
  updatedAt: Date
}
```

---

### Warehouse Collection
```javascript
{
  _id: ObjectId,
  name: String,               // Required, Unique per type
  location: String,
  type: String,               // Enum: Main|Retail
  isActive: Boolean,          // Default: true
  createdAt: Date,
  updatedAt: Date
}
```

---

### InventoryAdjustment Collection
```javascript
{
  _id: ObjectId,
  product: ObjectId,          // Ref: Product, Required
  variantId: ObjectId,        // Optional specific variant
  variantSnapshot: {
    sku: String,
    color: String,
    size: String
  },
  warehouse: ObjectId,        // Ref: Warehouse, Required
  type: String,               // Enum: In|Out
  quantity: Number,           // Min: 1
  reason: String,             // Required (e.g., "Damaged", "Recount")
  adjustedBy: ObjectId,       // Ref: User
  createdAt: Date,
  updatedAt: Date
}
```

---

### StockCard Collection (Audit Trail)
```javascript
{
  _id: ObjectId,
  product: ObjectId,          // Ref: Product
  variantId: ObjectId,        // Optional
  variantSnapshot: {},        // Copy of variant state at time
  warehouse: ObjectId,        // Ref: Warehouse
  referenceType: String,      // Enum: Order|Adjustment|Return
  referenceId: ObjectId,      // Ref to Order/Adjustment/Return
  referenceNo: String,        // e.g., "UKM-2026-0001"
  quantityChange: Number,     // +100 or -50
  balanceAfter: Number,       // Stock level after change
  note: String,
  createdAt: Date
}
```

✅ **Good**: Immutable audit trail pattern

---

### LandingContent Collection (CMS)
```javascript
{
  _id: ObjectId,
  key: String,                // Unique, e.g., "customer-portal-home"
  articles: [{
    _id: ObjectId,
    category: String,
    title: String,            // Required
    date: String,
    excerpt: String
  }],
  activities: [{
    _id: ObjectId,
    label: String,
    title: String,            // Required
    date: String,
    location: String,
    summary: String,
    accent: String,           // Tailwind gradient class
    imageUrl: String,
    imagePublicId: String,    // Cloudinary
    imageAlt: String
  }],
  articleSectionConfig: {
    pillText: String,
    title: String,
    subtitle: String
  },
  gallerySectionConfig: {
    pillText: String,
    title: String,
    subtitle: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔄 DATA FLOW EXAMPLES

### Order Creation Flow
```
1. Customer POST /api/orders
   {
     productId: "xxx",
     quantity: 500,        // Validate: multiple of 100
     useValve: true,
     variantId: "yyy"      // Optional
   }

2. Validation
   ✓ Quantity > 0
   ✓ Quantity % 100 === 0
   ✓ Product exists
   ✓ Variant exists (if specified)
   ✓ Stock available

3. Quote Calculation
   B2C (< 1000): priceB2C
   B2B (>= 1000): priceB2B
   + valve: +600/pcs if useValve
   → totalPrice = unitPrice * quantity

4. Create Order Document
   {
     orderNumber: "UKM-2026-0001",
     customer: req.user._id,
     product: productId,
     details: { quantity, variantId, unitPrice, ... },
     status: "Quotation",
     totalPrice: calculated
   }

5. Update Stock
   if variant:
     variant.stock -= quantity
   else:
     product.stockPolos -= quantity
   await product.save()

6. Create Stock Card (Audit)
   {
     referenceType: "Order",
     referenceNo: "UKM-2026-0001",
     quantityChange: -500,
     balanceAfter: remaining_stock
   }

7. Response
   {
     message: "Order berhasil dibuat & Stok diperbarui",
     order: savedOrder,
     summary: { category, basePrice, valveExtra, unitPriceFinal, totalAmount }
   }
```

---

### Invoice & Payment Flow
```
1. Admin POST /api/sales/invoices
   { orderId, dueDate }

2. Validation
   ✓ Order exists
   ✓ Order not already invoiced
   ✓ Order has quantity & price

3. Create Invoice Document
   {
     invoiceNumber: "INV-2026-0001",
     order: orderId,
     status: "Issued",
     dueDate: +14 days,
     totalAmount: from order
   }

4. Update Order Status
   if order.status === "Quotation" → "Payment"

---

5. Accounting POST /api/sales/payments
   { invoiceId, amount, method }

6. Validation
   ✓ Invoice exists
   ✓ Amount > 0
   ✓ Amount <= outstanding balance

7. Create Payment Document
   {
     paymentNumber: "PAY-2026-0001",
     invoice: invoiceId,
     amount: payment_amount,
     method: "Bank Transfer"
   }

8. Sync Invoice Status
   paidAmount += payment_amount
   if paidAmount >= totalAmount:
     status = "Paid"
   else:
     status = "Partially Paid"

9. Sync Order Status
   order.isPaid = (paidAmount >= totalAmount)
```

---

## 📡 API ENDPOINTS SUMMARY

### Authentication
```
POST   /api/auth/register         → Register new user
POST   /api/auth/login            → Login & get JWT token
GET    /api/auth/profile          → Get current user profile
PUT    /api/auth/profile          → Update profile
PUT    /api/auth/password         → Change password
```

### Products
```
GET    /api/products              → List all products (filter, search, sort)
POST   /api/products              → Create product (admin)
GET    /api/products/:id          → Get product detail
PUT    /api/products/:id          → Update product (admin)
DELETE /api/products/:id          → Delete product (admin)
```

### Orders
```
POST   /api/orders                → Create order (customer)
GET    /api/orders                → List all orders (admin)
GET    /api/orders/myorders       → Get customer's own orders
GET    /api/orders/:id            → Get order detail
PUT    /api/orders/:id/status     → Update status (admin)
PUT    /api/orders/:id/design     → Update design/mockup (admin/designer)
```

### Sales
```
GET    /api/sales/overview        → Sales dashboard data
GET    /api/sales/invoices        → List invoices
POST   /api/sales/invoices        → Create invoice
GET    /api/sales/payments        → List payments
POST   /api/sales/payments        → Record payment
GET    /api/sales/returns         → List sales returns
POST   /api/sales/returns         → Create sales return
```

### Inventory
```
GET    /api/inventory/products    → List products (for inventory forms)
GET    /api/inventory/warehouses  → List warehouses
POST   /api/inventory/warehouses  → Create warehouse (admin)
PUT    /api/inventory/warehouses/:id    → Update warehouse
DELETE /api/inventory/warehouses/:id    → Delete warehouse
POST   /api/inventory/adjustments → Create adjustment (admin)
GET    /api/inventory/stock-cards/:productId → Stock history
```

### Dashboard
```
GET    /api/dashboard/stats       → Admin statistics
GET    /api/dashboard/categories  → Sales by category analytics
```

### Customers
```
GET    /api/customers             → List all customers
```

### Landing Content
```
GET    /api/landing-content       → Get CMS content
PUT    /api/landing-content       → Update CMS content (admin)
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Production
- [ ] Remove `/api/clear-db-now` endpoint
- [ ] Remove `/api/seed-csv-now` endpoint  
- [ ] Add .env.example template
- [ ] Update JWT_SECRET to strong value
- [ ] Configure MongoDB for production
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/TLS
- [ ] Setup monitoring/logging
- [ ] Configure backup strategy
- [ ] Load testing

### Production Environment
```bash
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=<min-32-char-random-string>
JWT_EXPIRES_IN=24h
CLOUDINARY_URL=cloudinary://key:secret@cloud_name
```

---

## 📈 SCALABILITY NOTES

### Current Bottlenecks
1. **No database indexing** - add indexes for common queries
2. **No pagination** - list endpoints return all records
3. **No caching** - every request hits database
4. **No rate limiting** - vulnerability to abuse
5. **No background jobs** - sync operations block requests
6. **Single warehouse bottleneck** - no sharding

### Improvement Roadmap
1. **Phase 1**: Add indexes, pagination, rate limiting
2. **Phase 2**: Implement caching (Redis)
3. **Phase 3**: Background job queue (Bull)
4. **Phase 4**: Database replication & sharding
5. **Phase 5**: Microservices architecture

---

## 🔍 MONITORING RECOMMENDATIONS

### Metrics to Track
- Request response time (P50, P95, P99)
- Error rate (5xx, 4xx)
- Database query time
- JWT token validation time
- Image upload/processing time
- Endpoint usage frequency

### Logging Recommendations
- All authentication attempts (login success/fail)
- All state-changing operations (POST, PUT, DELETE)
- All errors with stack traces
- Performance slow queries (> 100ms)
- External API calls (Cloudinary)

### Suggested Tools
- **Monitoring**: New Relic, DataDog, or Grafana
- **Logging**: ELK Stack, Loki, or Splunk
- **Error Tracking**: Sentry
- **APM**: New Relic APM or Datadog APM

---

**End of Technical Specification Document**
