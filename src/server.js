const express = require("express");
const cors = require("cors");
require("dotenv").config();

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

console.log("🔥 FIREBASE PROJECT:", process.env.FIREBASE_PROJECT_ID);
console.log("🔥 FIREBASE CLIENT:", process.env.FIREBASE_CLIENT_EMAIL);

const { pool } = require("./config/db");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const authRoutes = require("./routes/auth.cjs");
const adminRoutes = require("./routes/admin.cjs");

const staffMembershipRoutes = require('./routes/staffMembership.cjs');

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// =============================
// 🔥 HEALTH CHECK (CRÍTICO)
// =============================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// rutas
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);


const clientRoutes = require('./routes/client.cjs');
const adminPlansRoutes = require('./routes/adminPlans.cjs');
const adminMembershipRoutes = require('./routes/adminMembership.cjs');

app.use('/client', clientRoutes);
app.use('/admin', adminPlansRoutes);
app.use('/admin', adminMembershipRoutes);

app.use('/staff', staffMembershipRoutes);

app.use('/trainer', require('./modules/trainer/trainerRoutes.cjs'));
app.use('/trainer-packages', require('./modules/trainerPackages/trainerPackagesRoutes.cjs'));

// ruta test
app.get("/", async (req, res) => {
  try {

    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "HIBRID backend funcionando",
      database_time: result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: "Error conectando base de datos",
      details: error.message
    });

  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

const cron = require("node-cron");

// =============================
// 🔔 RECORDATORIOS TRAINER
// CONSULTA INTERNA - SIN HTTP
// =============================

cron.schedule("0 * * * *", async () => {

  try {

    // =============================
    // 1️⃣ BUSCAR SESIONES INTERNAMENTE
    // =============================
    const { rows: sessions } = await pool.query(
      `
      SELECT
        ts.id,

        TO_CHAR(
          ts.session_date,
          'YYYY-MM-DD'
        ) AS session_date,

        TO_CHAR(
          ts.start_time,
          'HH24:MI'
        ) AS start_time,

        ts.client_id,

        u.fcm_token,
        u.name,

        COALESCE(
          ts.reminder_minutes,
          60
        ) AS reminder_minutes,

        COALESCE(
          c.timezone,
          'America/La_Paz'
        ) AS timezone

      FROM trainer_sessions ts

      JOIN users u
        ON u.id = ts.client_id

      JOIN companies c
        ON c.id = ts.company_id

      WHERE ts.status = 'scheduled'

        AND ts.reminder_sent = false

        AND ts.client_id IS NOT NULL

        AND u.is_active = true

        AND c.is_active = true

        AND c.subscription_status = 'active'

        AND (
          c.expiration_date IS NULL
          OR c.expiration_date >= CURRENT_DATE
        )
      `
    );

    if (sessions.length === 0) {
      return;
    }

    // =============================
    // 2️⃣ PROCESAR SESIONES
    // =============================
    for (const s of sessions) {

      try {

        const minutes =
          Number(s.reminder_minutes);

        // 0 = cliente no quiere recordatorio
        if (
          !Number.isFinite(minutes) ||
          minutes <= 0
        ) {
          continue;
        }

        const tz =
          s.timezone ||
          "America/La_Paz";

        const nowTz =
          dayjs().tz(tz);

        const sessionDateTime =
          dayjs.tz(
            `${s.session_date} ${s.start_time}`,
            tz
          );

        if (!sessionDateTime.isValid()) {

          console.error(
            "❌ FECHA SESIÓN INVÁLIDA:",
            s.id
          );

          continue;
        }

        const reminderTime =
          sessionDateTime.subtract(
            minutes,
            "minute"
          );

        // Aún no llegó la hora
        if (
          nowTz.valueOf() <
          reminderTime.valueOf()
        ) {
          continue;
        }

        // La sesión ya comenzó/pasó
        if (
          nowTz.valueOf() >=
          sessionDateTime.valueOf()
        ) {
          continue;
        }

        // =============================
        // 3️⃣ CLIENTE SIN TOKEN
        // =============================
        if (!s.fcm_token) {

          console.log(
            "⚠️ Cliente sin FCM token:",
            s.client_id
          );

          continue;
        }

        // =============================
        // 4️⃣ ENVIAR PUSH
        // =============================
        await admin.messaging().send({

          token: s.fcm_token,

          notification: {
            title: "Entrenamiento próximo 💪",
            body:
              `Hola ${s.name}, tienes sesión pronto`,
          },

          data: {
            type: "session_reminder",
            sessionId: s.id.toString(),
          },

          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId:
                "high_importance_channel",
            },
          },

          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        });

        // =============================
        // 5️⃣ MARCAR SOLO SI FIREBASE OK
        // =============================
        await pool.query(
          `
          UPDATE trainer_sessions
          SET reminder_sent = true
          WHERE id = $1
            AND reminder_sent = false
          `,
          [s.id]
        );

        console.log(
          "✅ Recordatorio trainer enviado:",
          s.id
        );

      } catch (sendError) {

        console.error(
          "❌ ERROR RECORDATORIO SESIÓN:",
          s.id,
          sendError.message
        );
      }
    }

  } catch (err) {

    console.error(
      "❌ ERROR CRON TRAINER:",
      err.message
    );
  }

});

