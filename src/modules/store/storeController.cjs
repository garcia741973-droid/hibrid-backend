const { pool } = require('../../config/db');


// obtener productos
exports.getProducts = async (req, res) => {
  try {

    const { rows } = await pool.query(`
      SELECT id,name,description,price,stock,image_url
      FROM products
      WHERE is_active = true
      ORDER BY name
    `);

    res.json(rows);

    }catch(err){

    console.error("ERROR PRODUCTS:", err);

    res.status(500).json({
        error:'Error obteniendo productos',
        details: err.message
    });

    }
};


// crear producto
exports.createProduct = async (req, res) => {

  try {

    const {
      name,
      description,
      cost_price,
      price,
      stock,
      image_url
    } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO products
      (name,description,cost_price,price,stock,image_url)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [name, description || '', cost_price, price, stock, image_url]
    );

    res.json(rows[0]);

  } 
  
  catch (err) {

  console.error("🔥 CREATE PRODUCT ERROR REAL:", err);

  res.status(500).json({
    error: 'Error creando producto',
    details: err.message
  });

}
};

exports.createSale = async (req,res)=>{

  const client = await pool.connect();

  try{

    await client.query('BEGIN');

    const staffId = req.user.id;
    const { items } = req.body;

    let total = 0;

    const sale = await client.query(
      `INSERT INTO sales (staff_id,total)
       VALUES ($1,0)
       RETURNING id`,
      [staffId]
    );

    const saleId = sale.rows[0].id;

    for(const item of items){

      const product = await client.query(
        `SELECT stock,is_active
         FROM products
         WHERE id=$1`,
        [item.product_id]
      );

      if(product.rows.length===0)
        throw new Error('Producto no existe');

      const p = product.rows[0];

      if(!p.is_active)
        throw new Error('Producto inactivo');

      if(p.stock < item.quantity)
        throw new Error('Stock insuficiente');

      const subtotal = item.quantity * item.unit_price;

      total += subtotal;

      await client.query(
        `
        INSERT INTO sale_items
        (sale_id,product_id,quantity,unit_price,subtotal)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [saleId,item.product_id,item.quantity,item.unit_price,subtotal]
      );

        /// DESCUENTA STOCK
        await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id=$2
        `,
        [item.quantity,item.product_id]
        );

        /// 🔥 REGISTRAR SALIDA (VENTA)
        await client.query(
        `
        INSERT INTO stock_movements
        (product_id, type, quantity, staff_id)
        VALUES ($1, 'OUT', $2, $3)
        `,
        [item.product_id, item.quantity, staffId]
        );

    }

    await client.query(
      `
      UPDATE sales
      SET total=$1
      WHERE id=$2
      `,
      [total,saleId]
    );

    await client.query(
      `
      INSERT INTO cash_movements
      (type,reference_type,reference_id,amount,staff_id)
      VALUES ('income','sale',$1,$2,$3)
      `,
      [saleId,total,staffId]
    );

    await client.query('COMMIT');

    res.json({
      success:true,
      sale_id:saleId,
      total
    });

  }catch(err){

    await client.query('ROLLBACK');

    res.status(400).json({
      error:err.message
    });

  }finally{
    client.release();
  }

};

exports.cancelSale = async (req,res)=>{

  const client = await pool.connect();

  try{

    await client.query('BEGIN');

    const saleId = req.params.id;

    const items = await client.query(
      `
      SELECT product_id,quantity
      FROM sale_items
      WHERE sale_id=$1
      `,
      [saleId]
    );

    for(const item of items.rows){

      await client.query(
        `
        UPDATE products
        SET stock = stock + $1
        WHERE id=$2
        `,
        [item.quantity,item.product_id]
      );

    }

    await client.query(
      `
      UPDATE sales
      SET status='cancelled'
      WHERE id=$1
      `,
      [saleId]
    );

    await client.query('COMMIT');

    res.json({success:true});

  }catch(err){

    await client.query('ROLLBACK');

    res.status(400).json({error:err.message});

  }finally{
    client.release();
  }

};

exports.updateProduct = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      name,
      cost_price,
      price,
      stock,
      image_url
    } = req.body;

    console.log("UPDATE DATA:", {
      id,
      name,
      cost_price,
      price,
      stock,
      image_url
    });

    const { rows } = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        cost_price = $2,
        price = $3,
        stock = $4,
        image_url = $5
      WHERE id = $6
      RETURNING *
      `,
      [
        name,
        cost_price,
        price,
        stock,
        image_url,
        id
      ]
    );

    res.json(rows[0]);

  } catch (err) {

    console.error("🔥 UPDATE PRODUCT ERROR REAL:", err);

    res.status(500).json({
      error: "Error actualizando producto",
      details: err.message
    });

  }

};

exports.addStock = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const { product_id, quantity, cost_price } = req.body;
    const staffId = req.user.id;

    /// 1. VALIDAR PRODUCTO
    const product = await client.query(
      `SELECT stock FROM products WHERE id=$1`,
      [product_id]
    );

    if(product.rows.length === 0){
      throw new Error("Producto no existe");
    }

    /// 2. ACTUALIZAR STOCK
    await client.query(
      `
      UPDATE products
      SET stock = stock + $1
      WHERE id = $2
      `,
      [quantity, product_id]
    );

    /// 3. REGISTRAR MOVIMIENTO
    await client.query(
      `
      INSERT INTO stock_movements
      (product_id, type, quantity, cost_price, staff_id)
      VALUES ($1, 'IN', $2, $3, $4)
      `,
      [product_id, quantity, cost_price, staffId]
    );

    /// 4. REGISTRAR EGRESO (IMPORTANTE 💰)
    await client.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, reference_id, amount, staff_id)
      VALUES ('expense', 'stock', $1, $2, $3)
      `,
      [product_id, quantity * cost_price, staffId]
    );

    await client.query('COMMIT');

    res.json({ success: true });

  } catch (err) {

    await client.query('ROLLBACK');

    res.status(400).json({
      error: err.message
    });

  } finally {
    client.release();
  }

};

exports.getProductHistory = async (req, res) => {

  try {

    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT 
        sm.id,
        sm.type,
        sm.quantity,
        sm.cost_price,
        sm.created_at,
        u.name as staff_name
      FROM stock_movements sm
      LEFT JOIN users u ON u.id = sm.staff_id
      WHERE sm.product_id = $1
      ORDER BY sm.created_at ASC
      `,
      [id]
    );

    let stock = 0;
    let totalCost = 0;

    const history = rows.map(r => {

      if(r.type === 'IN'){
        stock += r.quantity;
        totalCost += (r.quantity * (r.cost_price || 0));
      }

        if(r.type === 'OUT'){
        stock -= r.quantity;

        /// 🔥 reducir costo proporcional
        const avg = stock > 0 ? totalCost / (stock + r.quantity) : 0;
        totalCost -= avg * r.quantity;
        }

      return {
        ...r,
        stock_after: stock,
        avg_cost: stock > 0 ? totalCost / stock : 0
      };

    });

    res.json(history);

  } catch (err) {

    console.error("HISTORY ERROR", err);

    res.status(500).json({
      error: "Error obteniendo historial"
    });

  }

};