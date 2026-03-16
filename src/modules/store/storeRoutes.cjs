const express = require('express');
const router = express.Router();

const storeController = require('./storeController.cjs');

const requireAuth = require('../../middlewares/requireAuth.cjs');
const requireAdmin = require('../../middlewares/requireAdmin.cjs');

/// PRODUCTOS

router.get('/products', requireAuth, storeController.getProducts);

router.post('/products', requireAdmin, storeController.createProduct);

router.put('/products/:id', requireAdmin, storeController.updateProduct);


/// VENTAS

router.post('/sales', requireAuth, storeController.createSale);


/// CANCELAR VENTA

router.put('/sales/:id/cancel', requireAdmin, storeController.cancelSale);

module.exports = router;