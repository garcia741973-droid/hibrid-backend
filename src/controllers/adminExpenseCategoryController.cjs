const { pool } = require('../config/db');

/// 🔹 CREAR CATEGORÍA
exports.createCategory = async (req, res) => {
  try {

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Nombre requerido"
      });
    }

    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `
      INSERT INTO expense_categories (name, description, company_id)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [name, description || null, company_id]
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

    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `
      SELECT *
      FROM expense_categories
      WHERE is_active = true
      AND company_id = $1
      ORDER BY name ASC
      `,
      [company_id]
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

    const company_id = req.user.company_id;

      await pool.query(
        `
        UPDATE expense_categories
        SET is_active = NOT is_active
        WHERE id = $1
        AND company_id = $2
        `,
        [id, company_id]
      );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error actualizando categoría"
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {

    const { id } = req.params;
    const { name, description } = req.body;
    const company_id = req.user.company_id;

    await pool.query(
      `
      UPDATE expense_categories
      SET name = $1,
          description = $2
      WHERE id = $3
        AND company_id = $4
      `,
      [name, description, id, company_id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando categoría" });
  }
};