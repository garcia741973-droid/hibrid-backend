const { pool } = require('../config/db');

/// 🔹 CREAR QR
exports.createQr = async (req, res) => {
  try {

    const {
      qr_image_url,
      valid_from,
      valid_until
    } = req.body;

    /// 1. Desactivar todos
//    await pool.query(`
//      UPDATE gym_payment_qr
//      SET is_active = false
//    `);

    /// 2. Crear nuevo
    const { rows } = await pool.query(
      `
      INSERT INTO gym_payment_qr (
        qr_image_url,
        valid_from,
        valid_until,
        is_active
      )
      VALUES ($1,$2,$3,false)
      RETURNING *
      `,
      [qr_image_url, valid_from, valid_until]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error creando QR"
    });
  }
};


/// 🔹 LISTAR TODOS
exports.getQrs = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM gym_payment_qr
      ORDER BY created_at DESC
      `
    );

    res.json(rows);

  } catch (err) {
    res.status(500).json({
      error: "Error obteniendo QRs"
    });
  }
};


/// 🔹 ACTIVAR QR
exports.activateQr = async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(`
      UPDATE gym_payment_qr
      SET is_active = false
    `);

    await pool.query(
      `
      UPDATE gym_payment_qr
      SET is_active = true
      WHERE id = $1
      `,
      [id]
    );

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({
      error: "Error activando QR"
    });
  }
};


/// 🔹 OBTENER QR ACTIVO (USO CLIENTE)
exports.getActiveQr = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM gym_payment_qr
      WHERE is_active = true
      AND (valid_from IS NULL OR NOW() >= valid_from)
      AND (valid_until IS NULL OR NOW() <= valid_until)
      ORDER BY created_at DESC
      LIMIT 1
      `
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "No hay QR activo"
      });
    }

    res.json(rows[0]);

  } catch (err) {
    res.status(500).json({
      error: "Error obteniendo QR"
    });
  }
};

/// 🔔 VERIFICAR QR POR VENCER
exports.checkQrExpiring = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT *
      FROM gym_payment_qr
      WHERE is_active = true
      AND valid_until IS NOT NULL
      AND valid_until <= NOW() + INTERVAL '3 days'
      LIMIT 1
      `
    );

    if (rows.length === 0) {
      return res.json({ expiring: false });
    }

    res.json({
      expiring: true,
      qr: rows[0]
    });

  } catch (err) {
    res.status(500).json({
      error: "Error verificando QR"
    });
  }
};