const { pool } = require('../config/db');

exports.createMembership = async (req,res)=>{

  try{

    const { user_id, plan_id, start_date } = req.body;

    const staff_id = req.user.id;

    // 1️⃣ buscar plan
    const planResult = await pool.query(
      `SELECT * FROM plans WHERE id=$1`,
      [plan_id]
    );

    if(planResult.rows.length===0){
      return res.status(404).json({error:"Plan no encontrado"});
    }

    const plan = planResult.rows[0];

    // 2️⃣ calcular end_date
    const start = new Date(start_date);
    const end = new Date(start);

    end.setDate(end.getDate() + plan.duration_days);

    // 3️⃣ crear membership
    await pool.query(
      `INSERT INTO memberships
      (user_id,plan_id,start_date,end_date,price,created_by)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        user_id,
        plan_id,
        start_date,
        end,
        plan.price,
        staff_id
      ]
    );

    // 4️⃣ actualizar estado usuario
    await pool.query(
      `UPDATE users
       SET membership_start=$1,
           membership_end=$2
       WHERE id=$3`,
       [
        start_date,
        end,
        user_id
       ]
    );

    // 5️⃣ registrar pago
    await pool.query(
      `INSERT INTO payments
      (client_id,amount,status,approved_by)
      VALUES ($1,$2,'paid',$3)`,
      [
        user_id,
        plan.price,
        staff_id
      ]
    );

    res.json({
      message:"Membresía creada correctamente"
    });

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error creando membresía"});

  }

};