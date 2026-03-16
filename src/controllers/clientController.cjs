const pool = require('../config/db');

// Obtener planes activos
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
    res.status(500).json({ error: "Error obteniendo planes" });
  }
};

// Obtener QR de pago
exports.getPaymentQr = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `SELECT qr_image_url
       FROM gym_payment_qr
       WHERE is_active = true
       LIMIT 1`
    );

    if(rows.length === 0){
      return res.json({ qr_image_url: null });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo QR" });
  }
};

// Crear solicitud de membresía
exports.requestMembership = async (req, res) => {

  try {

    const user_id = req.user.id;

    const {
      plan_id,
      start_date,
      payment_proof_url
    } = req.body;

    const planResult = await pool.query(
      `SELECT duration_days FROM plans WHERE id=$1`,
      [plan_id]
    );

    if(planResult.rows.length === 0){
      return res.status(400).json({ error: "Plan no encontrado" });
    }

    const duration = planResult.rows[0].duration_days;

    const endResult = await pool.query(
      `SELECT ($1::date + $2 * INTERVAL '1 day') as end_date`,
      [start_date, duration]
    );

    const end_date = endResult.rows[0].end_date;

    const insert = await pool.query(
      `INSERT INTO membership_requests
      (user_id, plan_id, start_date, end_date, payment_proof_url)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [user_id, plan_id, start_date, end_date, payment_proof_url]
    );

    res.json(insert.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando solicitud" });
  }

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
        res.status(500).json({ error: "Error obteniendo usuario" });
    }

    };

};

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
    res.status(500).json({ error: "Error obteniendo usuario" });

  }

};

exports.getPlans = async (req,res)=>{

  try{

    const {rows} = await pool.query(
      `SELECT id,name,duration_days,price,description
       FROM plans
       WHERE is_active=true
       ORDER BY price`
    );

    res.json(rows);

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error obteniendo planes"
    });

    };
};