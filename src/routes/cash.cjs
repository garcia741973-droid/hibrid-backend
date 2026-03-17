const express = require('express');
const router = express.Router();
const { pool } = require('../db.js');
const { requireAuth } = require('../routes/auth.cjs');


// =========================
// ➕ ADD EXPENSE (GASTO)
// =========================
router.post('/add-expense', requireAuth, async (req, res) => {
  try {
    const { amount, description, category_id } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, category_id, created_by_role)
      VALUES ('expense', 'manual', $1, $2, $3, $4, $5)
      `,
      [
        amount,
        req.user.id,
        description || '',
        category_id || null,
        req.user.role
      ]
    );

    res.json({ message: 'Gasto registrado correctamente' });

  } catch (err) {
    console.error('ADD EXPENSE ERROR:', err);
    res.status(500).json({ error: 'Error registrando gasto' });
  }
});


// =========================
// ➕ ADD INCOME (INGRESO)
// =========================
router.post('/add-income', requireAuth, async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, created_by_role)
      VALUES ('income', 'manual', $1, $2, $3, $4)
      `,
      [
        amount,
        req.user.id,
        description || '',
        req.user.role
      ]
    );

    res.json({ message: 'Ingreso registrado correctamente' });

  } catch (err) {
    console.error('ADD INCOME ERROR:', err);
    res.status(500).json({ error: 'Error registrando ingreso' });
  }
});


// =========================
// 📊 REPORT (RESUMEN CAJA)
// =========================
router.get('/report', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Fechas requeridas (from, to)' });
    }

    const result = await pool.query(
      `
      SELECT 
        type,
        COALESCE(SUM(amount),0) as total,
        COUNT(*) as movements
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
    console.error('REPORT ERROR:', err);
    res.status(500).json({ error: 'Error obteniendo reporte' });
  }
});


// =========================
// 📜 MOVEMENTS (LISTADO)
// =========================
router.get('/movements', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT cm.*, ec.name as category_name, u.name as staff_name
      FROM cash_movements cm
      LEFT JOIN expense_categories ec ON cm.category_id = ec.id
      LEFT JOIN users u ON cm.staff_id = u.id
    `;

    const params = [];

    if (from && to) {
      query += ` WHERE cm.created_at BETWEEN $1 AND $2`;
      params.push(from, to);
    }

    query += ` ORDER BY cm.created_at DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (err) {
    console.error('MOVEMENTS ERROR:', err);
    res.status(500).json({ error: 'Error obteniendo movimientos' });
  }
});


// =========================
// 📦 CATEGORIES (GASTOS)
// =========================
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM expense_categories ORDER BY name`
    );

    res.json(result.rows);

  } catch (err) {
    console.error('CATEGORIES ERROR:', err);
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
});


module.exports = router;