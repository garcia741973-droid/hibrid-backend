const { pool } = require('../../config/db');
const bcrypt = require('bcryptjs');


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
      country,
      address,
      logo_url,
      timezone // 🔥 NUEVO
    } = req.body;

    if (!name || !type || !plan_id) {
      return res.status(400).json({
        error: "Faltan datos obligatorios"
      });
    }

    // 🔥 VALIDAR TYPE (MUY IMPORTANTE)
    const validTypes = ['gym', 'trainer'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: "Tipo inválido (gym o trainer)"
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
        country,
        address,
        logo_url,
        timezone
      )
      VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        name,
        type || 'gym',
        plan_id,
        expiration,
        contact_name || '',
        contact_phone || '',
        contact_email || '',
        city || '',
        country || '',
        address || '',
        logo_url || null,
        timezone || 'America/La_Paz' // 🔥 NUEVO
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
      c.logo_url, -- 🔥 NUEVO
      c.subscription_status,
      c.expiration_date,
      c.plan_id,
      c.contact_name,
      c.contact_phone,
      c.contact_email,
      c.city,
      c.country,
      c.address,
      c.timezone,
      p.name AS plan_name,
      p.price AS plan_price
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
      c.logo_url, -- 🔥 NUEVO
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

exports.activateCompanyPlan = async (req, res) => {
  try {

    const { company_id, plan_id } = req.body;

    if (!company_id || !plan_id) {
      return res.status(400).json({
        error: "Faltan datos"
      });
    }

    // 🔥 obtener duración del plan
    const plan = await pool.query(
      `SELECT duration_days FROM company_plans WHERE id = $1`,
      [plan_id]
    );

    if (plan.rows.length === 0) {
      return res.status(400).json({
        error: "Plan no existe"
      });
    }

    const days = plan.rows[0].duration_days;

    // 🔥 nueva expiración
    // 🔥 obtener empresa actual
    const companyRes = await pool.query(
      `SELECT expiration_date FROM companies WHERE id = $1`,
      [company_id]
    );

    let baseDate = new Date();

    if (companyRes.rows.length > 0) {

      const currentExpiration = companyRes.rows[0].expiration_date;

      if (currentExpiration) {
        const expDate = new Date(currentExpiration);

        // 🔥 si aún no venció → acumular tiempo
        if (expDate > new Date()) {
          baseDate = expDate;
        }
      }
    }

    // 🔥 nueva expiración acumulada
    const expiration = new Date(baseDate);
    expiration.setDate(expiration.getDate() + days);

    // 🔥 actualizar empresa
    await pool.query(
      `
      UPDATE companies
      SET 
        plan_id = $1,
        subscription_status = 'active',
        expiration_date = $2
      WHERE id = $3
      `,
      [plan_id, expiration, company_id]
    );

    // 🔥 guardar historial de pago
    await pool.query(
      `
      INSERT INTO company_payments
      (company_id, plan_id, amount, expiration_date, registered_by)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        company_id,
        plan_id,
        plan.rows[0].price || 0,
        expiration,
        req.user.id
      ]
    );


    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error activando plan"
    });
  }
};


exports.getCompanyPayments = async (req, res) => {
  try {

    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT 
        cp.id,
        cp.amount,
        cp.payment_date,
        cp.expiration_date,
        p.name AS plan_name
      FROM company_payments cp
      LEFT JOIN company_plans p ON cp.plan_id = p.id
      WHERE cp.company_id = $1
      ORDER BY cp.payment_date DESC
      `,
      [id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo pagos"
    });
  }
};

// =============================
// 🔥 EDITAR EMPRESA
// =============================
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      logo_url,
      primary_color,
      secondary_color,
      contact_name,
      contact_phone,
      contact_email,
      city,
      country,
      address,
      timezone // ✅ AGREGAR
    } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE companies
      SET
        name = COALESCE($1, name),
        logo_url = COALESCE($2, logo_url),
        primary_color = COALESCE($3, primary_color),
        secondary_color = COALESCE($4, secondary_color),
        contact_name = COALESCE($5, contact_name),
        contact_phone = COALESCE($6, contact_phone),
        contact_email = COALESCE($7, contact_email),
        city = COALESCE($8, city),
        country = COALESCE($9, country),
        address = COALESCE($10, address),
        timezone = COALESCE($11, timezone) -- ✅ NUEVO
      WHERE id = $12
      RETURNING *
      `,
      [
        name,
        logo_url,
        primary_color,
        secondary_color,
        contact_name,
        contact_phone,
        contact_email,
        city,
        country,
        address,
        timezone, // ✅ NUEVO
        id
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando empresa" });
  }
};

// =============================
// 🔥 ACTUALIZAR PLAN
// =============================
exports.updatePlan = async (req, res) => {
  try {

    const { id } = req.params;

    const {
      name,
      price,
      duration_days,
      max_clients,
      max_staff,
      features
    } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE company_plans
      SET
        name = COALESCE($1, name),
        price = COALESCE($2, price),
        duration_days = COALESCE($3, duration_days),
        max_clients = COALESCE($4, max_clients),
        max_staff = COALESCE($5, max_staff),
        features = COALESCE($6, features)
      WHERE id = $7
      RETURNING *
      `,
      [
        name,
        price,
        duration_days,
        max_clients,
        max_staff,
        features,
        id
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error actualizando plan"
    });
  }
};
