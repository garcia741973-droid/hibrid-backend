const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const requireAuth = require('../middlewares/requireAuth.cjs');

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// =========================
// ➕ ADD EXPENSE (GASTO)
// =========================
router.post('/add-expense', requireAuth, async (req, res) => {
  try {
    const { amount, description, category_id } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    const company_id = req.user.company_id;

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, category_id, created_by_role, company_id)
      VALUES ('expense', 'manual', $1, $2, $3, $4, $5, $6)
      `,
      [
        amount,
        req.user.id,
        description || '',
        category_id || null,
        req.user.role,
        company_id
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

    const company_id = req.user.company_id;

    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, amount, staff_id, description, created_by_role, company_id)
      VALUES ('income', 'manual', $1, $2, $3, $4, $5)
      `,
      [
        amount,
        req.user.id,
        description || '',
        req.user.role,
        company_id
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

    const company_id = req.user.company_id;

    const result = await pool.query(
      `
      SELECT 
        type,
        COALESCE(SUM(amount),0) as total,
        COUNT(*) as movements
      FROM cash_movements
      WHERE company_id = $1
      AND DATE(created_at) BETWEEN DATE($2) AND DATE($3)
      GROUP BY type
      `,
      [company_id, from, to]
    );

    let income = 0;
    let expense = 0;

    result.rows.forEach(r => {

      if (r.type === 'income' || r.type === 'IN') {
        income += Number(r.total);
      }

      if (r.type === 'expense' || r.type === 'OUT') {
        expense += Number(r.total);
      }

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

    const company_id = req.user.company_id;

    let query = `
      SELECT cm.*, ec.name as category_name, u.name as staff_name
      FROM cash_movements cm
      LEFT JOIN expense_categories ec ON cm.category_id = ec.id
      LEFT JOIN users u ON cm.staff_id = u.id
      WHERE cm.company_id = $1
    `;

    const params = [company_id];

    if (from && to) {
      query += ` AND DATE(cm.created_at) BETWEEN DATE($2) AND DATE($3)`;
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
      const company_id = req.user.company_id;

      const result = await pool.query(
        `
        SELECT * FROM expense_categories
        WHERE company_id = $1
        ORDER BY name
        `,
        [company_id]
      );

    res.json(result.rows);

  } catch (err) {
    console.error('CATEGORIES ERROR:', err);
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
});

// =========================
// 📥 EXPORT EXCEL
// =========================
router.get('/export.xlsx', requireAuth, async (req, res) => {
  try {

    const { from, to } = req.query;
    const company_id = req.user.company_id;

    const result = await pool.query(
      `
      SELECT cm.*, ec.name as category_name
      FROM cash_movements cm
      LEFT JOIN expense_categories ec ON cm.category_id = ec.id
      WHERE cm.company_id = $1
      AND DATE(cm.created_at) BETWEEN DATE($2) AND DATE($3)
      ORDER BY cm.created_at DESC
      `,
      [company_id, from, to]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Caja');

    sheet.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Monto', key: 'amount', width: 15 },
    ];

    result.rows.forEach(m => {

      const tipo =
        (m.type === 'income' || m.type === 'IN') ? 'Ingreso' : 'Egreso';

      sheet.addRow({
        date: m.created_at,
        type: tipo,
        category: m.category_name || '',
        description: m.description || '',
        amount: m.amount
      });

    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte_caja.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('EXPORT EXCEL ERROR:', err);
    res.status(500).json({ error: 'Error exportando Excel' });
  }
});

// =========================
// 📥 EXPORT PDF
// =========================
router.get('/export.pdf', requireAuth, async (req, res) => {
  try {

    const { from, to } = req.query;
    const company_id = req.user.company_id;

    const result = await pool.query(
      `
      SELECT cm.*, ec.name as category_name
      FROM cash_movements cm
      LEFT JOIN expense_categories ec ON cm.category_id = ec.id
      WHERE cm.company_id = $1
      AND DATE(cm.created_at) BETWEEN DATE($2) AND DATE($3)
      ORDER BY cm.created_at DESC
      `,
      [company_id, from, to]
    );

    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte_caja.pdf'
    );

    doc.pipe(res);

    doc.fontSize(18).text('Reporte de Caja', { align: 'center' });
    doc.moveDown();

    result.rows.forEach(m => {

      const tipo =
        (m.type === 'income' || m.type === 'IN') ? 'Ingreso' : 'Egreso';

      doc.fontSize(10).text(
        `${m.created_at} | ${tipo} | ${m.amount} Bs`
      );

    });

    doc.end();

  } catch (err) {
    console.error('EXPORT PDF ERROR:', err);
    res.status(500).json({ error: 'Error exportando PDF' });
  }
});


module.exports = router;