// =============================
// 🔔 RECORDATORIOS VENCIMIENTO MEMBRESÍA
// GYM - CONSULTA INTERNA
// =============================

cron.schedule("* * * * *", async () => {

  try {

    // =============================
    // 1️⃣ BUSCAR CLIENTES PRÓXIMOS A VENCER
    // =============================

    const { rows: clients } = await pool.query(
      `
      SELECT
        u.id AS user_id,
        u.company_id,
        u.name,
        u.fcm_token,

        TO_CHAR(
          u.membership_end,
          'YYYY-MM-DD'
        ) AS membership_end,

        COALESCE(
          c.timezone,
          'America/La_Paz'
        ) AS timezone

      FROM users u

      JOIN companies c
        ON c.id = u.company_id

      WHERE u.role = 'client'

        AND u.is_active = true

        AND u.membership_status = 'active'

        AND u.membership_end IS NOT NULL

        AND c.type = 'gym'

        AND c.is_active = true

        AND c.subscription_status = 'active'

        AND (
          c.expiration_date IS NULL
          OR c.expiration_date >=
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE COALESCE(
                c.timezone,
                'America/La_Paz'
              )
            )::date
        )

        AND u.membership_end
          BETWEEN
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE COALESCE(
                c.timezone,
                'America/La_Paz'
              )
            )::date
          AND
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE COALESCE(
                c.timezone,
                'America/La_Paz'
              )
            )::date + 5
      `
    );

    // =============================
    // 2️⃣ PROCESAR CLIENTES
    // =============================

    for (const client of clients) {

      let logId = null;

      try {

        const tz =
          client.timezone ||
          "America/La_Paz";

        const nowTz =
          dayjs().tz(tz);

        // No mandar avisos de madrugada.
        // Si Render estuvo apagado a las 9,
        // puede enviarlo más tarde ese mismo día.
        if (
          nowTz.hour() < 9 ||
          nowTz.hour() > 20
        ) {
          continue;
        }

        const today =
          nowTz.startOf("day");

        const membershipEnd =
          dayjs.tz(
            client.membership_end,
            "YYYY-MM-DD",
            tz
          ).startOf("day");

        if (!membershipEnd.isValid()) {
          continue;
        }

        const daysLeft =
          membershipEnd.diff(
            today,
            "day"
          );

        // =============================
        // SOLO 5, 2 Y 0 DÍAS
        // =============================

        if (
          daysLeft !== 5 &&
          daysLeft !== 2 &&
          daysLeft !== 0
        ) {
          continue;
        }

        // =============================
        // CLIENTE SIN TOKEN
        // =============================

        if (!client.fcm_token) {
          continue;
        }

        // =============================
        // 3️⃣ RECLAMAR RECORDATORIO
        // EVITA DUPLICADOS
        // =============================

        const { rows: logRows } =
          await pool.query(
            `
            INSERT INTO membership_reminder_logs
            (
              user_id,
              company_id,
              membership_end,
              reminder_days
            )
            VALUES ($1,$2,$3,$4)

            ON CONFLICT
            (
              user_id,
              company_id,
              membership_end,
              reminder_days
            )
            DO NOTHING

            RETURNING id
            `,
            [
              client.user_id,
              client.company_id,
              client.membership_end,
              daysLeft
            ]
          );

        // Otro proceso ya lo envió
        // o ya fue enviado anteriormente.
        if (logRows.length === 0) {
          continue;
        }

        logId = logRows[0].id;

        // =============================
        // 4️⃣ TEXTO DEL RECORDATORIO
        // =============================

        let title;
        let body;

        if (daysLeft === 5) {

          title =
            "Tu membresía vence pronto ⏳";

          body =
            `Hola ${client.name}, tu membresía vence en 5 días.`;

        } else if (daysLeft === 2) {

          title =
            "Tu membresía está por vencer 🔔";

          body =
            `Hola ${client.name}, quedan 2 días para renovar tu membresía.`;

        } else {

          title =
            "Tu membresía vence hoy";

          body =
            `Hola ${client.name}, tu membresía vence hoy. Puedes renovarla desde HIBRID.`;

        }

        // =============================
        // 5️⃣ ENVIAR PUSH
        // =============================

        await admin.messaging().send({

          token: client.fcm_token,

          notification: {
            title,
            body,
          },

          data: {
            type:
              "membership_expiry_reminder",

            membershipEnd:
              client.membership_end,

            reminderDays:
              daysLeft.toString(),
          },

          android: {

            priority: "high",

            notification: {

              sound: "default",

              channelId:
                "high_importance_channel",

            },

          },

          apns: {

            headers: {
              "apns-priority": "10",
            },

            payload: {

              aps: {
                sound: "default",
                badge: 1,
              },

            },

          },

        });

        console.log(
          "✅ Recordatorio membresía enviado:",
          client.user_id,
          daysLeft
        );

      } catch (sendError) {

        // =============================
        // SI FIREBASE FALLÓ,
        // LIBERAR EL REGISTRO
        // PARA PODER REINTENTAR
        // =============================

        if (logId) {

          try {

            await pool.query(
              `
              DELETE FROM membership_reminder_logs
              WHERE id = $1
              `,
              [logId]
            );

          } catch (_) {}

        }

        console.error(
          "❌ ERROR RECORDATORIO MEMBRESÍA:",
          client.user_id,
          sendError.message
        );
      }
    }

  } catch (err) {

    console.error(
      "❌ ERROR CRON MEMBRESÍAS:",
      err.message
    );

  }

});

