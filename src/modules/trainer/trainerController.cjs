const { pool } = require('../../config/db');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// =============================
// 🔥 CREAR SESIÓN
// =============================
exports.createSession = async (req, res) => {
  try {
    const {
      client_id,
      title,
      notes,
      session_date,
      start_time,
      end_time,
      reminder_minutes
    } = req.body;

    const reminder = reminder_minutes ?? 15; // 🔥 default 15 min

    if (!session_date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios'
      });
    }

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    if (end_time <= start_time) {
      return res.status(400).json({
        error: 'Hora fin debe ser mayor a inicio'
      });
    }

    // 🔥 VALIDAR QUE CLIENTE TENGA PAQUETE ACTIVO
        if (client_id) {

        // 🔥 1. OBTENER PAQUETE
        const pkgCheck = await pool.query(
          `
          SELECT 
            SUM(sessions_total) as total,
            SUM(sessions_used) as used
          FROM trainer_client_packages
          WHERE client_id = $1
          AND company_id = $2
          AND status = 'active'
          `,
          [client_id, req.user.company_id]
        );

        if (pkgCheck.rows.length === 0) {
            return res.status(400).json({
            error: 'El cliente no tiene paquete activo'
            });
        }

        const pkg = pkgCheck.rows[0];

        const sessionsLeft =
            Number(pkg.total || 0) - Number(pkg.used || 0);

        // 🔥 2. CONTAR SESIONES FUTURAS (no completadas)
        const futureSessions = await pool.query(
            `
            SELECT COUNT(*) as total
            FROM trainer_sessions
            WHERE client_id = $1
            AND company_id = $2
            AND status IN ('scheduled')
            `,
            [client_id, req.user.company_id]
        );

        const scheduled = Number(futureSessions.rows[0].total);

        const realAvailable = sessionsLeft - scheduled;

        if (realAvailable <= 0) {
            return res.status(400).json({
            error: 'El cliente ya tiene todas sus sesiones programadas'
            });
        }
        }


    const { rows } = await pool.query(
      `
      INSERT INTO trainer_sessions
      (
        company_id,
        trainer_id,
        client_id,
        title,
        notes,
        session_date,
        start_time,
        end_time,
        reminder_minutes,
        reminder_sent
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        req.user.company_id,
        req.user.id,
        client_id || null,
        title || '',
        notes || '',
        session_date,
        start_time,
        end_time,
        reminder,
        false
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error creando sesión'
    });
  }
};

// =============================
// 🔥 LISTAR SESIONES
// =============================
exports.getSessions = async (req, res) => {
  try {
    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
        SELECT 
        ts.*,
        u.name,
        u.last_name,
        u.phone,
        u.emergency_contact_name,
        u.emergency_contact_phone,
        (u.name || ' ' || u.last_name) AS client_name
      FROM trainer_sessions ts
      LEFT JOIN users u ON u.id = ts.client_id
      WHERE ts.company_id = $1
      ORDER BY ts.session_date, ts.start_time
      `,
      [req.user.company_id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo sesiones'
    });
  }
};

// =============================
// 🔥 ACTUALIZAR ESTADO
// =============================
exports.updateSessionStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Status requerido'
      });
    }

    if (req.user.company_type !== 'trainer') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const validStatus = ['scheduled', 'completed', 'cancelled', 'no_show'];

    if (!validStatus.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Status inválido'
      });
    }

    // 🔥 1. TRAER SESIÓN ACTUAL
    const sessionRes = await client.query(
      `
      SELECT id, client_id, status
      FROM trainer_sessions
      WHERE id = $1
        AND company_id = $2
      `,
      [id, req.user.company_id]
    );

    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Sesión no encontrada'
      });
    }

    const session = sessionRes.rows[0];

    // 🔥 2. ACTUALIZAR ESTADO DE LA SESIÓN
    const updateRes = await client.query(
      `
      UPDATE trainer_sessions
      SET status = $1
      WHERE id = $2
        AND company_id = $3
      RETURNING *
      `,
      [status, id, req.user.company_id]
    );

    const updatedSession = updateRes.rows[0];

    // 🔥 3. SI PASA A COMPLETED Y TIENE CLIENTE → DESCONTAR 1 SESIÓN
        if (
        (status === 'completed' || status === 'no_show') &&
        session.status !== 'completed' &&
        session.status !== 'no_show' &&
        session.client_id
        ) {
    // 🔥 TRAER TODOS LOS PAQUETES ACTIVOS (FIFO)
    const pkgsRes = await client.query(
      `
      SELECT id, sessions_total, sessions_used
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      ORDER BY created_at ASC
      `,
      [session.client_id, req.user.company_id]
    );

    if (pkgsRes.rows.length === 0) {
      throw new Error('Cliente no tiene paquete activo');
    }

    let remaining = 1;

    for (const pkg of pkgsRes.rows) {

      const available =
        Number(pkg.sessions_total) - Number(pkg.sessions_used);

      if (available <= 0) continue;

      const toUse = Math.min(remaining, available);

      const newUsed = Number(pkg.sessions_used) + toUse;

      const newStatus =
        newUsed >= Number(pkg.sessions_total)
          ? 'completed'
          : 'active';

      await client.query(
        `
        UPDATE trainer_client_packages
        SET sessions_used = $1,
            status = $2
        WHERE id = $3
          AND company_id = $4
        `,
        [newUsed, newStatus, pkg.id, req.user.company_id]
      );

      remaining -= toUse;

      if (remaining <= 0) break;
    }
    }

    await client.query('COMMIT');

    res.json(updatedSession);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({
      error: err.message || 'Error actualizando sesión'
    });
  } finally {
    client.release();
  }
};

