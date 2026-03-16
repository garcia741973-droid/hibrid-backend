const { pool } = require('../config/db');

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
    WHERE mr.status = 'pending'
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

    const result = await pool.query(
      `SELECT mr.*, p.duration_days
       FROM membership_requests mr
       JOIN plans p ON mr.plan_id = p.id
       WHERE mr.id=$1`,
      [request_id]
    );

    if(result.rows.length===0){
      return res.status(404).json({error:"Solicitud no encontrada"});
    }

    const request = result.rows[0];

    const startDate = new Date(request.start_date);
    const today = new Date();

    today.setHours(0,0,0,0);
    startDate.setHours(0,0,0,0);

    // VALIDACIÓN IMPORTANTE
    if(startDate < today){
      return res.status(400).json({
        error:"La fecha de inicio no puede ser anterior a hoy"
      });
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + request.duration_days);

    await pool.query(
      `UPDATE users
       SET membership_start=$1,
           membership_end=$2
       WHERE id=$3`,
       [
        startDate,
        endDate,
        request.user_id
       ]
    );

    await pool.query(
      `UPDATE membership_requests
       SET status='approved',
           end_date=$1,
           approved_by=$2,
           approved_at=NOW()
       WHERE id=$3`,
       [endDate,req.user.id,request_id]
    );

    res.json({
      message:"Membresía activada",
      start_date:startDate,
      end_date:endDate
    });

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error aprobando membresía"});

  }

};

  exports.validateQr = async (req,res)=>{

    try{

      const {qr_code} = req.body;

      const result = await pool.query(
        `SELECT name,last_name,photo_url,membership_end
        FROM users
        WHERE qr_code=$1`,
        [qr_code]
      );

      if(result.rows.length===0){
        return res.status(404).json({
          error:"Usuario no encontrado"
        });
      }

      const user = result.rows[0];

      const now = new Date();
      const end = user.membership_end ? new Date(user.membership_end) : null;

      if(!end){
        return res.status(403).json({
          error:"Cliente sin membresía activa",
          client:{
            name:`${user.name} ${user.last_name}`,
            photo:user.photo_url
          }
        });
      }

      if(end < now){
        return res.status(403).json({
          error:"Membresía vencida",
          client:{
            name:`${user.name} ${user.last_name}`,
            photo:user.photo_url,
            membership_end:user.membership_end
          }
        });
      }

      res.json({
        message:"Acceso permitido",
        client:{
          name:`${user.name} ${user.last_name}`,
          photo:user.photo_url,
          membership_end:user.membership_end
        }
      });

    }catch(err){

      console.error(err);
      res.status(500).json({error:"Error validando QR"});

    }

  };