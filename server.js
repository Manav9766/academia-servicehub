const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "student-services-secret",
    resave: false,
    saveUninitialized: false,
  })
);

const users = [
  { username: "student", password: "student123", role: "student" },
  { username: "staff", password: "staff123", role: "staff" },
  { username: "admin", password: "admin123", role: "admin" },
];

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).send("Access Denied: You are not allowed to view this page.");
    }
    next();
  };
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.redirect("/?error=Invalid username or password");
  }

  req.session.user = {
    username: user.username,
    role: user.role,
  };

  if (user.role === "student") return res.redirect("/student");
  if (user.role === "staff") return res.redirect("/staff");
  if (user.role === "admin") return res.redirect("/admin");
});

app.get("/student", requireLogin, requireRole("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "student.html"));
});

app.get("/staff", requireLogin, requireRole("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get("/admin", requireLogin, requireRole("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});