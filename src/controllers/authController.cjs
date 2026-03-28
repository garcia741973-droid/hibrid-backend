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
  SELECT u.*, c.type as company_type
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
    company_type: user.company_type // 🔥 NUEVO
  }
  });

 }catch(error){

  res.status(500).json({error:error.message});

 }

};