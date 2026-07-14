const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'UKM Kemasan ERP API',
    version: '1.0.0',
    description: 'API documentation for UKM Kemasan ERP Backend. Manages products, orders, inventory, sales, production tasks, conversations, payments, and landing page content.',
    contact: {
      name: 'UKM Kemasan',
    },
  },
  servers: [
    {
      url: process.env.BACKEND_URL || 'http://localhost:5000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token (without Bearer prefix)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          stack: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'designer', 'production', 'customer'] },
          phone: { type: 'string' },
          address: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', format: 'password', example: 'password123' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string', format: 'password', example: 'password123' },
          phone: { type: 'string', example: '08123456789' },
          address: { type: 'string', example: 'Jl. Contoh No. 1' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      ProductVariant: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sku: { type: 'string' },
          color: { type: 'string' },
          size: { type: 'string' },
          priceB2C: { type: 'number' },
          priceB2B: { type: 'number' },
          stock: { type: 'number' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          sku: { type: 'string' },
          category: { type: 'string' },
          material: { type: 'string' },
          description: { type: 'string' },
          priceBase: { type: 'number' },
          priceB2C: { type: 'number' },
          priceB2B: { type: 'number' },
          stockPolos: { type: 'number' },
          minStockAlert: { type: 'number' },
          minOrder: { type: 'number' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                publicId: { type: 'string' },
                alt: { type: 'string' },
              },
            },
          },
          variants: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProductVariant' },
          },
          addons: {
            type: 'object',
            properties: {
              valvePrice: { type: 'number' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderDetails: {
        type: 'object',
        properties: {
          quantity: { type: 'number' },
          variantId: { type: 'string' },
          sku: { type: 'string' },
          material: { type: 'string' },
          size: { type: 'string' },
          color: { type: 'string' },
          unitPrice: { type: 'number' },
          useValve: { type: 'boolean' },
        },
      },
      OrderBranding: {
        type: 'object',
        properties: {
          clientDesignUrl: { type: 'string' },
          mockupUrl: { type: 'string' },
          status: { type: 'string', enum: ['Pending', 'Reviewing', 'Revision', 'Approved'] },
          notes: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          orderNumber: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          details: { $ref: '#/components/schemas/OrderDetails' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
            description: 'Multi-item order items',
          },
          branding: { $ref: '#/components/schemas/OrderBranding' },
          status: { type: 'string', enum: ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed', 'Cancelled'] },
          totalPrice: { type: 'number' },
          isPaid: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          product: { type: 'string' },
          variantId: { type: 'string' },
          sku: { type: 'string' },
          material: { type: 'string' },
          size: { type: 'string' },
          color: { type: 'string' },
          unitPrice: { type: 'number' },
          quantity: { type: 'number' },
          useValve: { type: 'boolean' },
          subtotal: { type: 'number' },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID (single item)' },
          variantId: { type: 'string', description: 'Variant ID (single item)' },
          quantity: { type: 'number', description: 'Quantity (single item)' },
          useValve: { type: 'boolean', description: 'Use valve (single item)' },
          items: {
            type: 'array',
            description: 'Multi-item order',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string' },
                quantity: { type: 'number' },
                useValve: { type: 'boolean' },
              },
            },
          },
        },
      },
      CancelOrderRequest: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Alasan pembatalan' },
        },
      },
      OrderLog: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          order: { type: 'string' },
          action: { type: 'string' },
          oldValue: { type: 'string' },
          newValue: { type: 'string' },
          changedBy: { type: 'string' },
          note: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Warehouse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          location: { type: 'string' },
          type: { type: 'string', enum: ['Main', 'Retail'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateWarehouseRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Gudang Utama' },
          location: { type: 'string', example: 'Jl. Raya No. 1' },
          type: { type: 'string', enum: ['Main', 'Retail'], default: 'Main' },
        },
      },
      InventoryAdjustment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          product: { type: 'string' },
          variantId: { type: 'string' },
          variantSnapshot: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              color: { type: 'string' },
              size: { type: 'string' },
            },
          },
          warehouse: { type: 'string' },
          type: { type: 'string', enum: ['In', 'Out'] },
          quantity: { type: 'number' },
          reason: { type: 'string' },
          adjustedBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateAdjustmentRequest: {
        type: 'object',
        required: ['product', 'warehouse', 'type', 'quantity', 'reason'],
        properties: {
          product: { type: 'string' },
          variantId: { type: 'string' },
          warehouse: { type: 'string' },
          type: { type: 'string', enum: ['In', 'Out'] },
          quantity: { type: 'number' },
          reason: { type: 'string' },
        },
      },
      StockCard: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          product: { type: 'string' },
          variantId: { type: 'string' },
          variantSnapshot: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              color: { type: 'string' },
              size: { type: 'string' },
            },
          },
          warehouse: { type: 'string' },
          referenceType: { type: 'string', enum: ['Order', 'Adjustment', 'Return'] },
          referenceId: { type: 'string' },
          referenceNo: { type: 'string' },
          quantityChange: { type: 'number' },
          balanceAfter: { type: 'number' },
          note: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          invoiceNumber: { type: 'string' },
          order: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          issuedDate: { type: 'string', format: 'date-time' },
          dueDate: { type: 'string', format: 'date-time' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          subtotal: { type: 'number' },
          totalAmount: { type: 'number' },
          paidAmount: { type: 'number' },
          status: { type: 'string', enum: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue'] },
          notes: { type: 'string' },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateInvoiceRequest: {
        type: 'object',
        required: ['order', 'customer', 'product', 'quantity', 'unitPrice', 'subtotal', 'totalAmount', 'dueDate'],
        properties: {
          order: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          subtotal: { type: 'number' },
          totalAmount: { type: 'number' },
          dueDate: { type: 'string', format: 'date' },
          notes: { type: 'string' },
        },
      },
      PaymentReceived: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          paymentNumber: { type: 'string' },
          invoice: { type: 'string' },
          order: { type: 'string' },
          customer: { type: 'string' },
          amount: { type: 'number' },
          paymentDate: { type: 'string', format: 'date-time' },
          method: { type: 'string', enum: ['Cash', 'Bank Transfer', 'QRIS', 'Giro', 'Other'] },
          referenceNo: { type: 'string' },
          notes: { type: 'string' },
          receivedBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreatePaymentRequest: {
        type: 'object',
        required: ['invoice', 'order', 'customer', 'amount'],
        properties: {
          invoice: { type: 'string' },
          order: { type: 'string' },
          customer: { type: 'string' },
          amount: { type: 'number' },
          paymentDate: { type: 'string', format: 'date' },
          method: { type: 'string', enum: ['Cash', 'Bank Transfer', 'QRIS', 'Giro', 'Other'] },
          referenceNo: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      SalesReturn: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          returnNumber: { type: 'string' },
          order: { type: 'string' },
          invoice: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          warehouse: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          totalAmount: { type: 'number' },
          reason: { type: 'string' },
          notes: { type: 'string' },
          returnDate: { type: 'string', format: 'date-time' },
          restocked: { type: 'boolean' },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateSalesReturnRequest: {
        type: 'object',
        required: ['order', 'customer', 'product', 'quantity', 'unitPrice', 'totalAmount', 'reason'],
        properties: {
          order: { type: 'string' },
          invoice: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          warehouse: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          totalAmount: { type: 'number' },
          reason: { type: 'string' },
          notes: { type: 'string' },
          returnDate: { type: 'string', format: 'date' },
          restocked: { type: 'boolean', default: true },
        },
      },
      ProductionTask: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          order: { type: 'string' },
          taskNumber: { type: 'string' },
          status: { type: 'string', enum: ['Pending', 'InProgress', 'Review', 'Completed', 'Cancelled'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
          assignedTeam: { type: 'string' },
          assignedTo: { type: 'string' },
          notes: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateProductionTaskRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Pending', 'InProgress', 'Review', 'Completed', 'Cancelled'] },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
          assignedTeam: { type: 'string' },
          assignedTo: { type: 'string' },
          notes: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          customer: { type: 'string' },
          product: { type: 'string' },
          order: { type: 'string' },
          subject: { type: 'string' },
          status: { type: 'string', enum: ['Open', 'Replied', 'Closed'] },
          lastMessageAt: { type: 'string', format: 'date-time' },
          lastMessagePreview: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateConversationRequest: {
        type: 'object',
        required: ['subject'],
        properties: {
          subject: { type: 'string', example: 'Pertanyaan tentang produk' },
          product: { type: 'string', description: 'Product ID' },
          order: { type: 'string', description: 'Order ID' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          conversation: { type: 'string' },
          sender: { type: 'string' },
          text: { type: 'string' },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SendMessageRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', example: 'Halo, saya tertarik dengan produk ini' },
        },
      },
      LandingContent: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          key: { type: 'string' },
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                title: { type: 'string' },
                date: { type: 'string' },
                excerpt: { type: 'string' },
                content: { type: 'string' },
                imageUrl: { type: 'string' },
                imagePublicId: { type: 'string' },
                imageAlt: { type: 'string' },
              },
            },
          },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                title: { type: 'string' },
                date: { type: 'string' },
                location: { type: 'string' },
                summary: { type: 'string' },
                accent: { type: 'string' },
                imageUrl: { type: 'string' },
                imagePublicId: { type: 'string' },
                imageAlt: { type: 'string' },
              },
            },
          },
          portfolios: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                clientName: { type: 'string' },
                title: { type: 'string' },
                category: { type: 'string' },
                description: { type: 'string' },
                imageUrl: { type: 'string' },
                imagePublicId: { type: 'string' },
              },
            },
          },
          articleSectionConfig: {
            type: 'object',
            properties: {
              pillText: { type: 'string' },
              title: { type: 'string' },
              subtitle: { type: 'string' },
            },
          },
          gallerySectionConfig: {
            type: 'object',
            properties: {
              pillText: { type: 'string' },
              title: { type: 'string' },
              subtitle: { type: 'string' },
            },
          },
          portfolioSectionConfig: {
            type: 'object',
            properties: {
              pillText: { type: 'string' },
              title: { type: 'string' },
              subtitle: { type: 'string' },
            },
          },
          aboutSection: {
            type: 'object',
            properties: {
              isVisible: { type: 'boolean' },
              title: { type: 'string' },
              description: { type: 'string' },
              imageUrl: { type: 'string' },
              imagePublicId: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DashboardStats: {
        type: 'object',
        properties: {
          totalProducts: { type: 'number' },
          totalOrders: { type: 'number' },
          totalRevenue: { type: 'number' },
          totalCustomers: { type: 'number' },
          ordersByStatus: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
          recentOrders: {
            type: 'array',
            items: { $ref: '#/components/schemas/Order' },
          },
        },
      },
      SalesOverview: {
        type: 'object',
        properties: {
          totalRevenue: { type: 'number' },
          totalInvoices: { type: 'number' },
          totalPaid: { type: 'number' },
          totalOutstanding: { type: 'number' },
          revenueByPeriod: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                period: { type: 'string' },
                revenue: { type: 'number' },
              },
            },
          },
        },
      },
      PaymentSummary: {
        type: 'object',
        properties: {
          order: { $ref: '#/components/schemas/Order' },
          totalPrice: { type: 'number' },
          paidAmount: { type: 'number' },
          remainingAmount: { type: 'number' },
          isPaid: { type: 'boolean' },
          payments: {
            type: 'array',
            items: { $ref: '#/components/schemas/PaymentReceived' },
          },
        },
      },
      MidtransTokenResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          redirectUrl: { type: 'string' },
        },
      },
      WebhookPayload: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'API is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'API is Running' },
                    url: { type: 'string' },
                    frontendUrl: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: { description: 'Validation error' },
          429: { description: 'Too many requests (rate limited)' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: { description: 'Invalid credentials' },
          429: { description: 'Too many requests (rate limited)' },
        },
      },
    },
    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'User profile',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
      put: {
        tags: ['Auth'],
        summary: 'Update current user profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  address: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Profile updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/auth/password': {
      put: {
        tags: ['Auth'],
        summary: 'Change password',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', format: 'password' },
                  newPassword: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password changed successfully' },
          401: { description: 'Current password is incorrect' },
        },
      },
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Get all products',
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Search by name',
          },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by category',
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    products: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Product' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name', 'category', 'material', 'priceB2C', 'priceB2B', 'variants'],
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  material: { type: 'string' },
                  description: { type: 'string' },
                  minStockAlert: { type: 'number' },
                  minOrder: { type: 'number' },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Product images (JPEG, PNG, WebP, AVIF, GIF)',
                  },
                  variants: { type: 'string', description: 'JSON string of variants array' },
                  addons: { type: 'string', description: 'JSON string of addons object' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Product created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/products/popular': {
      get: {
        tags: ['Products'],
        summary: 'Get popular products',
        responses: {
          200: {
            description: 'Popular products',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
        },
      },
    },
    '/api/products/low-stock': {
      get: {
        tags: ['Products'],
        summary: 'Get low stock products',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Low stock products',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/products/export': {
      get: {
        tags: ['Products'],
        summary: 'Export products to Excel',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Excel file download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Product details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          404: { description: 'Product not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update a product',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  material: { type: 'string' },
                  description: { type: 'string' },
                  minStockAlert: { type: 'number' },
                  minOrder: { type: 'number' },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                  variants: { type: 'string', description: 'JSON string of variants array' },
                  addons: { type: 'string', description: 'JSON string of addons object' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Product updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete a product',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Product deleted' },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
          404: { description: 'Product not found' },
        },
      },
    },
    '/api/dashboard/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get admin dashboard statistics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Dashboard stats',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardStats' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/dashboard/categories': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get category analytics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Category analytics',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      count: { type: 'number' },
                      totalStock: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/orders/myorders': {
      get: {
        tags: ['Orders'],
        summary: 'Get current user orders',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'User orders',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Order' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create a new order',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['product', 'details'],
                properties: {
                  product: { type: 'string', description: 'Product ID' },
                  details: { type: 'string', description: 'JSON string of order details' },
                  design: { type: 'string', format: 'binary', description: 'Design file (image)' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Order created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'Get all orders (admin)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'All orders',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Order' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/orders/{id}/cancel': {
      put: {
        tags: ['Orders'],
        summary: 'Cancel order (customer)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CancelOrderRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Order cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
          400: { description: 'Order cannot be cancelled' },
          401: { description: 'Not authorized' },
          403: { description: 'Access denied' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Order details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          401: { description: 'Not authorized' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/status': {
      put: {
        tags: ['Orders'],
        summary: 'Update order status',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['Quotation', 'Payment', 'Production', 'Quality Control', 'Shipping', 'Completed'],
                  },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Order status updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/orders/{id}/design': {
      put: {
        tags: ['Orders'],
        summary: 'Update order design (upload mockup)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  mockup: { type: 'string', format: 'binary', description: 'Mockup image' },
                  brandingStatus: {
                    type: 'string',
                    enum: ['Pending', 'Reviewing', 'Revision', 'Approved'],
                  },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Order design updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/orders/{id}/logs': {
      get: {
        tags: ['Orders'],
        summary: 'Get order activity logs',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Order logs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/OrderLog' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/customers': {
      get: {
        tags: ['Customers'],
        summary: 'Get all customers',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Search by name or email',
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of customers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customers: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/customers/export': {
      get: {
        tags: ['Customers'],
        summary: 'Export customers to Excel',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Excel file download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/inventory/products': {
      get: {
        tags: ['Inventory'],
        summary: 'Get product options for inventory',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Product options',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      _id: { type: 'string' },
                      name: { type: 'string' },
                      sku: { type: 'string' },
                      variants: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ProductVariant' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/inventory/warehouses': {
      get: {
        tags: ['Inventory'],
        summary: 'Get all warehouses',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'List of warehouses',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Warehouse' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Create a warehouse',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWarehouseRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Warehouse created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Warehouse' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/inventory/warehouses/{id}': {
      put: {
        tags: ['Inventory'],
        summary: 'Update a warehouse',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  location: { type: 'string' },
                  type: { type: 'string', enum: ['Main', 'Retail'] },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Warehouse updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Warehouse' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
      delete: {
        tags: ['Inventory'],
        summary: 'Delete a warehouse',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Warehouse deleted' },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/inventory/adjustments': {
      post: {
        tags: ['Inventory'],
        summary: 'Create inventory adjustment',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAdjustmentRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Adjustment created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InventoryAdjustment' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/inventory/stock-cards/{productId}': {
      get: {
        tags: ['Inventory'],
        summary: 'Get stock card by product',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'warehouse',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by warehouse ID',
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          200: {
            description: 'Stock card entries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/StockCard' },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/sales/overview': {
      get: {
        tags: ['Sales'],
        summary: 'Get sales overview',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            schema: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
            description: 'Reporting period',
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          200: {
            description: 'Sales overview',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SalesOverview' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/sales/overview/export': {
      get: {
        tags: ['Sales'],
        summary: 'Export sales overview to Excel',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          200: {
            description: 'Excel file download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/sales/invoices': {
      get: {
        tags: ['Sales'],
        summary: 'Get all invoices',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue'] },
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of invoices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    invoices: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Invoice' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
      post: {
        tags: ['Sales'],
        summary: 'Create an invoice',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateInvoiceRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Invoice created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/sales/invoices/export': {
      get: {
        tags: ['Sales'],
        summary: 'Export invoices to Excel',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          200: {
            description: 'Excel file download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/sales/payments': {
      get: {
        tags: ['Sales'],
        summary: 'Get all payments received',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'method',
            in: 'query',
            schema: { type: 'string', enum: ['Cash', 'Bank Transfer', 'QRIS', 'Giro', 'Other'] },
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of payments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PaymentReceived' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
      post: {
        tags: ['Sales'],
        summary: 'Record a payment received',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePaymentRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Payment recorded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentReceived' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/sales/returns': {
      get: {
        tags: ['Sales'],
        summary: 'Get all sales returns',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of sales returns',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    returns: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SalesReturn' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
      post: {
        tags: ['Sales'],
        summary: 'Create a sales return',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSalesReturnRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Sales return created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SalesReturn' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/payments/midtrans/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Midtrans payment webhook handler',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transaction_status: { type: 'string' },
                  order_id: { type: 'string' },
                  gross_amount: { type: 'string' },
                  signature_key: { type: 'string' },
                  transaction_id: { type: 'string' },
                  payment_type: { type: 'string' },
                  transaction_time: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Webhook processed successfully' },
          400: { description: 'Invalid webhook payload' },
        },
      },
    },
    '/api/payments/orders/{orderId}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment summary for an order',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Payment summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentSummary' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/payments/orders/{orderId}/midtrans/token': {
      post: {
        tags: ['Payments'],
        summary: 'Create Midtrans Snap token for an order',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Snap token created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MidtransTokenResponse' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/landing-content': {
      get: {
        tags: ['Landing Content'],
        summary: 'Get landing page content',
        responses: {
          200: {
            description: 'Landing page content',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LandingContent' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Landing Content'],
        summary: 'Update landing page content',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  articles: { type: 'string', description: 'JSON string of articles array' },
                  activities: { type: 'string', description: 'JSON string of activities array' },
                  portfolios: { type: 'string', description: 'JSON string of portfolios array' },
                  articleSectionConfig: { type: 'string', description: 'JSON string' },
                  gallerySectionConfig: { type: 'string', description: 'JSON string' },
                  portfolioSectionConfig: { type: 'string', description: 'JSON string' },
                  aboutSection: { type: 'string', description: 'JSON string' },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Upload images for articles, activities, portfolios',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Landing content updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LandingContent' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/webhooks/erp-order': {
      post: {
        tags: ['Webhooks'],
        summary: 'Receive ERP order from external system',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookPayload' },
            },
          },
        },
        responses: {
          200: { description: 'Order received successfully' },
          400: { description: 'Invalid payload' },
        },
      },
    },
    '/api/production-tasks/stats': {
      get: {
        tags: ['Production Tasks'],
        summary: 'Get production task statistics',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Task statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    pending: { type: 'number' },
                    inProgress: { type: 'number' },
                    review: { type: 'number' },
                    completed: { type: 'number' },
                    cancelled: { type: 'number' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/production-tasks/daily-summary': {
      post: {
        tags: ['Production Tasks'],
        summary: 'Send daily production summary',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Daily summary sent' },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/production-tasks/auto-cancel': {
      post: {
        tags: ['Production Tasks'],
        summary: 'Auto-cancel unpaid orders',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Unpaid orders cancelled' },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/production-tasks': {
      get: {
        tags: ['Production Tasks'],
        summary: 'Get all production tasks',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['Pending', 'InProgress', 'Review', 'Completed', 'Cancelled'] },
          },
          {
            name: 'priority',
            in: 'query',
            schema: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of production tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tasks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ProductionTask' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/production-tasks/{id}': {
      get: {
        tags: ['Production Tasks'],
        summary: 'Get production task by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Task details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductionTask' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
          404: { description: 'Task not found' },
        },
      },
      put: {
        tags: ['Production Tasks'],
        summary: 'Update a production task',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductionTaskRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Task updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductionTask' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/api/conversations': {
      post: {
        tags: ['Conversations'],
        summary: 'Create a new conversation',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateConversationRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Conversation created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Conversation' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
      get: {
        tags: ['Conversations'],
        summary: 'List user conversations',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['Open', 'Replied', 'Closed'] },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of conversations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    conversations: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Conversation' },
                    },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/conversations/{id}': {
      get: {
        tags: ['Conversations'],
        summary: 'Get conversation by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Conversation details with messages',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    conversation: { $ref: '#/components/schemas/Conversation' },
                    messages: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Message' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Not authorized' },
          404: { description: 'Conversation not found' },
        },
      },
    },
    '/api/conversations/{id}/messages': {
      post: {
        tags: ['Conversations'],
        summary: 'Send a message in a conversation',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SendMessageRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Message sent',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Message' },
              },
            },
          },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/conversations/{id}/read': {
      put: {
        tags: ['Conversations'],
        summary: 'Mark conversation as read',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Conversation marked as read' },
          401: { description: 'Not authorized' },
        },
      },
    },
    '/api/conversations/{id}/status': {
      put: {
        tags: ['Conversations'],
        summary: 'Update conversation status',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['Open', 'Replied', 'Closed'] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Conversation status updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Conversation' },
              },
            },
          },
          401: { description: 'Not authorized' },
          403: { description: 'Admin only' },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