// =============================
// 🔥 APROBAR PAQUETE TRAINER
// =============================
exports.approveTrainerPackage = async (req, res) => {

  try {

    const request_id = req.params.id;
    const companyId = req.user.company_id;

    // 🔥 1. TRAER REQUEST + PAQUETE
    const result = await pool.query(
      `
      SELECT r.*, p.sessions_total AS sessions, p.price
      FROM trainer_package_requests r
      JOIN trainer_packages p ON r.package_id = p.id
      WHERE r.id = $1
        AND r.company_id = $2
      `,
      [request_id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Solicitud no encontrada"
      });
    }

    const request = result.rows[0];

    // 🔥 EVITAR DOBLE APROBACIÓN
    if (request.status === 'approved') {
    return res.status(400).json({
        error: "Esta solicitud ya fue aprobada"
    });
    }    

    // 🔥 2. CREAR PAQUETE DEL CLIENTE
    const pkg = await pool.query(
      `
      INSERT INTO trainer_client_packages
      (
        company_id,
        client_id,
        package_id,
        sessions_total,
        sessions_used,
        status
      )
      VALUES ($1,$2,$3,$4,0,'active')
      RETURNING *
      `,
      [
        companyId,
        request.client_id,
        request.package_id,
        request.sessions
      ]
    );

    const createdPackage = pkg.rows[0];

    // 🔥 3. ACTUALIZAR REQUEST
    await pool.query(
      `
      UPDATE trainer_package_requests
      SET status = 'approved',
          approved_by = $1,
          approved_at = NOW()
      WHERE id = $2
        AND company_id = $3
      `,
      [req.user.id, request_id, companyId]
    );

    // 💰 4. REGISTRAR INGRESO (IGUAL QUE GYM)
    await pool.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, reference_id, amount, staff_id, description, created_by_role, company_id)
      VALUES ('income', 'trainer_package', $1, $2, $3, $4, $5, $6)
      `,
      [
        request_id,
        request.price,
        req.user.id,
        'Pago paquete sesiones',
        req.user.role,
        companyId
      ]
    );

    res.json({
      message: "Paquete activado",
      package: createdPackage
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({
      error: "Error aprobando paquete"
    });

  }

};

// =============================
// 🔥 CREAR SOLICITUD DE PAQUETE
// =============================
exports.createPackageRequest = async (req, res) => {

  try {

    const { package_id, payment_proof_url } = req.body;
    const companyId = req.user.company_id;

        // 🔥 EVITAR DUPLICADOS
        const existing = await pool.query(
        `
        SELECT id
        FROM trainer_package_requests
        WHERE client_id = $1
            AND package_id = $2
            AND status = 'pending'
            AND company_id = $3
        `,
        [req.user.id, package_id, companyId]
        );

        if (existing.rows.length > 0) {
        return res.status(400).json({
            error: "Ya tienes una solicitud pendiente para este paquete"
        });
        }    

    if (!package_id) {
      return res.status(400).json({
        error: "Paquete requerido"
      });
    }

        // 🔥 SOLO CLIENTES
        if (req.user.role !== 'client') {
        return res.status(403).json({
            error: "Solo clientes pueden comprar paquetes"
        });
        }    

    const result = await pool.query(
      `
      INSERT INTO trainer_package_requests
      (company_id, client_id, package_id, payment_proof_url)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        companyId,
        req.user.id,
        package_id,
        payment_proof_url || null
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error creando solicitud"
    });
  }

};

