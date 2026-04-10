const express = require('express');
const router = express.Router();

const storeController = require('./storeController.cjs');

const requireAuth = require('../../middlewares/requireAuth.cjs');
const requireAdminModule = require('../../middlewares/requireAdmin.cjs');

const requireAdmin = requireAdminModule.default || requireAdminModule;


/// PRODUCTOS

router.get('/products', requireAuth, storeController.getProducts);

router.post('/products', requireAuth, requireAdmin, storeController.createProduct);

router.put('/products/:id', requireAuth, requireAdmin, storeController.updateProduct);

/// VENTAS

router.post('/sales', requireAuth, storeController.createSale);


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
  storeController.getInventoryReport
);

module.exports = router;