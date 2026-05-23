const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

const serviceRequests = [];

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

app.get("/submit-request", requireLogin, requireRole("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "submit-request.html"));
});

app.post("/submit-request", requireLogin, requireRole("student"), (req, res) => {
  const { category, subject, description } = req.body;

  if (!category || !subject || !description) {
    return res.redirect("/submit-request?error=All fields are required");
  }

  const requestId = "REQ-" + Date.now();

  serviceRequests.push({
    requestId,
    student: req.session.user.username,
    category,
    subject,
    description,
    status: "Submitted",
    createdAt: new Date().toLocaleString(),
  });

  res.redirect(`/track-requests?success=${requestId}`);
});

app.get("/track-requests", requireLogin, requireRole("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "track-requests.html"));
});

app.get("/api/my-requests", requireLogin, requireRole("student"), (req, res) => {
  const studentRequests = serviceRequests.filter(
    (request) => request.student === req.session.user.username
  );

  res.json(studentRequests);
});

app.get("/staff", requireLogin, requireRole("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get("/staff/requests", requireLogin, requireRole("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff-requests.html"));
});

app.get("/api/all-requests", requireLogin, requireRole("staff"), (req, res) => {
  res.json(serviceRequests);
});

app.post("/staff/update-request-status", requireLogin, requireRole("staff"), (req, res) => {
  const { requestId, status } = req.body;

  const request = serviceRequests.find((request) => request.requestId === requestId);

  if (!request) {
    return res.redirect("/staff/requests?error=Request not found");
  }

  request.status = status;
  res.redirect("/staff/requests?success=Status updated");
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