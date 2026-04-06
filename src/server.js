const express = require("express");
const cors = require("cors");
require("dotenv").config();

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});

const { pool } = require("./config/db");

const authRoutes = require("./routes/auth.cjs");
const adminRoutes = require("./routes/admin.cjs");

const staffMembershipRoutes = require('./routes/staffMembership.cjs');

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

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
const axios = require("axios");

const API_URL = "https://hibrid-backend.onrender.com";

cron.schedule("* * * * *", async () => {
  try {

    console.log("⏰ CRON EJECUTANDO...");

    const res = await axios.get(`${API_URL}/trainer/reminders`);

    const sessions = res.data;

    if (!sessions || sessions.length === 0) {
      console.log("📭 No hay recordatorios");
      return;
    }

    console.log("🔥 RECORDATORIOS ENCONTRADOS:", sessions.length);

    for (const s of sessions) {

      if (!s.fcm_token) {
        console.log("❌ Sin token:", s.client_id);
        continue;
      }

      await axios.post(`${API_URL}/notifications/send`, {
        token: s.fcm_token,
        title: "Entrenamiento próximo 💪",
        body: `Hola ${s.name}, tienes sesión pronto`,
        data: {
          type: "session_reminder",
          sessionId: s.id.toString()
        }
      });

      console.log("✅ Notificación enviada a:", s.name);
    }

  } catch (error) {
    console.error("❌ ERROR CRON:", error.message);
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