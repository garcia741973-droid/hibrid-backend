const { pool } = require('../config/db');

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
exports.approveMembership = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const request_id = req.params.id;
    const companyId = req.user.company_id;

    // =============================
    // 1️⃣ OBTENER SOLICITUD + PLAN
    // =============================
    const result = await client.query(
      `
      SELECT
        mr.*,
        p.duration_days,
        p.price
      FROM membership_requests mr
      JOIN plans p
        ON mr.plan_id = p.id
       AND p.company_id = mr.company_id
      WHERE mr.id = $1
        AND mr.company_id = $2
      FOR UPDATE
      `,
      [request_id, companyId]
    );

    if (result.rows.length === 0) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        error: "Solicitud no encontrada o no autorizada"
      });
    }

    const request = result.rows[0];

    // =============================
    // 2️⃣ EVITAR DOBLE APROBACIÓN
    // =============================
    if (request.status === 'approved') {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "Esta membresía ya fue aprobada"
      });
    }

    if (request.status !== 'pending') {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "La solicitud ya no está pendiente"
      });
    }

    // =============================
    // 3️⃣ RESPETAR FECHA SOLICITADA
    // =============================
    const startDate = new Date(request.start_date);

    if (Number.isNaN(startDate.getTime())) {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "Fecha de inicio inválida"
      });
    }

    // 🔥 IMPORTANTE:
    // Ya NO bloqueamos si start_date quedó en el pasado.
    // Se respeta la fecha originalmente solicitada.

    const endDate = new Date(startDate);

    endDate.setDate(
      endDate.getDate() + Number(request.duration_days)
    );

    // =============================
    // 4️⃣ ACTUALIZAR USUARIO
    // =============================
    const updateUser = await client.query(
      `
      UPDATE users
      SET
        membership_start = $1,
        membership_end = $2,
        membership_status =
          CASE
            WHEN $2::date < CURRENT_DATE THEN 'expired'
            WHEN $1::date > CURRENT_DATE THEN 'inactive'
            ELSE 'active'
          END,
        updated_at = NOW()
      WHERE id = $3
        AND company_id = $4
        AND role = 'client'
      RETURNING id
      `,
      [
        startDate,
        endDate,
        request.user_id,
        companyId
      ]
    );

    if (updateUser.rowCount === 0) {
      throw new Error("Cliente no encontrado o no autorizado");
    }

    // =============================
    // 5️⃣ CREAR HISTORIAL MEMBERSHIP
    // =============================
    const membershipResult = await client.query(
      `
      INSERT INTO memberships
      (
        user_id,
        plan_id,
        start_date,
        end_date,
        price,
        created_by,
        company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
      `,
      [
        request.user_id,
        request.plan_id,
        startDate,
        endDate,
        request.price,
        req.user.id,
        companyId
      ]
    );

    const membershipId = membershipResult.rows[0].id;

    // =============================
    // 6️⃣ APROBAR SOLICITUD
    // =============================
    await client.query(
      `
      UPDATE membership_requests
      SET
        status = 'approved',
        end_date = $1,
        approved_by = $2,
        approved_at = NOW()
      WHERE id = $3
        AND company_id = $4
      `,
      [
        endDate,
        req.user.id,
        request_id,
        companyId
      ]
    );

    // =============================
    // 7️⃣ REGISTRAR INGRESO EN CAJA
    // =============================
    await client.query(
      `
      INSERT INTO cash_movements
      (
        type,
        reference_type,
        reference_id,
        amount,
        staff_id,
        description,
        created_by_role,
        company_id
      )
      VALUES
      ('income','membership',$1,$2,$3,$4,$5,$6)
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

    // =============================
    // 8️⃣ TODO CORRECTO
    // =============================
    await client.query('COMMIT');

    console.log(
      "✅ MEMBRESÍA APROBADA:",
      request_id,
      "MEMBERSHIP:",
      membershipId
    );

    res.json({
      message: "Membresía activada",
      membership_id: membershipId,
      start_date: startDate,
      end_date: endDate
    });

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      "❌ ERROR APROBANDO MEMBRESÍA:",
      err
    );

    res.status(500).json({
      error: "Error aprobando membresía"
    });

  } finally {

    client.release();

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

    // =============================
    // 1️⃣ VALIDAR FIRMA Y EXPIRACIÓN QR
    // =============================
    let decoded;

    try {

      decoded = jwt.verify(
        qrCode,
        process.env.JWT_SECRET
      );

    } catch (_) {

      return res.status(401).json({
        error: "QR inválido o expirado"
      });
    }

    const userId = Number(decoded.user_id);
    const qrCompanyId = Number(decoded.company_id);
    const companyId = Number(req.user.company_id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(401).json({
        error: "QR inválido"
      });
    }

    // =============================
    // 2️⃣ MISMA EMPRESA
    // =============================
    if (qrCompanyId !== companyId) {

      return res.status(403).json({
        error: "QR no pertenece a esta empresa"
      });
    }

    // =============================
    // 3️⃣ BUSCAR CLIENTE
    // PostgreSQL compara las fechas.
    // Evitamos problemas de timezone JS.
    // =============================
    const result = await pool.query(
      `
      SELECT
        name,
        last_name,
        photo_url,
        membership_start,
        membership_end,
        membership_status,
        is_active,

        CASE
          WHEN membership_start IS NOT NULL
           AND membership_start > CURRENT_DATE
          THEN true
          ELSE false
        END AS membership_not_started,

        CASE
          WHEN membership_end IS NOT NULL
           AND membership_end < CURRENT_DATE
          THEN true
          ELSE false
        END AS membership_expired

      FROM users

      WHERE id = $1
        AND company_id = $2
      `,
      [
        userId,
        companyId
      ]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    const clientData = {
      name: `${user.name} ${user.last_name ?? ''}`.trim(),
      photo: user.photo_url,
      membership_start: user.membership_start,
      membership_end: user.membership_end
    };

    // =============================
    // 4️⃣ USUARIO DESACTIVADO
    // =============================
    if (!user.is_active) {

      return res.status(403).json({
        error: "Cliente desactivado",
        client: clientData
      });
    }

    // =============================
    // 5️⃣ SIN MEMBRESÍA
    // =============================
    if (
      !user.membership_start ||
      !user.membership_end
    ) {

      return res.status(403).json({
        error: "Cliente sin membresía activa",
        client: clientData
      });
    }

    // =============================
    // 6️⃣ MEMBRESÍA TODAVÍA NO INICIÓ
    // =============================
    if (user.membership_not_started) {

      return res.status(403).json({
        error: "La membresía todavía no ha iniciado",
        client: clientData
      });
    }

    // =============================
    // 7️⃣ MEMBRESÍA VENCIDA
    // =============================
    if (user.membership_expired) {

      return res.status(403).json({
        error: "Membresía vencida",
        client: clientData
      });
    }

    // =============================
    // 8️⃣ ESTADO DE MEMBRESÍA
    // =============================
    if (user.membership_status !== 'active') {

      return res.status(403).json({
        error: "Membresía no activa",
        client: clientData
      });
    }

    // =============================
    // 9️⃣ ACCESO CORRECTO
    // =============================
    return res.json({
      message: "Acceso permitido",
      client: clientData
    });

  } catch (err) {

    console.error(
      "❌ ERROR VALIDANDO QR:",
      err
    );

    return res.status(500).json({
      error: "Error validando QR"
    });
  }

};