const express = require('express');
const router = express.Router();

const storeController = require('./storeController.cjs');
const requireAuth = require('../../middlewares/requireAuth.cjs');

// productos
router.get('/products', requireAuth, storeController.getProducts);
router.post('/products', requireAuth, storeController.createProduct);

// ventas
router.post('/sales', requireAuth, storeController.createSale);

// cancelar venta
router.put('/sales/:id/cancel', requireAuth, storeController.cancelSale);

module.exports = router;