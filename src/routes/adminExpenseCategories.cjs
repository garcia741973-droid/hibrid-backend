const express = require('express');
const router = express.Router();

const controller = require('../controllers/adminExpenseCategoryController.cjs');
const requireAuth = require('../middlewares/requireAuth.cjs');
const requireRole = require('../middlewares/requireRole.cjs');

/// CREAR
router.post('/expense-categories',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.createCategory
);

/// LISTAR
router.get('/expense-categories',
  requireAuth,
  controller.getCategories
);

/// TOGGLE
router.patch('/expense-categories/:id/toggle',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.toggleCategory
);

router.put('/expense-categories/:id',
  requireAuth,
  requireRole(["admin","superadmin"]),
  controller.updateCategory
);

module.exports = router;