const membershipRoutes = require('./routes/membership.cjs');

app.use('/', membershipRoutes);

const storeRoutes = require('./modules/store/storeRoutes.cjs');
app.use('/store', storeRoutes);

const cashRoutes = require('./routes/cash.cjs');
app.use('/cash', cashRoutes);

const adminExpenseCategoriesRoutes = require('./routes/adminExpenseCategories.cjs');

app.use('/admin', adminExpenseCategoriesRoutes);

const adminPaymentQrRoutes = require('./routes/adminPaymentQr.cjs');

app.use('/admin', adminPaymentQrRoutes);

const superadminRoutes = require('./modules/superadmin/superadminRoutes.cjs');

const notificationsRoutes = require('./modules/notifications/notificationsRoutes.cjs');

app.use('/superadmin', superadminRoutes);

app.use('/notifications', notificationsRoutes);

const requireAuth = require("./middlewares/requireAuth.cjs"); // 👈 arriba del archivo

app.post("/users/save-fcm-token", requireAuth, async (req, res) => {

  try {

    const { token } = req.body;

    const userId = req.user.id; // 👈 viene del middleware

    await pool.query(
      "UPDATE users SET fcm_token = $1 WHERE id = $2",
      [token, userId]
    );

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

const passwordRecoveryRoutes = require('./routes/passwordRecovery.cjs');
app.use('/auth', passwordRecoveryRoutes);

app.use('/trainer', require('./modules/trainer/trainerClientsRoutes.cjs'));

app.use('/trainer/sessions', require('./routes/trainerSessions.cjs'));