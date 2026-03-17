const { pool } = require('../config/db');


// =============================
// OBTENER PLANES ACTIVOS
// =============================
exports.getPlans = async (req, res) => {

  try {

    const { rows } = await pool.query(
      `SELECT id, name, duration_days, price, description
       FROM plans
       WHERE is_active = true
       ORDER BY price`
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo planes"
    });

  }

};


// =============================
// OBTENER QR DE PAGO
// =============================
exports.getPaymentQr = async (req, res) => {

  try {

    const { rows } = await pool.query(
      `SELECT qr_image_url
       FROM gym_payment_qr
       WHERE is_active = true
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({ qr_image_url: null });
    }

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo QR"
    });

  }

};


// =============================
// CREAR SOLICITUD DE MEMBRESÍA
// =============================
exports.requestMembership = async (req, res) => {

  try {

    const user_id = req.body.user_id || req.user.id;

    // 🔥 1. datos request (PRIMERO SIEMPRE)
    const plan_id = parseInt(req.body.plan_id);
    const start_date = req.body.start_date;
    const payment_proof_url = req.body.payment_proof_url || null;

    console.log("BODY:", req.body);

    if (!plan_id) {
      return res.status(400).json({
        error: "Plan inválido"
      });
    }

    // 🔥 2. validar plan
    const planResult = await pool.query(
      `SELECT duration_days FROM plans WHERE id=$1`,
      [plan_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({
        error: "Plan no encontrado"
      });
    }

    const duration = planResult.rows[0].duration_days;

    // 🔥 3. calcular end_date
    const endResult = await pool.query(
      `SELECT ($1::date + $2 * INTERVAL '1 day') as end_date`,
      [start_date, duration]
    );

    const end_date = endResult.rows[0].end_date;

    // 🔥 4. validar superposición (AHORA SÍ YA EXISTEN VARIABLES)
    const overlapCheck = await pool.query(
      `
      SELECT id
      FROM membership_requests
      WHERE user_id = $1
      AND status IN ('pending','approved')
      AND (
        (start_date <= $2 AND end_date >= $2)
        OR
        (start_date <= $3 AND end_date >= $3)
        OR
        ($2 <= start_date AND $3 >= end_date)
      )
      `,
      [user_id, start_date, end_date]
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(400).json({
        error: "Ya existe una membresía en ese rango de fechas"
      });
    }

    // 🔥 5. INSERT FINAL
    const insert = await pool.query(
      `INSERT INTO membership_requests
       (user_id, plan_id, start_date, end_date, payment_proof_url)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [user_id, plan_id, start_date, end_date, payment_proof_url]
    );

    res.json(insert.rows[0]);

  } catch (err) {

    console.error("ERROR REAL:", err);

    res.status(500).json({
      error: err.message
    });

  }

};


// =============================
// OBTENER DATOS DEL CLIENTE
// =============================
exports.getMe = async (req, res) => {

  try {

    const user_id = req.user.id;

    const { rows } = await pool.query(
      `SELECT
        id,
        name,
        last_name,
        qr_code,
        membership_start,
        membership_end
       FROM users
       WHERE id=$1`,
      [user_id]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo usuario"
    });

  }

};


// =============================
// OBTENER SOLO LA MEMBRESÍA
// =============================
exports.getMyMembership = async (req, res) => {

  try {

    const user_id = req.user.id;

    const { rows } = await pool.query(
      `SELECT
        membership_start,
        membership_end
       FROM users
       WHERE id=$1`,
      [user_id]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo membresía"
    });

  }

};

// =============================
// LISTAR CLIENTES (STAFF)
// =============================
exports.getClients = async (req, res) => {

  try {

    const { rows } = await pool.query(
      `SELECT id, name, last_name
       FROM users
       WHERE role = 'client'
       ORDER BY name`
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo clientes"
    });

  }

};

// =============================
// HISTORIAL DE MEMBRESÍAS
// =============================
exports.getMembershipHistory = async (req, res) => {

  try {

    const user_id = req.user.id;

    const { rows } = await pool.query(
      `
      SELECT 
        mr.id,
        mr.start_date,
        mr.end_date,
        mr.status,
        mr.created_at,
        p.name as plan_name,
        p.price
      FROM membership_requests mr
      JOIN plans p ON p.id = mr.plan_id
      WHERE mr.user_id = $1
      ORDER BY mr.created_at DESC
      `,
      [user_id]
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo historial"
    });

  }

};