// =============================
// 🔥 VER SOLICITUDES TRAINER
// =============================
exports.getPackageRequests = async (req, res) => {

  try {

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `
      SELECT
        r.id,
        u.name,
        u.last_name,
        p.name as package,
        p.price,
        p.sessions_total AS sessions,
        r.payment_proof_url,
        r.status,
        r.created_at
      FROM trainer_package_requests r
      JOIN users u ON r.client_id = u.id
      JOIN trainer_packages p ON r.package_id = p.id
      WHERE r.status = 'pending'
        AND r.company_id = $1
      ORDER BY r.created_at DESC
      `,
      [companyId]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo solicitudes"
    });
  }

};

// 🔥 VER PAQUETE DEL CLIENTE
exports.getClientPackage = async (req, res) => {
  try {

    const client_id = req.params.clientId;

    // 🔥 1. PAQUETE
    const pkgRes = await pool.query(
      `
      SELECT
        SUM(sessions_total) as total,
        SUM(sessions_used) as used
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      `,
      [client_id, req.user.company_id]
    );

    if (pkgRes.rows.length === 0) {
      return res.json(null);
    }

    const pkg = pkgRes.rows[0];

    // 🔥 2. SESIONES PROGRAMADAS
    const scheduledRes = await pool.query(
      `
      SELECT COUNT(*) as total
      FROM trainer_sessions
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'scheduled'
      `,
      [client_id, req.user.company_id]
    );

    const scheduled = Number(scheduledRes.rows[0].total);

    const sessions_left =
      Number(pkg.total || 0) - Number(pkg.used || 0);

    const realAvailable = sessions_left - scheduled;

    res.json({
      sessions_total: pkg.total,
      sessions_used: pkg.used,
      sessions_left,
      sessions_scheduled: scheduled,
      sessions_real_available: realAvailable
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo paquete"
    });
  }
};

// =============================
// 🔥 AUTO CREAR SESIONES
// =============================
exports.autoCreateSessions = async (req, res) => {

  try {

    const {
      client_id,
      days,
      start_time,
      end_time,
      sessions_to_create
    } = req.body;

    const companyId = req.user.company_id;

    if (!client_id || !days || days.length === 0) {
      return res.status(400).json({
        error: "Datos incompletos"
      });
    }

    // 🔥 1. OBTENER PAQUETE
    const pkgRes = await pool.query(
      `
      SELECT sessions_total, sessions_used, start_date
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [client_id, companyId]
    );

    if (pkgRes.rows.length === 0) {
      return res.status(400).json({
        error: "Cliente sin paquete activo"
      });
    }

    const pkg = pkgRes.rows[0];

    const sessionsLeft =
      Number(pkg.sessions_total) - Number(pkg.sessions_used);

    if (sessionsLeft <= 0) {
      return res.status(400).json({
        error: "Sin sesiones disponibles"
      });
    }

    // 🔥 2. FECHA INICIO
    let currentDate = pkg.start_date
      ? new Date(pkg.start_date)
      : new Date();

    const created = [];

    // 🔥 3. GENERAR SESIONES
    const limit =
      sessions_to_create !== undefined && sessions_to_create !== null
        ? sessions_to_create
        : sessionsLeft;

        if (limit <= 0) {
          return res.status(400).json({
            error: "Debes crear al menos 1 sesión"
          });
        }

        if (
          sessions_to_create !== undefined &&
          sessions_to_create > sessionsLeft
        ) {
          return res.status(400).json({
            error: "No puedes crear más sesiones de las disponibles"
          });
        }

    while (created.length < limit) {

      const day = currentDate.getDay(); // 0-6

      if (days.includes(day)) {

        const dateStr = currentDate.toISOString().split("T")[0];

        const insert = await pool.query(
          `
          INSERT INTO trainer_sessions
          (
            company_id,
            trainer_id,
            client_id,
            title,
            notes,
            session_date,
            start_time,
            end_time,
            status,
            reminder_minutes,
            reminder_sent
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,false)
          RETURNING *
          `,
          [
            companyId,
            req.user.id,
            client_id,
            'Sesión',
            '',
            dateStr,
            start_time,
            end_time,
            15 // o el valor que quieras default
          ]
        );

        created.push(insert.rows[0]);
      }

      // avanzar un día
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      message: "Sesiones creadas",
      total: created.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error creando sesiones automáticas"
    });
  }

};

// =============================
// 🔥 LISTAR CLIENTES TRAINER
// =============================
exports.getClients = async (req, res) => {
  try {

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        id,
        name,
        last_name,
        email,
        phone,
        photo_url,
        gender,
        birth_date,
        emergency_contact_name,
        emergency_contact_phone
      FROM users
      WHERE company_id = $1
      ORDER BY id DESC
      `,
      [req.user.company_id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo clientes'
    });
  }
};

