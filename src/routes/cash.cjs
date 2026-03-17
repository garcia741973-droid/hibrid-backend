const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');


// =========================
// ➕ ADD EXPENSE
// =========================
router.post('/add-expense', requireAuth, async (req, res) => {
  try {
    const { amount, description, category } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, category, created_by_role)
      VALUES ('expense', 'manual', $1, $2, $3, $4, $5)
      `,
      [
        amount,
        req.user.id,
        description || '',
        category || '',
        req.user.role
      ]
    );

    res.json({ message: 'Gasto registrado' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando gasto' });
  }
});


// =========================
// ➕ ADD INCOME
// =========================
router.post('/add-income', requireAuth, async (req, res) => {
  try {
    const { amount, description, category } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, category, created_by_role)
      VALUES ('income', 'manual', $1, $2, $3, $4, $5)
      `,
      [
        amount,
        req.user.id,
        description || '',
        category || '',
        req.user.role
      ]
    );

    res.json({ message: 'Ingreso registrado' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando ingreso' });
  }
});


// =========================
// 📊 REPORT
// =========================
router.get('/report', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const result = await pool.query(
      `
      SELECT 
        type,
        COALESCE(SUM(amount),0) as total
      FROM cash_movements
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY type
      `,
      [from, to]
    );

    let income = 0;
    let expense = 0;

    result.rows.forEach(r => {
      if (r.type === 'income') income = Number(r.total);
      if (r.type === 'expense') expense = Number(r.total);
    });

    res.json({
      total_income: income,
      total_expense: expense,
      net: income - expense
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo reporte' });
  }
});


// =========================
// 📜 MOVEMENTS
// =========================
router.get('/movements', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const result = await pool.query(
      `
      SELECT *
      FROM cash_movements
      WHERE created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
      `,
      [from, to]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo movimientos' });
  }
});

module.exports = router;