const express = require('express');
const router = express.Router();

const storeController = require('./storeController.cjs');

const requireAuth = require('../../middlewares/requireAuth.cjs');
const requireRole = require('../../middlewares/requireRole.cjs');
const requireAdminModule = require('../../middlewares/requireAdmin.cjs');

const requireAdmin = requireAdminModule.default || requireAdminModule;


/// PRODUCTOS

router.get('/products', requireAuth, storeController.getProducts);

router.post('/products', requireAuth, requireAdmin, storeController.createProduct);

router.put('/products/:id', requireAuth, requireAdmin, storeController.updateProduct);

router.delete(
  '/products/:id',
  requireAuth,
  requireAdmin,
  storeController.deleteProduct
);

/// VENTAS

router.post(
  '/sales',
  requireAuth,
  requireRole(['staff', 'admin', 'superadmin']),
  storeController.createSale
);


/// CANCELAR VENTA

router.put(
  '/sales/:id/cancel',
  requireAuth,        // 🔥 FALTABA
  requireAdmin,
  storeController.cancelSale
);

router.post(
  '/stock/add',
  requireAuth,
  requireAdmin,
  storeController.addStock
);

router.get(
  '/products/:id/history',
  requireAuth,
  requireAdmin,
  storeController.getProductHistory
);

router.get(
  '/inventory/report',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  storeController.getInventoryReport
);

router.get(
  '/inventory/export-full.xlsx',
  requireAuth,
  requireRole(['admin', 'superadmin']),
  storeController.exportInventoryExcel
);

module.exports = router;