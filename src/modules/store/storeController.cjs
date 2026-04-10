const { pool } = require('../../config/db');


// obtener productos
exports.getProducts = async (req, res) => {
  try {

    const companyId = req.user.company_id;

    const { rows } = await pool.query(`
    SELECT id,name,description,price,stock,image_url
    FROM products
    WHERE is_active = true
    AND company_id = $1
    ORDER BY name
    `,
    [companyId]
    );

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

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `
      INSERT INTO products
      (name,description,cost_price,price,stock,image_url,company_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [name, description || '', cost_price, price, stock, image_url, companyId]
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

    const companyId = req.user.company_id;

    const sale = await client.query(
      `INSERT INTO sales (staff_id,total,company_id)
      VALUES ($1,0,$2)
      RETURNING id`,
      [staffId, companyId]
    );

    if (!sale.rows[0]) {
      throw new Error("Error creando venta");
    }

    const saleId = sale.rows[0].id;

    for(const item of items){

      const product = await client.query(
        `SELECT stock,is_active
        FROM products
        WHERE id=$1 AND company_id=$2`,
        [item.product_id, companyId]
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
        (sale_id,product_id,quantity,unit_price,subtotal,company_id)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          saleId,
          item.product_id,
          item.quantity,
          item.unit_price,
          subtotal,
          companyId
        ]
      );

        /// DESCUENTA STOCK
        const update = await client.query(
          `
          UPDATE products
          SET stock = stock - $1
          WHERE id=$2 
          AND company_id=$3
          AND stock >= $1
          RETURNING stock
          `,
          [item.quantity, item.product_id, companyId]
        );

        if(update.rows.length === 0){
          throw new Error('Stock insuficiente (concurrente)');
        }

        /// 🔥 REGISTRAR SALIDA (VENTA) ✅ CON COSTO
        await client.query(
          `
          INSERT INTO stock_movements
          (product_id, type, quantity, cost_price, staff_id, company_id, reference_type, reference_id)
          VALUES ($1, 'OUT', $2, $3, $4, $5, 'sale', $6)
          `,
          [
            item.product_id,
            item.quantity,
            item.unit_price, // 🔥 CLAVE (o cost_price si quieres exactitud contable)
            staffId,
            companyId,
            saleId
          ]
        );

    }

    await client.query(
      `
      UPDATE sales
      SET total=$1
      WHERE id=$2 AND company_id=$3
      `,
      [total, saleId, companyId]
    );


    await client.query(
      `
      INSERT INTO cash_movements
      (type,reference_type,reference_id,amount,staff_id,company_id)
      VALUES ('income','sale',$1,$2,$3,$4)
      `,
      [saleId, total, staffId, companyId]
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

    const companyId = req.user.company_id;

    const items = await client.query(
      `
      SELECT product_id,quantity
      FROM sale_items
      WHERE sale_id=$1 AND company_id=$2
      `,
      [saleId, companyId]
    );


      if (items.rows.length === 0) {
        throw new Error("Venta no encontrada o no autorizada");
      }    

    for(const item of items.rows){

      await client.query(
        `
        UPDATE products
        SET stock = stock + $1
        WHERE id=$2 AND company_id=$3
        `,
        [item.quantity, item.product_id, companyId]
      );
  

    }

    await client.query(
      `
      UPDATE sales
      SET status='cancelled'
      WHERE id=$1 AND company_id=$2
      `,
      [saleId, companyId]
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

    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        cost_price = $2,
        price = $3,
        stock = $4,
        image_url = $5
      WHERE id = $6 AND company_id = $7
      RETURNING *
      `,
      [
        name,
        cost_price,
        price,
        stock,
        image_url,
        id,
        companyId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Producto no encontrado o no autorizado"
      });
    }

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
    const companyId = req.user.company_id;

    /// 1. VALIDAR PRODUCTO
    const product = await client.query(
      `SELECT stock FROM products WHERE id=$1 AND company_id=$2`,
      [product_id, companyId]
    );

    if(product.rows.length === 0){
      throw new Error("Producto no existe");
    }

    /// 2. ACTUALIZAR STOCK
    await client.query(
      `
      UPDATE products
      SET stock = stock + $1
      WHERE id = $2 AND company_id=$3
      `,
      [quantity, product_id, companyId]
    );

    /// 3. REGISTRAR MOVIMIENTO
    await client.query(
      `
      INSERT INTO stock_movements
      (product_id, type, quantity, cost_price, staff_id, company_id, reference_type)
      VALUES ($1, 'IN', $2, $3, $4, $5, 'purchase')
      `,
      [product_id, quantity, cost_price, staffId, companyId]
    );

    /// 4. REGISTRAR EGRESO (IMPORTANTE 💰)
    await client.query(
      `
      INSERT INTO cash_movements
      (type, reference_type, reference_id, amount, staff_id, company_id)
      VALUES ('expense', 'stock', $1, $2, $3, $4)
      `,
      [product_id, quantity * cost_price, staffId, companyId]
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

    const companyId = req.user.company_id;

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
      AND sm.company_id = $2
      ORDER BY sm.created_at ASC
      `,
      [id, companyId]
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

// ===============================
// 📊 INVENTORY REPORT
// ===============================
exports.getInventoryReport = async (req, res) => {

  try {

    const companyId = req.user.company_id;
    const { from, to } = req.query;

    const { rows } = await pool.query(
      `
      SELECT 
        sm.type,
        sm.quantity,
        sm.cost_price,
        sm.reference_type,
        sm.created_at,
        p.name as product_name,
        u.name as staff_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.staff_id
      WHERE sm.company_id = $1
      AND sm.created_at BETWEEN $2 AND $3
      ORDER BY sm.created_at DESC
      `,
      [companyId, from, to]
    );

    let total_in_qty = 0;
    let total_out_qty = 0;
    let total_in_bs = 0;
    let total_out_bs = 0;

    const movements = rows.map(r => {

      const total = (r.quantity || 0) * (r.cost_price || 0);

      if (r.type === 'IN') {
        total_in_qty += r.quantity;
        total_in_bs += total;
      }

      if (r.type === 'OUT') {
        total_out_qty += r.quantity;
        total_out_bs += total;
      }

      return {
        ...r,
        total
      };

    });

    res.json({
      total_in_qty,
      total_out_qty,
      total_in_bs,
      total_out_bs,
      movements
    });

  } catch (err) {

    console.error("INVENTORY REPORT ERROR:", err);

    res.status(500).json({
      error: "Error generando reporte inventario"
    });

  }
};

// desargar a excel 

const ExcelJS = require('exceljs');

exports.exportInventoryExcel = async (req, res) => {

  try {

    const { from, to } = req.query;
    const companyId = req.user.company_id;

    const { rows } = await pool.query(
      `
      SELECT 
        sm.created_at,
        p.name as product_name,
        sm.type,
        sm.quantity,
        sm.cost_price,
        p.price,
        u.name as staff_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.staff_id
      WHERE sm.company_id = $1
      AND sm.created_at BETWEEN $2 AND $3
      ORDER BY sm.created_at ASC
      `,
      [companyId, from, to]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');

    /// HEADERS
    sheet.columns = [
      { header: 'Fecha', key: 'date', width: 20 },
      { header: 'Producto', key: 'product', width: 25 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Cantidad', key: 'qty', width: 10 },
      { header: 'Costo', key: 'cost', width: 12 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'Usuario', key: 'user', width: 20 },
    ];

    /// FILAS
    rows.forEach(r => {
      sheet.addRow({
        date: r.created_at,
        product: r.product_name,
        type: r.type,
        qty: r.quantity,
        cost: r.cost_price || 0,
        price: r.price || 0,
        user: r.staff_name || '',
      });
    });

    /// RESPONSE
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=inventory_report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {

    console.error("EXPORT INVENTORY ERROR:", err);

    res.status(500).json({
      error: "Error exportando inventario"
    });

  }

};