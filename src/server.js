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

const storeRoutes = require('./modules/store/storeRoutes');
app.use('/store', storeRoutes);