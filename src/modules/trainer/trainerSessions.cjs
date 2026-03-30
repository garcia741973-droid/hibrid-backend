const { pool } = require('../../config/db');

/// 🔹 CREAR SESIONES
exports.createSessions = async (req, res) => {
  try {

    const { user_id, sessions_total, expiration_date, start_date } = req.body;
    const company_id = req.user.company_id;

    if (!start_date) {
      return res.status(400).json({
        error: "Fecha de inicio requerida"
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO trainer_client_packages
        (user_id, sessions_total, remaining_sessions, expiration_date, company_id, start_date)
        VALUES ($1,$2,$2,$3,$4,$5)
        RETURNING *
      `,
      [user_id, sessions_total, expiration_date || null, company_id, start_date]
    );

    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({ error: "Error creando sesiones" });
  }
};


/// 🔹 VER SESIONES DE CLIENTE
exports.getClientSessions = async (req, res) => {

  const { user_id } = req.params;
  const company_id = req.user.company_id;

  const { rows } = await pool.query(
    `
    SELECT *
    FROM trainer_client_packages
    WHERE user_id = $1
    AND company_id = $2
    ORDER BY created_at DESC
    `,
    [user_id, company_id]
  );

  res.json(rows);
};


/// 🔹 USAR SESIÓN
exports.useSession = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { user_id } = req.body;
    const company_id = req.user.company_id;

    const session = await client.query(
      `
      SELECT *
      FROM trainer_client_packages
      WHERE user_id = $1
      AND remaining_sessions > 0
      AND company_id = $2
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [user_id, company_id]
    );

    if (session.rows.length === 0) {
      throw new Error("No tiene sesiones disponibles");
    }

    const s = session.rows[0];

    await client.query(
      `
      UPDATE trainer_client_packages
      SET remaining_sessions = remaining_sessions - 1
      WHERE id = $1
      `,
      [s.id]
    );

    await client.query(
      `
      INSERT INTO session_logs
      (user_id, session_id, company_id)
      VALUES ($1,$2,$3)
      `,
      [user_id, s.id, company_id]
    );

    await client.query('COMMIT');

    res.json({ success: true });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(400).json({ error: err.message });

  } finally {
    client.release();
  }
};

// 🔥 FINALIZAR SESIÓN (AUTOMÁTICO)
// 🔥 FINALIZAR SESIÓN (USANDO PAQUETES)
exports.completeSession = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { session_id, user_id } = req.body;
    const company_id = req.user.company_id;

    /// 🔥 1. OBTENER PAQUETE ACTIVO
    const pkgRes = await client.query(
      `
      SELECT id, sessions_total, sessions_used
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      LIMIT 1
      `,
      [user_id, company_id]
    );

    if (pkgRes.rows.length === 0) {
      throw new Error("Cliente sin paquete activo");
    }

    const pkg = pkgRes.rows[0];

    const remaining = pkg.sessions_total - pkg.sessions_used;

    if (remaining <= 0) {
      throw new Error("Sin sesiones disponibles");
    }

    /// 🔥 2. SUMAR USO
    await client.query(
      `
      UPDATE trainer_client_packages
      SET sessions_used = sessions_used + 1
      WHERE id = $1
      `,
      [pkg.id]
    );

    /// 🔥 3. LOG
    await client.query(
      `
      INSERT INTO session_logs
      (user_id, session_id, company_id)
      VALUES ($1,$2,$3)
      `,
      [user_id, session_id, company_id]
    );

    await client.query('COMMIT');

    res.json({ success: true });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(400).json({
      error: err.message
    });

  } finally {
    client.release();
  }
};

// =============================
// 🔥 MARCAR SESIÓN (completed / no_show / cancelled)
// =============================
exports.markSessionStatus = async (req, res) => {
  try {
    const { session_id, status } = req.body;
    const company_id = req.user.company_id;

    /// 🔎 1. VALIDAR STATUS
    const allowed = ["completed", "no_show", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    /// 🔎 2. BUSCAR SESIÓN
    const { rows } = await pool.query(
      `
      SELECT * FROM client_sessions
      WHERE id = $1 AND company_id = $2
      `,
      [session_id, company_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const session = rows[0];

    /// 🚫 3. EVITAR DOBLE DESCUENTO
    if (session.status === "completed" || session.status === "no_show") {
      return res.status(400).json({
        error: "Esta sesión ya fue procesada"
      });
    }

    /// 🔥 4. DEFINIR DESCUENTO
    let discount = 0;

    if (status === "completed" || status === "no_show") {
      discount = 1;
    }

    /// 🚫 5. EVITAR NEGATIVOS
    if (session.remaining_sessions <= 0 && discount > 0) {
      return res.status(400).json({
        error: "No hay sesiones disponibles"
      });
    }

    /// 🔥 6. ACTUALIZAR SESIÓN
    await pool.query(
      `
      UPDATE client_sessions
      SET 
        remaining_sessions = remaining_sessions - $1,
        status = $2
      WHERE id = $3
      `,
      [discount, status, session_id]
    );

    res.json({
      success: true,
      status,
      discount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error marcando sesión" });
  }
};