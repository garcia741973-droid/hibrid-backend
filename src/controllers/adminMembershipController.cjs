const pool = require('../config/db');

// ver solicitudes
exports.getRequests = async (req,res)=>{

  try{

    const {rows} = await pool.query(
      `SELECT
       mr.id,
       u.name,
       u.last_name,
       p.name as plan,
       mr.start_date,
       mr.end_date,
       mr.payment_proof_url,
       mr.status
       FROM membership_requests mr
       JOIN users u ON mr.user_id=u.id
       JOIN plans p ON mr.plan_id=p.id
       ORDER BY mr.created_at DESC`
    );

    res.json(rows);

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error obteniendo solicitudes"});
  }

};


// aprobar membresía
exports.approveMembership = async (req,res)=>{

  try{

    const request_id = req.params.id;

    const requestResult = await pool.query(
      `SELECT * FROM membership_requests WHERE id=$1`,
      [request_id]
    );

    if(requestResult.rows.length===0){
      return res.status(404).json({error:"Solicitud no encontrada"});
    }

    const request = requestResult.rows[0];

    await pool.query(
      `UPDATE users
       SET membership_start=$1,
           membership_end=$2
       WHERE id=$3`,
       [
        request.start_date,
        request.end_date,
        request.user_id
       ]
    );

    await pool.query(
      `UPDATE membership_requests
       SET status='approved',
           approved_by=$1,
           approved_at=NOW()
       WHERE id=$2`,
       [req.user.id,request_id]
    );

    res.json({message:"Membresía activada"});

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error aprobando membresía"});
  }

};