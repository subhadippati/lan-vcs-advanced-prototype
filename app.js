const express = require("express");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const PORT = 5000;
const META_FILE = "./metadata.json";
const USERS_FILE = "./users.json";
const STORAGE_DIR = "./storage/files";

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

// ---------- Helpers ----------
function loadMetadata() {
  return JSON.parse(fs.readFileSync(META_FILE));
}
function saveMetadata(data) {
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2));
}
function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}
function generateHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ---------- Auth Middleware ----------
function auth(req, res, next) {
  const token = req.headers["x-auth-token"];
  if (!token) return res.status(401).json({ message: "No token" });

  const users = loadUsers().users;
  const user = users.find(u => u.token === token);
  if (!user) return res.status(401).json({ message: "Invalid token" });

  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

// ---------- Multer ----------
const storage = multer.diskStorage({
  destination: STORAGE_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// ---------- AUTH ROUTES ----------
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const data = loadUsers();

  const user = data.users.find(
    u => u.username === username && u.password === password
  );

  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  user.token = uuidv4();
  saveUsers(data);

  res.json({ token: user.token, role: user.role });
});

// ---------- FILE LOCKING ----------
function isLocked(filename) {
  const data = loadMetadata();
  return data.locks[filename];
}

function lockFile(filename, user) {
  const data = loadMetadata();
  data.locks[filename] = {
    lockedBy: user.username,
    lockedAt: new Date()
  };
  saveMetadata(data);
}

function unlockFile(filename) {
  const data = loadMetadata();
  delete data.locks[filename];
  saveMetadata(data);
}

// ---------- UPLOAD ----------
app.post("/upload", auth, upload.single("file"), (req, res) => {
  const { originalname, path } = req.file;

  const meta = loadMetadata();

  if (meta.locks[originalname] && meta.locks[originalname].lockedBy !== req.user.username) {
    return res.status(423).json({ message: "File is locked" });
  }

  lockFile(originalname, req.user);

  const hash = generateHash(path);
  let file = meta.files.find(f => f.name === originalname);

  if (!file) {
    file = { name: originalname, versions: [] };
    meta.files.push(file);
  }

  const version = file.versions.length + 1;

  file.versions.push({
    version,
    path,
    hash,
    uploadedBy: req.user.username,
    uploadedAt: new Date()
  });

  unlockFile(originalname);
  saveMetadata(meta);

  io.emit("file-updated", { file: originalname, version });

  res.json({ message: "Uploaded", version });
});

// ---------- LIST FILES ----------
app.get("/files", auth, (req, res) => {
  const meta = loadMetadata();
  res.json(meta.files);
});

// ---------- FILE VERSIONS ----------
app.get("/files/:name/versions", auth, (req, res) => {
  const meta = loadMetadata();
  const file = meta.files.find(f => f.name === req.params.name);
  if (!file) return res.status(404).json({ message: "Not found" });
  res.json(file.versions);
});

// ---------- DOWNLOAD ----------
app.get("/download/:name/:version", auth, (req, res) => {
  const { name, version } = req.params;
  const meta = loadMetadata();
  const file = meta.files.find(f => f.name === name);
  if (!file) return res.status(404).json({ message: "Not found" });

  const v = file.versions.find(v => v.version == version);
  if (!v) return res.status(404).json({ message: "Version not found" });

  res.download(v.path);
});

// ---------- VERIFY ----------
app.get("/verify/:name/:version", auth, (req, res) => {
  const { name, version } = req.params;
  const meta = loadMetadata();
  const file = meta.files.find(f => f.name === name);
  if (!file) return res.status(404).json({ message: "Not found" });

  const v = file.versions.find(v => v.version == version);
  if (!v) return res.status(404).json({ message: "Version not found" });

  const currentHash = generateHash(v.path);

  res.json({
    stored: v.hash,
    current: currentHash,
    valid: v.hash === currentHash
  });
});

// ---------- ADMIN ROUTES ----------
app.get("/admin/locks", auth, adminOnly, (req, res) => {
  const meta = loadMetadata();
  res.json(meta.locks);
});

app.post("/admin/unlock/:name", auth, adminOnly, (req, res) => {
  unlockFile(req.params.name);
  res.json({ message: "Unlocked" });
});

// ---------- SOCKET ----------
io.on("connection", socket => {
  console.log("User connected");
});

// ---------- START ----------
server.listen(PORT, () => {
  console.log(`Advanced prototype running on port ${PORT}`);
});
