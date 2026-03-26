const { pool } = require('../../config/db');
const bcrypt = require('bcrypt');


// =============================
// 🔥 CREAR EMPRESA (PRO)
// =============================
exports.createCompany = async (req, res) => {
  try {

    const {
      name,
      type,
      plan_id,
      contact_name,
      contact_phone,
      contact_email,
      city,
      country
    } = req.body;

    if (!name || !type || !plan_id) {
      return res.status(400).json({
        error: "Faltan datos obligatorios"
      });
    }

    // 🔥 VALIDAR PLAN
    const planCheck = await pool.query(
      `SELECT id, duration_days FROM company_plans WHERE id = $1`,
      [plan_id]
    );

    if (planCheck.rows.length === 0) {
      return res.status(400).json({
        error: "Plan no existe"
      });
    }

    const plan = planCheck.rows[0];

    // 🔥 CALCULAR EXPIRACIÓN AUTOMÁTICA
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + plan.duration_days);

    const { rows } = await pool.query(
      `
      INSERT INTO companies 
      (
        name,
        type,
        plan_id,
        subscription_status,
        expiration_date,
        contact_name,
        contact_phone,
        contact_email,
        city,
        country
      )
      VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        name,
        type,
        plan_id,
        expiration,
        contact_name || '',
        contact_phone || '',
        contact_email || '',
        city || '',
        country || ''
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error creando empresa"
    });
  }
};


// =============================
// 🔥 LISTAR EMPRESAS (PRO)
// =============================
exports.getCompanies = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT 
        c.id,
        c.name,
        c.type,
        c.subscription_status,
        c.expiration_date,
        c.plan_id,
        c.contact_name,
        c.city,
        c.country,
        p.name AS plan_name
      FROM companies c
      LEFT JOIN company_plans p ON c.plan_id = p.id
      ORDER BY c.created_at DESC
      `
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo empresas"
    });
  }
};


// =============================
// 🔥 CREAR ADMIN (MEJORADO)
// =============================
exports.createAdmin = async (req, res) => {
  try {

    const { name, email, password, company_id } = req.body;

    if (!name || !email || !password || !company_id) {
      return res.status(400).json({
        error: "Faltan datos"
      });
    }

    // 🔥 VALIDAR EMPRESA
    const company = await pool.query(
      `SELECT id FROM companies WHERE id = $1`,
      [company_id]
    );

    if (company.rows.length === 0) {
      return res.status(400).json({
        error: "Empresa no existe"
      });
    }

    // 🔥 EVITAR EMAIL DUPLICADO
    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "Email ya registrado"
      });
    }

    // 🔥 HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password, role, company_id)
      VALUES ($1,$2,$3,'admin',$4)
      RETURNING id,name,email,role,company_id
      `,
      [name, email, hashedPassword, company_id]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error creando admin"
    });

  }
};


// =============================
// 🔥 OBTENER PLANES
// =============================
exports.getPlans = async (req, res) => {
  try {

    const { rows } = await pool.query(`
      SELECT * FROM company_plans
      WHERE is_active = true
      ORDER BY id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo planes" });
  }
};


// =============================
// 🔥 CREAR PLAN (PRO)
// =============================
exports.createPlan = async (req, res) => {
  try {

    const {
      name,
      price,
      duration_days,
      max_clients,
      max_staff,
      features
    } = req.body;

    if (!name || !price || !duration_days) {
      return res.status(400).json({
        error: "Faltan datos obligatorios"
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO company_plans
      (name, price, duration_days, max_clients, max_staff, features, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,true)
      RETURNING *
      `,
      [
        name,
        price,
        duration_days,
        max_clients || 50,
        max_staff || 5,
        features || {}
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando plan" });
  }
};

exports.getCompanyStatus = async (req, res) => {
  try {

    console.log("🔥 === COMPANY STATUS ===");
    console.log("USER:", req.user);

    // 🔥 FIX TEMPORAL + LOG
    const companyId = req.user?.company_id || 1;

    console.log("COMPANY ID USADO:", companyId);

    const { rows } = await pool.query(
      `
      SELECT 
        c.name,
        c.subscription_status,
        c.expiration_date,
        p.name AS plan_name
      FROM companies c
      LEFT JOIN company_plans p ON c.plan_id = p.id
      WHERE c.id = $1
      `,
      [companyId]
    );



    console.log("RESULTADO QUERY:", rows);

    if (rows.length === 0) {
      console.log("❌ NO SE ENCONTRÓ EMPRESA");
      return res.status(404).json({
        error: "Empresa no encontrada"
      });
    }

    console.log("✅ RESPUESTA:", rows[0]);

    // 🔥 CALCULAR SUSCRIPCIÓN AQUÍ (CLAVE)
    const today = new Date();
    const expiration = new Date(rows[0].expiration_date);

    const diffDays = Math.ceil(
      (expiration - today) / (1000 * 60 * 60 * 24)
    );

    const subscription = {
      days_left: diffDays,
      expired: diffDays < 0
    };

    return res.json(rows[0]);

  } catch (err) {
    console.error("❌ ERROR COMPANY STATUS:", err);
    return res.status(500).json({
      error: "Error obteniendo estado"
    });
  }
};

