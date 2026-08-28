const { pool } = require('../config/db');


// Crear plan (ADMIN)
exports.createPlan = async (req, res) => {

  try {

    const {
      name,
      duration_days,
      price,
      description
    } = req.body;

    const companyId = req.user.company_id;

    // =============================
    // VALIDACIONES
    // =============================
    const cleanName =
      typeof name === "string"
        ? name.trim()
        : "";

    const duration =
      Number(duration_days);

    const planPrice =
      Number(price);

    if (!cleanName) {
      return res.status(400).json({
        error: "Nombre del plan obligatorio"
      });
    }

    if (
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      return res.status(400).json({
        error: "La duración debe ser un número entero mayor a cero"
      });
    }

    if (
      !Number.isFinite(planPrice) ||
      planPrice < 0
    ) {
      return res.status(400).json({
        error: "Precio inválido"
      });
    }

    // =============================
    // CREAR PLAN
    // =============================
    const { rows } = await pool.query(
      `
      INSERT INTO plans
      (
        name,
        duration_days,
        price,
        description,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        cleanName,
        duration,
        planPrice,
        description?.toString().trim() || "",
        companyId
      ]
    );

    return res.status(201).json(
      rows[0]
    );

  } catch (err) {

    console.error(
      "❌ ERROR CREANDO PLAN:",
      err
    );

    return res.status(500).json({
      error: "Error creando plan"
    });
  }
};


// Obtener planes activos (CLIENTES)
exports.getPlans = async (req,res)=>{

  try{

    const {rows} = await pool.query(
      `SELECT
        id,
        name,
        duration_days,
        price,
        description
      FROM plans
      WHERE is_active = true
      AND company_id = $1
      ORDER BY duration_days ASC`,
      [req.user.company_id]
    );

    res.json(rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error obteniendo planes"
    });

  }

};


// =============================
// OBTENER TODOS LOS PLANES (ADMIN)
// =============================
exports.getAllPlans = async (req,res)=>{

  try{

    const {rows} = await pool.query(
      `SELECT * FROM plans
      WHERE company_id = $1
      ORDER BY id DESC`,
      [req.user.company_id]
    );

    res.json(rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error obteniendo planes"
    });

  }

};


// =============================
// ACTIVAR / DESACTIVAR PLAN
// =============================
exports.togglePlan = async (req, res) => {

  try {

    const id =
      Number.parseInt(
        req.params.id,
        10
      );

    const companyId =
      req.user.company_id;

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        error: "Plan inválido"
      });
    }

    const { rows } = await pool.query(
      `
      UPDATE plans
      SET is_active = NOT is_active
      WHERE id = $1
        AND company_id = $2
      RETURNING *
      `,
      [
        id,
        companyId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Plan no encontrado"
      });
    }

    return res.json(
      rows[0]
    );

  } catch (err) {

    console.error(
      "❌ ERROR CAMBIANDO ESTADO PLAN:",
      err
    );

    return res.status(500).json({
      error: "Error actualizando plan"
    });
  }
};


// =============================
// EDITAR PLAN
// =============================
exports.updatePlan = async (req, res) => {

  try {

    const id =
      Number.parseInt(
        req.params.id,
        10
      );

    const {
      name,
      duration_days,
      price,
      description
    } = req.body;

    const companyId =
      req.user.company_id;

    // =============================
    // VALIDAR ID
    // =============================
    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        error: "Plan inválido"
      });
    }

    // =============================
    // VALIDAR DATOS
    // =============================
    const cleanName =
      typeof name === "string"
        ? name.trim()
        : "";

    const duration =
      Number(duration_days);

    const planPrice =
      Number(price);

    if (!cleanName) {
      return res.status(400).json({
        error: "Nombre del plan obligatorio"
      });
    }

    if (
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      return res.status(400).json({
        error: "La duración debe ser un número entero mayor a cero"
      });
    }

    if (
      !Number.isFinite(planPrice) ||
      planPrice < 0
    ) {
      return res.status(400).json({
        error: "Precio inválido"
      });
    }

    // =============================
    // ACTUALIZAR
    // =============================
    const { rows } = await pool.query(
      `
      UPDATE plans
      SET
        name = $1,
        duration_days = $2,
        price = $3,
        description = $4
      WHERE id = $5
        AND company_id = $6
      RETURNING *
      `,
      [
        cleanName,
        duration,
        planPrice,
        description?.toString().trim() || "",
        id,
        companyId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Plan no encontrado"
      });
    }

    return res.json(
      rows[0]
    );

  } catch (err) {

    console.error(
      "❌ ERROR ACTUALIZANDO PLAN:",
      err
    );

    return res.status(500).json({
      error: "Error actualizando plan"
    });
  }
};