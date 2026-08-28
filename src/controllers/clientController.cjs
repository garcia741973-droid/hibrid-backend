const { pool } = require('../config/db');


// =============================
// OBTENER PLANES ACTIVOS
// =============================
exports.getPlans = async (req, res) => {

  try {

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT id, name, duration_days, price, description
       FROM plans
       WHERE is_active = true
       AND company_id = $1
       ORDER BY price`,
      [companyId]
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

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT qr_image_url
       FROM gym_payment_qr
       WHERE is_active = true
       AND company_id = $1
       LIMIT 1`,
      [companyId]
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

    // 🔒 SIEMPRE el usuario autenticado.
    // Nunca aceptar user_id enviado desde Flutter.
    const user_id = req.user.id;
    const companyId = req.user.company_id;

    const plan_id = Number.parseInt(req.body.plan_id, 10);
    const start_date = req.body.start_date;
    const payment_proof_url =
      req.body.payment_proof_url || null;

    // =============================
    // 1️⃣ VALIDAR DATOS
    // =============================
    if (!Number.isInteger(plan_id) || plan_id <= 0) {
      return res.status(400).json({
        error: "Plan inválido"
      });
    }

    if (!start_date) {
      return res.status(400).json({
        error: "Fecha de inicio obligatoria"
      });
    }

    // Validamos como DATE directamente en PostgreSQL
    // para evitar problemas de zona horaria de JavaScript.
    const dateCheck = await pool.query(
      `
      SELECT $1::date AS start_date
      `,
      [start_date]
    );

    const validStartDate = dateCheck.rows[0].start_date;

    // =============================
    // 2️⃣ VALIDAR CLIENTE
    // =============================
    const userResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND company_id = $2
        AND role = 'client'
        AND is_active = true
      `,
      [user_id, companyId]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({
        error: "Cliente no autorizado"
      });
    }

    // =============================
    // 3️⃣ VALIDAR PLAN
    // =============================
    const planResult = await pool.query(
      `
      SELECT duration_days
      FROM plans
      WHERE id = $1
        AND company_id = $2
        AND is_active = true
      `,
      [plan_id, companyId]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({
        error: "Plan no encontrado o no disponible"
      });
    }

    const duration =
      Number(planResult.rows[0].duration_days);

    if (!Number.isInteger(duration) || duration <= 0) {
      return res.status(400).json({
        error: "Duración del plan inválida"
      });
    }

    // =============================
    // 4️⃣ CALCULAR END DATE
    // =============================
    const endResult = await pool.query(
      `
      SELECT
        ($1::date + $2 * INTERVAL '1 day')::date
        AS end_date
      `,
      [start_date, duration]
    );

    const end_date = endResult.rows[0].end_date;

    // =============================
    // 5️⃣ VALIDAR SUPERPOSICIÓN
    // =============================
    const overlapCheck = await pool.query(
      `
      SELECT id
      FROM membership_requests
      WHERE user_id = $1
        AND company_id = $2
        AND status IN ('pending','approved')
        AND (
          (start_date <= $3 AND end_date >= $3)
          OR
          (start_date <= $4 AND end_date >= $4)
          OR
          ($3 <= start_date AND $4 >= end_date)
        )
      LIMIT 1
      `,
      [
        user_id,
        companyId,
        validStartDate,
        end_date
      ]
    );

    if (overlapCheck.rows.length > 0) {
      return res.status(400).json({
        error: "Ya existe una membresía en ese rango de fechas"
      });
    }

    // =============================
    // 6️⃣ CREAR SOLICITUD
    // =============================
    const insert = await pool.query(
      `
      INSERT INTO membership_requests
      (
        user_id,
        plan_id,
        start_date,
        end_date,
        payment_proof_url,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        user_id,
        plan_id,
        validStartDate,
        end_date,
        payment_proof_url,
        companyId
      ]
    );

    return res.json(insert.rows[0]);

  } catch (err) {

    console.error(
      "❌ ERROR SOLICITANDO MEMBRESÍA:",
      err
    );

    return res.status(500).json({
      error: "Error creando solicitud de membresía"
    });

  }

};

// =============================
// OBTENER DATOS DEL CLIENTE
// =============================
exports.getMe = async (req, res) => {

  try {

    const user_id = req.user.id;
    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
        id,
        name,
        last_name,
        qr_code,
        membership_start,
        membership_end
       FROM users
       WHERE id=$1 AND company_id=$2`,
      [user_id, companyId]
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
    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
        membership_start,
        membership_end
       FROM users
       WHERE id=$1 AND company_id=$2`,
      [user_id, companyId]
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

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT 
        id,
        name,
        last_name,
        email,
        phone,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone,
        photo_url,
        membership_start,
        membership_end
      FROM users
       WHERE role = 'client'
       AND company_id = $1
       ORDER BY name`,
      [companyId]
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
    const companyId = req.user.company_id;

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
      AND mr.company_id = $2
      ORDER BY mr.created_at DESC
      `,
      [user_id, companyId]
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error obteniendo historial"
    });

  }

};


// =============================
// GENERAR QR DINÁMICO (5 MIN)
// =============================
const jwt = require("jsonwebtoken");

exports.getMyQr = async (req, res) => {
  try {

    const userId = req.user.id;
    const companyId = req.user.company_id;

    const token = jwt.sign(
      { user_id: userId, company_id: companyId },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    res.json({
      qr: token
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error generando QR"
    });

  }
};