require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "book_tracker",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "personal-book-tracker-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in first" });
  }
  next();
}

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hash]
    );
    req.session.userId = result.insertId;
    req.session.username = username;
    res.json({ success: true, username });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const [rows] = await pool.execute(
      "SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?",
      [username, username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/me", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username, userId: req.session.userId });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get("/api/books", requireAuth, async (req, res) => {
  try {
    const { status, search, sort } = req.query;
    let sql = "SELECT * FROM books WHERE user_id = ?";
    const params = [req.session.userId];
    if (status && ["want_to_read", "reading", "read"].includes(status)) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (search) {
      sql += " AND (title LIKE ? OR author LIKE ? OR genre LIKE ? OR review LIKE ?)";
      const term = "%" + search + "%";
      params.push(term, term, term, term);
    }
    if (sort === "title") sql += " ORDER BY title ASC";
    else if (sort === "author") sql += " ORDER BY author ASC";
    else if (sort === "rating") sql += " ORDER BY rating DESC";
    else if (sort === "date_finished") sql += " ORDER BY date_finished DESC";
    else sql += " ORDER BY updated_at DESC";
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

app.get("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM books WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

app.post("/api/books", requireAuth, async (req, res) => {
  try {
    const { title, author, genre, pages, status, rating, date_started, date_finished, review, notes, cover_url } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: "Title and author are required" });
    }
    const [result] = await pool.execute(
      `INSERT INTO books (user_id, title, author, genre, pages, status, rating, date_started, date_finished, review, notes, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.userId, title, author, genre || null, pages || null, status || "want_to_read", rating || null, date_started || null, date_finished || null, review || null, notes || null, cover_url || null]
    );
    const [rows] = await pool.execute("SELECT * FROM books WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add book" });
  }
});

app.put("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const { title, author, genre, pages, status, rating, date_started, date_finished, review, notes, cover_url } = req.body;
    const [check] = await pool.execute(
      "SELECT id FROM books WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.userId]
    );
    if (check.length === 0) return res.status(404).json({ error: "Book not found" });
    await pool.execute(
      `UPDATE books SET title = COALESCE(?, title), author = COALESCE(?, author), genre = ?, pages = ?, status = COALESCE(?, status), rating = ?, date_started = ?, date_finished = ?, review = ?, notes = ?, cover_url = ? WHERE id = ? AND user_id = ?`,
      [title, author, genre || null, pages || null, status, rating || null, date_started || null, date_finished || null, review || null, notes || null, cover_url || null, req.params.id, req.session.userId]
    );
    const [rows] = await pool.execute("SELECT * FROM books WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update book" });
  }
});

app.delete("/api/books/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.execute(
      "DELETE FROM books WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as total,
        SUM(CASE WHEN status = "read" THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = "reading" THEN 1 ELSE 0 END) as reading_count,
        SUM(CASE WHEN status = "want_to_read" THEN 1 ELSE 0 END) as want_count,
        AVG(CASE WHEN rating IS NOT NULL THEN rating END) as avg_rating,
        SUM(CASE WHEN pages IS NOT NULL THEN pages ELSE 0 END) as total_pages
       FROM books WHERE user_id = ?`,
      [req.session.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Personal Book Tracker running at http://localhost:" + PORT);
  console.log("Make sure MySQL is running and the database is set up (see sql/schema.sql)");
});
