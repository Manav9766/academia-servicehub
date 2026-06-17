const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("public"));

app.use(
  session({
    secret: "sprint2secret",
    resave: false,
    saveUninitialized: false,
  })
);

const DATA_FILE = path.join(__dirname, "data", "db.json");

function readData() {
  const data = fs.readFileSync(DATA_FILE);
  return JSON.parse(data);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const users = [
  {
    username: "student",
    password: "123",
    role: "student",
  },
  {
    username: "staff",
    password: "123",
    role: "staff",
  },
  {
    username: "admin",
    password: "123",
    role: "admin",
  },
];

function authMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  next();
}

function roleMiddleware(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.send("Access Denied");
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
    return res.send("Invalid Credentials");
  }

  req.session.user = user;

  if (user.role === "student") {
    return res.redirect("/student");
  }

  if (user.role === "staff") {
    return res.redirect("/staff");
  }

  if (user.role === "admin") {
    return res.redirect("/admin");
  }
});

app.get("/student", authMiddleware, roleMiddleware("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "student.html"));
});

app.get("/staff", authMiddleware, roleMiddleware("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get("/admin", authMiddleware, roleMiddleware("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get(
  "/submit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "views", "submit-request.html"));
  }
);

app.post("/submit-request", authMiddleware, (req, res) => {
  const data = readData();

  const newRequest = {
    id: Date.now(),
    student: req.session.user.username,
    issue: req.body.issue,
    status: "Pending",
  };

  data.requests.push(newRequest);

  writeData(data);

  res.redirect("/track-requests");
});

app.get(
  "/track-requests",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "views", "track-requests.html"));
  }
);

app.get("/api/student-requests", authMiddleware, (req, res) => {
  const data = readData();

  const requests = data.requests.filter(
    (r) => r.student === req.session.user.username
  );

  res.json(requests);
});

app.get("/staff-requests", authMiddleware, roleMiddleware("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff-requests.html"));
});

app.get("/api/all-requests", authMiddleware, roleMiddleware("staff"), (req, res) => {
  const data = readData();

  res.json(data.requests);
});

app.post("/update-status", authMiddleware, roleMiddleware("staff"), (req, res) => {
  const data = readData();

  const request = data.requests.find(
    (r) => r.id == req.body.id
  );

  if (request) {
    request.status = req.body.status;
    if (req.body.notes !== undefined) {
      request.notes = req.body.notes;
    }
  }

  writeData(data);

  res.redirect("/staff-requests");
});

app.post("/book-appointment", authMiddleware, (req, res) => {
  const data = readData();

  const appointment = {
    id: Date.now(),
    student: req.session.user.username,
    date: req.body.date,
    service: req.body.service,
  };

  data.appointments.push(appointment);

  writeData(data);

  res.send("Appointment Booked Successfully");
});

app.get("/api/appointments", authMiddleware, (req, res) => {
  const data = readData();

  const appointments = data.appointments.filter(
    (a) => a.student === req.session.user.username
  );

  res.json(appointments);
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});