const { pool } = require('../config/db.cj');

// =============================
// VER SOLICITUDES
// =============================
exports.getRequests = async (req,res)=>{

  try{

  const companyId = req.user.company_id;

  const {rows} = await pool.query(
    `SELECT
    mr.id,
    u.name,
    u.last_name,
    p.name as plan,
    p.price,
    mr.start_date,
    mr.end_date,
    mr.payment_proof_url,
    mr.status
    FROM membership_requests mr
    JOIN users u ON mr.user_id=u.id
    JOIN plans p ON mr.plan_id=p.id
    WHERE mr.status = 'pending'
    AND mr.company_id = $1
    ORDER BY mr.created_at DESC`,
    [companyId]
  );

    res.json(rows);

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error obteniendo solicitudes"});
  }

};


// =============================
// APROBAR MEMBRESÍA
// =============================
exports.approveMembership = async (req,res)=>{

  try{

    const request_id = req.params.id;
    const companyId = req.user.company_id;

    const result = await pool.query(
      `SELECT mr.*, p.duration_days, p.price
       FROM membership_requests mr
       JOIN plans p ON mr.plan_id = p.id
       WHERE mr.id=$1 AND mr.company_id=$2`,
      [request_id, companyId]
    );

    if(result.rows.length===0){
      return res.status(404).json({error:"Solicitud no encontrada o no autorizada"});
    }

    const request = result.rows[0];

    const startDate = new Date(request.start_date);
    const today = new Date();

    today.setHours(0,0,0,0);
    startDate.setHours(0,0,0,0);

    if(startDate < today){
      return res.status(400).json({
        error:"La fecha de inicio no puede ser anterior a hoy"
      });
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + request.duration_days);

    // 🔥 ACTUALIZAR USUARIO (con seguridad)
    const updateUser = await pool.query(
      `UPDATE users
       SET membership_start=$1,
           membership_end=$2
       WHERE id=$3 AND company_id=$4`,
       [
        startDate,
        endDate,
        request.user_id,
        companyId
       ]
    );

    if(updateUser.rowCount === 0){
      throw new Error("Usuario no autorizado");
    }

    // 🔥 ACTUALIZAR REQUEST
    await pool.query(
      `UPDATE membership_requests
       SET status='approved',
           end_date=$1,
           approved_by=$2,
           approved_at=NOW()
       WHERE id=$3 AND company_id=$4`,
       [endDate, req.user.id, request_id, companyId]
    );

    console.log("🔥 APROBANDO MEMBRESIA:", request_id);
    console.log("💰 PRICE:", request.price);

    // 💰 REGISTRAR INGRESO (CON EMPRESA)
    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, reference_id, amount, staff_id, description, created_by_role, company_id)
      VALUES ('income', 'membership', $1, $2, $3, $4, $5, $6)
      `,
      [
        request_id,
        request.price,
        req.user.id,
        'Pago de membresía',
        req.user.role,
        companyId
      ]
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


// =============================
// VALIDAR QR
// =============================
const jwt = require("jsonwebtoken");

exports.validateQr = async (req, res) => {

  try {

    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({
        error: "QR requerido"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(qrCode, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: "QR inválido o expirado"
      });
    }

    const userId = decoded.user_id;
    const qrCompanyId = decoded.company_id;
    const companyId = req.user.company_id;

    // 🔥 VALIDAR QUE EL QR SEA DE LA MISMA EMPRESA
    if(qrCompanyId !== companyId){
      return res.status(403).json({
        error: "QR no pertenece a esta empresa"
      });
    }

    const result = await pool.query(
      `
      SELECT name, last_name, photo_url, membership_end
      FROM users
      WHERE id = $1 AND company_id = $2
      `,
      [userId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    const now = new Date();
    const end = user.membership_end ? new Date(user.membership_end) : null;

    if (!end) {
      return res.status(403).json({
        error: "Cliente sin membresía activa",
        client: {
          name: `${user.name} ${user.last_name}`,
          photo: user.photo_url
        }
      });
    }

    if (end < now) {
      return res.status(403).json({
        error: "Membresía vencida",
        client: {
          name: `${user.name} ${user.last_name}`,
          photo: user.photo_url,
          membership_end: user.membership_end
        }
      });
    }

    res.json({
      message: "Acceso permitido",
      client: {
        name: `${user.name} ${user.last_name}`,
        photo: user.photo_url,
        membership_end: user.membership_end
      }
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error validando QR"
    });

  }

};