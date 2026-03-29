const express = require("express");
const cors = require("cors");
require("dotenv").config();

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

app.use('/superadmin', superadminRoutes);

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

app.use('/trainer-packages', require('./modules/trainerPackages/trainerPackagesRoutes.cjs'));

app.use('/trainer', require('./modules/trainer/trainerClientsRoutes.cjs'));