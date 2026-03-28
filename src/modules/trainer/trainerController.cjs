const { pool } = require('../../config/db');

// =============================
// 🔥 CREAR SESIÓN
// =============================
exports.createSession = async (req, res) => {
  try {
    const {
      client_id,
      title,
      notes,
      session_date,
      start_time,
      end_time
    } = req.body;

    if (!session_date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios'
      });
    }

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    if (end_time <= start_time) {
    return res.status(400).json({
        error: 'Hora fin debe ser mayor a inicio'
    });
    }    

    const { rows } = await pool.query(
      `
      INSERT INTO trainer_sessions
      (
        company_id,
        trainer_id,
        client_id,
        title,
        notes,
        session_date,
        start_time,
        end_time
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        req.user.company_id,
        req.user.id,
        client_id || null,
        title || '',
        notes || '',
        session_date,
        start_time,
        end_time
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error creando sesión'
    });
  }
};

// =============================
// 🔥 LISTAR SESIONES
// =============================
exports.getSessions = async (req, res) => {
  try {
    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      SELECT *
      FROM trainer_sessions
      WHERE company_id = $1
      ORDER BY session_date ASC, start_time ASC
      `,
      [req.user.company_id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo sesiones'
    });
  }
};

// =============================
// 🔥 ACTUALIZAR ESTADO
// =============================
exports.updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status requerido'
      });
    }

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const validStatus = ['scheduled', 'completed', 'cancelled'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido'
      });
    }

    const { rows } = await pool.query(
      `
      UPDATE trainer_sessions
      SET status = $1
      WHERE id = $2
        AND company_id = $3
      RETURNING *
      `,
      [status, id, req.user.company_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Sesión no encontrada'
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error actualizando sesión'
    });
  }
};