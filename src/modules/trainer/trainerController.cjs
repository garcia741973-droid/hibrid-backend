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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Status requerido'
      });
    }

    if (req.user.company_type !== 'trainer') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const validStatus = ['scheduled', 'completed', 'cancelled'];

    if (!validStatus.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Status inválido'
      });
    }

    // 🔥 1. TRAER SESIÓN ACTUAL
    const sessionRes = await client.query(
      `
      SELECT id, client_id, status
      FROM trainer_sessions
      WHERE id = $1
        AND company_id = $2
      `,
      [id, req.user.company_id]
    );

    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Sesión no encontrada'
      });
    }

    const session = sessionRes.rows[0];

    // 🔥 2. ACTUALIZAR ESTADO DE LA SESIÓN
    const updateRes = await client.query(
      `
      UPDATE trainer_sessions
      SET status = $1
      WHERE id = $2
        AND company_id = $3
      RETURNING *
      `,
      [status, id, req.user.company_id]
    );

    const updatedSession = updateRes.rows[0];

    // 🔥 3. SI PASA A COMPLETED Y TIENE CLIENTE → DESCONTAR 1 SESIÓN
    if (
      status === 'completed' &&
      session.status !== 'completed' &&
      session.client_id
    ) {
      const pkgRes = await client.query(
        `
        SELECT id, sessions_total, sessions_used, status
        FROM trainer_client_packages
        WHERE client_id = $1
          AND company_id = $2
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [session.client_id, req.user.company_id]
      );

      if (pkgRes.rows.length === 0) {
        throw new Error('Cliente no tiene paquete activo');
      }

      const pkg = pkgRes.rows[0];
      const newUsed = Number(pkg.sessions_used) + 1;
      const newStatus = newUsed >= Number(pkg.sessions_total)
        ? 'completed'
        : 'active';

      await client.query(
        `
        UPDATE trainer_client_packages
        SET
          sessions_used = $1,
          status = $2
        WHERE id = $3
          AND company_id = $4
        `,
        [newUsed, newStatus, pkg.id, req.user.company_id]
      );
    }

    await client.query('COMMIT');

    res.json(updatedSession);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({
      error: err.message || 'Error actualizando sesión'
    });
  } finally {
    client.release();
  }
};