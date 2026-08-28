const { pool } = require('../config/db');

exports.createMembership = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { user_id, plan_id, start_date } = req.body;

    const staff_id = req.user.id;
    const companyId = req.user.company_id;

    // =============================
    // 1️⃣ VALIDAR DATOS
    // =============================
    if (!user_id || !plan_id || !start_date) {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "user_id, plan_id y start_date son obligatorios"
      });
    }

    const start = new Date(start_date);

    if (Number.isNaN(start.getTime())) {

      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "Fecha de inicio inválida"
      });
    }

    // =============================
    // 2️⃣ VALIDAR CLIENTE
    // MISMA EMPRESA + CLIENT ACTIVO
    // =============================
    const userResult = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND company_id = $2
        AND role = 'client'
        AND is_active = true
      FOR UPDATE
      `,
      [
        user_id,
        companyId
      ]
    );

    if (userResult.rows.length === 0) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        error: "Cliente no encontrado o no autorizado"
      });
    }

    // =============================
    // 3️⃣ BUSCAR PLAN
    // SIEMPRE DE LA MISMA EMPRESA
    // =============================
    const planResult = await client.query(
      `
      SELECT
        id,
        duration_days,
        price
      FROM plans
      WHERE id = $1
        AND company_id = $2
        AND is_active = true
      `,
      [
        plan_id,
        companyId
      ]
    );

    if (planResult.rows.length === 0) {

      await client.query('ROLLBACK');

      return res.status(404).json({
        error: "Plan no encontrado o no disponible"
      });
    }

    const plan = planResult.rows[0];

    // =============================
    // 4️⃣ CALCULAR FIN
    // =============================
    const end = new Date(start);

    end.setDate(
      end.getDate() + Number(plan.duration_days)
    );

    // =============================
    // 5️⃣ CREAR MEMBERSHIP
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
        user_id,
        plan_id,
        start,
        end,
        plan.price,
        staff_id,
        companyId
      ]
    );

    const membershipId = membershipResult.rows[0].id;

    // =============================
    // 6️⃣ ACTUALIZAR CLIENTE
    // =============================
    const updateUser = await client.query(
      `
      UPDATE users
      SET
        membership_start = $1,
        membership_end = $2,
        membership_status = 'active',
        updated_at = NOW()
      WHERE id = $3
        AND company_id = $4
        AND role = 'client'
        AND is_active = true
      `,
      [
        start,
        end,
        user_id,
        companyId
      ]
    );

    if (updateUser.rowCount === 0) {
      throw new Error("No se pudo actualizar el cliente");
    }

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
      (
        'income',
        'membership',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      `,
      [
        membershipId,
        plan.price,
        staff_id,
        'Pago de membresía',
        req.user.role,
        companyId
      ]
    );

    // =============================
    // 8️⃣ TODO OK
    // =============================
    await client.query('COMMIT');

    console.log(
      "✅ MEMBRESÍA CREADA POR STAFF/ADMIN:",
      membershipId
    );

    return res.json({
      message: "Membresía creada correctamente",
      membership_id: membershipId,
      start_date: start,
      end_date: end
    });

  } catch (err) {

    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      "❌ ERROR CREANDO MEMBRESÍA:",
      err
    );

    return res.status(500).json({
      error: "Error creando membresía"
    });

  } finally {

    client.release();

  }

};