const { pool } = require('../config/db');


// Crear plan (ADMIN)
exports.createPlan = async (req,res)=>{

  try{

    const {name,duration_days,price,description} = req.body;

    const {rows} = await pool.query(
      `INSERT INTO plans
      (name,duration_days,price,description,company_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [
        name,
        duration_days,
        price,
        description,
        req.user.company_id // 🔥 CLAVE
      ]
    );

    res.json(rows[0]);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error creando plan"
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
exports.togglePlan = async (req,res)=>{

  try{

    const {id} = req.params;

    const {rows} = await pool.query(
      `
      UPDATE plans
      SET is_active = NOT is_active
      WHERE id=$1 AND company_id=$2
      RETURNING *
      `,
      [id, req.user.company_id]
    );

    res.json(rows[0]);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error actualizando plan"
    });

  }

};


// =============================
// EDITAR PLAN
// =============================
exports.updatePlan = async (req,res)=>{

  try{

    const {id} = req.params;
    const {name,duration_days,price,description} = req.body;

    const {rows} = await pool.query(
      `
      UPDATE plans
      SET name=$1,
          duration_days=$2,
          price=$3,
          description=$4
      WHERE id=$5 AND company_id=$6
      RETURNING *
      `,
      [
        name,
        duration_days,
        price,
        description,
        id,
        req.user.company_id
      ]
    );

    res.json(rows[0]);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error actualizando plan"
    });

  }

};