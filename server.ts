import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway persistence: Use /data/laundry.db if it exists or is specified
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "laundry.db");
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- In a real app, hash this
    role TEXT NOT NULL, -- 'admin', 'operator'
    branch_id INTEGER,
    name TEXT,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    client_id INTEGER,
    branch_id INTEGER,
    description TEXT,
    weight REAL,
    pieces INTEGER,
    total_price REAL,
    status TEXT DEFAULT 'received', 
    payment_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  );
`);

// Seed initial data if empty
const branchCount = db.prepare("SELECT count(*) as count FROM branches").get() as { count: number };
if (branchCount.count === 0) {
  const b1 = db.prepare("INSERT INTO branches (name, location) VALUES (?, ?)").run("Sucursal Centro", "Av. Juárez 123").lastInsertRowid;
  const b2 = db.prepare("INSERT INTO branches (name, location) VALUES (?, ?)").run("Sucursal Norte", "Blvd. Norte 456").lastInsertRowid;

  // Seed users
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run("admin", "admin123", "admin", "Administrador");
  db.prepare("INSERT INTO users (username, password, role, branch_id, name) VALUES (?, ?, ?, ?, ?)").run("operador1", "op123", "operator", b1, "Juan Pérez (Centro)");
  db.prepare("INSERT INTO users (username, password, role, branch_id, name) VALUES (?, ?, ?, ?, ?)").run("operador2", "op123", "operator", b2, "María García (Norte)");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple Auth Middleware (Mock for demo purposes, would use JWT/Sessions in production)
  const getAuthUser = (req: express.Request) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return null;
    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  };

  // Auth Route
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  });

  // API Routes
  app.get("/api/branches", (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (user.role === 'admin') {
      const branches = db.prepare("SELECT * FROM branches").all();
      res.json(branches);
    } else {
      const branches = db.prepare("SELECT * FROM branches WHERE id = ?").all(user.branch_id);
      res.json(branches);
    }
  });

  app.get("/api/clients", (req, res) => {
    const clients = db.prepare("SELECT * FROM clients").all();
    res.json(clients);
  });

  app.post("/api/clients", (req, res) => {
    const { name, phone, email } = req.body;
    const result = db.prepare("INSERT INTO clients (name, phone, email) VALUES (?, ?, ?)").run(name, phone, email);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/orders", (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    let query = `
      SELECT o.*, c.name as client_name, b.name as branch_name 
      FROM orders o 
      LEFT JOIN clients c ON o.client_id = c.id 
      LEFT JOIN branches b ON o.branch_id = b.id
    `;
    
    let params: any[] = [];
    if (user.role !== 'admin') {
      query += " WHERE o.branch_id = ?";
      params.push(user.branch_id);
    }
    
    query += " ORDER BY o.created_at DESC";
    
    const orders = db.prepare(query).all(...params);
    res.json(orders);
  });

  app.post("/api/orders", (req, res) => {
    const { folio, client_id, branch_id, description, weight, pieces, total_price, status, payment_status } = req.body;
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Security check: operators can only create orders for their branch
    if (user.role !== 'admin' && parseInt(branch_id) !== user.branch_id) {
      return res.status(403).json({ error: "No tienes permiso para esta sucursal" });
    }

    try {
      const result = db.prepare(`
        INSERT INTO orders (folio, client_id, branch_id, description, weight, pieces, total_price, status, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(folio, client_id, branch_id, description, weight, pieces, total_price, status, payment_status);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Check ownership
    const order = db.prepare("SELECT branch_id FROM orders WHERE id = ?").get(id) as any;
    if (user.role !== 'admin' && order.branch_id !== user.branch_id) {
      return res.status(403).json({ error: "No tienes permiso para modificar este ticket" });
    }

    db.prepare("UPDATE orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(status, payment_status, id);
    res.json({ success: true });
  });

  app.get("/api/admin/backup", (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    
    res.download(dbPath, "respaldo_lavanderia.db");
  });

  app.get("/api/admin/users", (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.name, u.branch_id, b.name as branch_name 
      FROM users u 
      LEFT JOIN branches b ON u.branch_id = b.id
    `).all();
    res.json(users);
  });

  app.post("/api/admin/users", (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    
    const { username, password, role, branch_id, name } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO users (username, password, role, branch_id, name) 
        VALUES (?, ?, ?, ?, ?)
      `).run(username, password, role, branch_id || null, name);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly handle SPA fallback for dev
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const template = await vite.transformIndexHtml(req.originalUrl, "");
        // In SPA mode with middlewareMode, Vite handles the index.html serving 
        // if it's not caught by other routes, but sometimes it needs a push.
        // However, appType: 'spa' should have handled this.
        // Let's ensure we don't block it.
        next();
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started successfully on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
