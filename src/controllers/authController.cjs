const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {

 try {

  const { name, email, password, role } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
    `
    INSERT INTO users (name,email,password,role,company_id)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id,name,email,role,company_id
    `,
    [name,email,hashedPassword,role,1]
    );

  res.json(result.rows[0]);

 } catch (error) {

  res.status(500).json({ error: error.message });

 }

};

exports.login = async (req,res)=>{

 try{

  const { email,password } = req.body;

  const result = await pool.query(
  `
    SELECT 
    u.*, 
    c.id as company_id_real,
    c.type as company_type,
    c.name as company_name,
    c.logo_url as company_logo
    FROM users u
    JOIN companies c ON u.company_id = c.id
    WHERE u.email = $1
  `,
  [email]
  );

  const user = result.rows[0];
  console.log("LOGIN USER:", user);

  if(!user){
   return res.status(400).json({error:"Usuario no existe"});
  }

  const validPassword = await bcrypt.compare(password,user.password);

  if(!validPassword){
   return res.status(400).json({error:"Password incorrecto"});
  }

  const token = jwt.sign(
  {
  id: user.id,
  role: user.role,
  company_id: user.company_id,
  company_type: user.company_type // 🔥 NUEVO
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
  );

  res.json({
    token,
    user:{
      id:user.id,
      name:user.name,
      role:user.role,
      company_id: user.company_id,
      company_type: user.company_type
    },
    company:{
      id: user.company_id_real,
      name: user.company_name,
      logo_url: user.company_logo
    }
  });

 }catch(error){

  res.status(500).json({error:error.message});

 }

};

// =============================
// 🔔 ACTUALIZAR RECORDATORIO
// =============================
exports.updateReminder = async (req, res) => {

  console.log("🔥 UPDATE REMINDER:", req.body, req.user.id);

  try {

    const { reminder_minutes } = req.body;

    if (!reminder_minutes) {
      return res.status(400).json({
        error: "reminder_minutes requerido"
      });
    }

    await pool.query(
      `
      UPDATE users
      SET reminder_minutes = $1
      WHERE id = $2
      `,
      [reminder_minutes, req.user.id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error actualizando recordatorio"
    });
  }
};

// =============================
// 🔔 OBTENER RECORDATORIO
// =============================
exports.getReminder = async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT reminder_minutes FROM users WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: "Error obteniendo recordatorio" });
  }
};

// =============================
// 🔐 CAMBIAR CONTRASEÑA
// =============================
exports.changePassword = async (req, res) => {

  console.log("🔐 CHANGE PASSWORD:", req.user.id);

  try {

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: "Datos incompletos"
      });
    }

    /// 🔹 obtener usuario actual
    const result = await pool.query(
      `SELECT password FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    /// 🔹 validar password actual
    const valid = await bcrypt.compare(
      current_password,
      user.password
    );

    if (!valid) {
      return res.status(400).json({
        error: "Contraseña actual incorrecta"
      });
    }

    /// 🔹 nueva password
    const hashed = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashed, req.user.id]
    );

    res.json({
      success: true
    });

  } catch (error) {

    console.error("❌ ERROR CHANGE PASSWORD:", error);

    res.status(500).json({
      error: "Error cambiando contraseña"
    });
  }
};