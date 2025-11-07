import express from "express";
import pg from "pg";

const router = express.Router();
const { Pool } = pg;

const pool = new Pool({
  user: "postgres",             
  host: "172.19.0.1",        
  database: "incidentdb",   
  password: "yourpassword",  
  port: 5432,                
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check db connectivity first
    const client = await pool.connect();
    console.log("✅ Connected to Postgres");

    const query = `
      SELECT user_id, username, password_hash, role
      FROM users
      WHERE username = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [username]);

    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];

    // NOTE: Normally compare hash. For now just compare plain password.
    if (user.password_hash !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log(`✅ Login success: ${user.username}`);
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Server Error, check logs" });
  }
});

export default router;
