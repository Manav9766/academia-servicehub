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

// In-memory store for appointments
const appointments = [
  { id: 1, student: "student", service: "Academic Advising", date: "2026-06-10", time: "10:00", status: "Scheduled" }
];

app.get("/api/all-requests", requireLogin, requireRole("staff"), (req, res) => {
  res.json(serviceRequests);
});

app.put("/api/requests/:id", requireLogin, requireRole("staff"), (req, res) => {
  const requestId = req.params.id;
  const { status, notes } = req.body;

  const request = serviceRequests.find((req) => req.requestId === requestId);
  if (!request) {
    return res.status(404).json({ error: "Request not found" });
  }

  if (status) request.status = status;
  if (notes !== undefined) request.notes = notes;

  res.json({ message: "Request updated successfully", request });
});

app.get("/api/appointments", requireLogin, requireRole("staff"), (req, res) => {
  res.json(appointments);
});

app.put("/api/appointments/:id", requireLogin, requireRole("staff"), (req, res) => {
  const appointmentId = parseInt(req.params.id, 10);
  const { status } = req.body;

  const appointment = appointments.find((app) => app.id === appointmentId);
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  if (status) appointment.status = status;

  res.json({ message: "Appointment updated successfully", appointment });
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