// =============================
// 👤 MIS SESIONES (CLIENTE)
// =============================
exports.getMySessions = async (req, res) => {
  try {

    if (req.user.company_type !== 'trainer') {
      return res.status(403).json({
        error: 'Solo trainer'
      });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        ts.*,
        (ts.session_date || ' ' || ts.start_time) AS datetime
      FROM trainer_sessions ts
      WHERE ts.client_id = $1
        AND ts.company_id = $2
      ORDER BY ts.session_date, ts.start_time
      `,
      [
        req.user.id,
        req.user.company_id
      ]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo mis sesiones'
    });
  }
};

// =============================
// 👤 MI SALDO DE SESIONES
// =============================
exports.getMyPackage = async (req, res) => {
  try {

    const { rows } = await pool.query(
      `
      SELECT
        SUM(sessions_total) as total,
        SUM(sessions_used) as used
      FROM trainer_client_packages
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'active'
      `,
      [req.user.id, req.user.company_id]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    const pkg = rows[0];

    const sessions_left =
      Number(pkg.total || 0) - Number(pkg.used || 0);

    const scheduledRes = await pool.query(
      `
      SELECT COUNT(*) as total
      FROM trainer_sessions
      WHERE client_id = $1
        AND company_id = $2
        AND status = 'scheduled'
      `,
      [req.user.id, req.user.company_id]
    );

    const scheduled = Number(scheduledRes.rows[0].total);

    const realAvailable = sessions_left - scheduled;

    res.json({
      sessions_total: pkg.total,
      sessions_used: pkg.used,
      sessions_left,
      sessions_scheduled: scheduled,
      sessions_real_available: sessions_left - scheduled
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo mi paquete"
    });
  }
};

// =============================
// 🔔 RECORDATORIOS DE SESIONES
// =============================
exports.getSessionReminders = async (req, res) => {

  console.log("🕒 NOW SERVER:", new Date());

  try {

    const now = new Date();

    const { rows } = await pool.query(
      `
      SELECT 
        ts.id,
        ts.session_date,
        ts.start_time,
        ts.client_id,
        u.fcm_token,
        u.name,
        ts.reminder_minutes,
        c.timezone,
        FROM trainer_sessions ts
        JOIN users u ON u.id = ts.client_id
        JOIN companies c ON ts.company_id = c.id
      WHERE ts.status = 'scheduled'
        AND ts.reminder_sent = false
        AND ts.client_id IS NOT NULL
      `
    );

    const toNotify = [];

    for (let s of rows) {

      console.log("🕒 NOW:", now);

      console.log("📅 RAW:", s.session_date, s.start_time);

      // 🔥 LIMPIAR FECHA (IMPORTANTE)
      const tz = s.timezone || 'America/La_Paz';

      const nowTz = dayjs().tz(tz);

      const sessionDateTime = dayjs.tz(
        `${s.session_date} ${s.start_time}`,
        'YYYY-MM-DD HH:mm',
        tz
      );

      const minutes =
        s.reminder_minutes !== null && s.reminder_minutes !== undefined
          ? s.reminder_minutes
          : 60;

      if (minutes === 0) {
        console.log("🔕 Sin recordatorio:", s.id);
        continue;
      }

      const reminderTime = sessionDateTime.subtract(minutes, 'minute');

      console.log("🌎 TZ:", tz);
      console.log("🕒 NOW:", nowTz.format());
      console.log("📅 SESSION:", sessionDateTime.format());
      console.log("⏰ REMINDER:", reminderTime.format());

      if (nowTz.isAfter(reminderTime) && nowTz.isBefore(sessionDateTime)) {
        console.log("✅ ENTRA AL RECORDATORIO");
        toNotify.push(s);
      } else {
        console.log("❌ NO ENTRA");
      }
    }

    res.json(toNotify);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo recordatorios'
    });
  }
};

// =============================
// 🔔 MARCAR RECORDATORIO ENVIADO
// =============================
exports.markReminderSent = async (req, res) => {
  try {

    const { session_id } = req.body;

    await pool.query(
      `
      UPDATE trainer_sessions
      SET reminder_sent = true
      WHERE id = $1
      `,
      [session_id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error actualizando reminder'
    });
  }
};