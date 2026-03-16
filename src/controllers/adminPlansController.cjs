const { pool } = require('../config/db');


// Crear plan (ADMIN)
exports.createPlan = async (req,res)=>{

  try{

    const {name,duration_days,price,description} = req.body;

    const {rows} = await pool.query(
      `INSERT INTO plans
      (name,duration_days,price,description)
      VALUES ($1,$2,$3,$4)
      RETURNING *`,
      [name,duration_days,price,description]
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
      ORDER BY duration_days ASC`
    );

    res.json(rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error obteniendo planes"
    });

  }

};