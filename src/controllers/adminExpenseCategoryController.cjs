const { pool } = require('../config/db.cjs');

/// 🔹 CREAR CATEGORÍA
exports.createCategory = async (req, res) => {
  try {

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Nombre requerido"
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO expense_categories (name, description)
      VALUES ($1,$2)
      RETURNING *
      `,
      [name, description || null]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error creando categoría"
    });
  }
};


/// 🔹 LISTAR CATEGORÍAS
exports.getCategories = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM expense_categories
      WHERE is_active = true
      ORDER BY name ASC
      `
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo categorías"
    });
  }
};


/// 🔹 TOGGLE (ACTIVAR / DESACTIVAR)
exports.toggleCategory = async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      `
      UPDATE expense_categories
      SET is_active = NOT is_active
      WHERE id = $1
      `,
      [id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error actualizando categoría"
    });
  }
};