const express = require('express');
const router = express.Router();
const { pool } = require('../config/db.js');

const { generarCodigo } = require('../services/passwordRecoveryService.cjs');
const { sendResetCode } = require('../services/emailService.cjs');

const bcrypt = require('bcryptjs');

/// 🔹 1. SOLICITAR CODIGO
router.post('/request-reset-code', async (req, res) => {

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  try {

    const userRes = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.json({ success: true });
    }

    const code = generarCodigo();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(`
      INSERT INTO password_reset_codes (email, code, expires_at)
      VALUES ($1,$2,$3)
    `, [email, code, expires]);

    await sendResetCode(email, code);

    return res.json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }

});


/// 🔹 2. VERIFICAR CODIGO
router.post('/verify-reset-code', async (req, res) => {

  const { email, code } = req.body;

  try {

    const { rows } = await pool.query(`
      SELECT * FROM password_reset_codes
      WHERE email=$1 AND code=$2 AND used=false
      ORDER BY created_at DESC LIMIT 1
    `, [email, code]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const reset = rows[0];

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Código expirado' });
    }

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }

});


/// 🔹 3. NUEVA PASSWORD
router.post('/set-new-password', async (req, res) => {

  const { email, code, new_password } = req.body;

  try {

    const { rows } = await pool.query(`
      SELECT * FROM password_reset_codes
      WHERE email=$1 AND code=$2 AND used=false
      ORDER BY created_at DESC LIMIT 1
    `, [email, code]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const hash = await bcrypt.hash(new_password, 10);

    await pool.query(`
      UPDATE users SET password_hash=$1 WHERE email=$2
    `, [hash, email]);

    await pool.query(`
      UPDATE password_reset_codes SET used=true WHERE id=$1
    `, [rows[0].id]);

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }

});

module.exports = router;