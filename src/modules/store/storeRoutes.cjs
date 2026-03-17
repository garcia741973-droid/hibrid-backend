const express = require('express');
const router = express.Router();

const storeController = require('./storeController.cjs');

const requireAuth = require('../../middlewares/requireAuth.cjs');
const requireAdminModule = require('../../middlewares/requireAdmin.cjs');

const requireAdmin = requireAdminModule.default || requireAdminModule;


/// PRODUCTOS

router.get('/products', requireAuth, storeController.getProducts);

router.post('/products', requireAdmin, storeController.createProduct);

router.put('/products/:id', requireAdmin, storeController.updateProduct);

router.post(
  '/upload-image',
  requireAuth,
  requireAdmin,
  storeController.uploadMiddleware,
  storeController.uploadImage
);

/// VENTAS

router.post('/sales', requireAuth, storeController.createSale);


/// CANCELAR VENTA

router.put('/sales/:id/cancel', requireAdmin, storeController.cancelSale);

module.exports = router;