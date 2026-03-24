const { pool } = require('../config/db.cj');

exports.createMembershipRequest = async (req, res) => {

  try {

    const user_id = req.user.id;   // viene del middleware requireAuth
    const { plan_id } = req.body;

    // Verificar si ya existe solicitud pendiente
    const existing = await pool.query(
      `
      SELECT id
      FROM membership_requests
      WHERE user_id = $1
      AND status = 'pending'
      `,
      [user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "Ya tienes una solicitud de membresía pendiente"
      });
    }

    // Crear solicitud
    const { rows } = await pool.query(
      `
      INSERT INTO membership_requests
      (user_id, plan_id, status)
      VALUES ($1,$2,'pending')
      RETURNING *
      `,
      [user_id, plan_id]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error creando solicitud de membresía"
    });

  }

};