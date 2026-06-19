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
    rolling: true,
    cookie: {
      maxAge: 1000 * 60 * 60,
      httpOnly: true,
    },
  })
);

const DATA_FILE = path.join(__dirname, "data", "db.json");

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      appointments: [],
      requests: [],
    };

    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }

  const data = fs.readFileSync(DATA_FILE);
  const parsedData = JSON.parse(data);

  if (!parsedData.appointments) {
    parsedData.appointments = [];
  }

  if (!parsedData.requests) {
    parsedData.requests = [];
  }

  return parsedData;
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

function redirectByRole(req, res) {
  if (!req.session.user) {
    return res.redirect("/");
  }

  if (req.session.user.role === "student") {
    return res.redirect("/student");
  }

  if (req.session.user.role === "staff") {
    return res.redirect("/staff");
  }

  if (req.session.user.role === "admin") {
    return res.redirect("/admin");
  }

  return res.redirect("/");
}

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
  if (req.session.user) {
    return redirectByRole(req, res);
  }

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

  req.session.user = {
    username: user.username,
    role: user.role,
  };

  req.session.save((err) => {
    if (err) {
      return res.send("Login session error");
    }

    return redirectByRole(req, res);
  });
});

app.get("/student", authMiddleware, roleMiddleware("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "student.html"));
});

app.get("/staff", authMiddleware, roleMiddleware("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get("/staff-appointments", authMiddleware, roleMiddleware("staff"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "staff-appointments.html"));
});

app.get("/admin", authMiddleware, roleMiddleware("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.get("/submit-request", authMiddleware, roleMiddleware("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "submit-request.html"));
});

app.post("/submit-request", authMiddleware, roleMiddleware("student"), (req, res) => {
  const data = readData();

  const newRequest = {
    id: Date.now(),
    student: req.session.user.username,
    issue: req.body.issue,
    status: "Pending",
    notes: "",
  };

  data.requests.push(newRequest);
  writeData(data);

  res.redirect("/track-requests");
});

app.get("/track-requests", authMiddleware, roleMiddleware("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "track-requests.html"));
});

app.get("/api/student-requests", authMiddleware, roleMiddleware("student"), (req, res) => {
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

  const request = data.requests.find((r) => r.id == req.body.id);

  if (request) {
    request.status = req.body.status;

    if (req.body.notes !== undefined) {
      request.notes = req.body.notes;
    }
  }

  writeData(data);

  res.redirect("/staff-requests");
});

app.post("/book-appointment", authMiddleware, roleMiddleware("student"), (req, res) => {
  const data = readData();

  const appointment = {
    id: Date.now(),
    student: req.session.user.username,
    service: req.body.service,
    date: req.body.date,
    time: req.body.time,
    notes: req.body.notes || "",
    staffNotes: "",
    status: "Scheduled",
  };

  data.appointments.push(appointment);
  writeData(data);

  res.redirect("/student");
});

app.get("/api/appointments", authMiddleware, roleMiddleware("student"), (req, res) => {
  const data = readData();

  const appointments = data.appointments.filter(
    (a) => a.student === req.session.user.username
  );

  res.json(appointments);
});

app.get("/api/all-appointments", authMiddleware, roleMiddleware("staff"), (req, res) => {
  const data = readData();
  res.json(data.appointments);
});

app.post("/update-appointment-status", authMiddleware, roleMiddleware("staff"), (req, res) => {
  const data = readData();

  const appointment = data.appointments.find((a) => a.id == req.body.id);

  if (appointment) {
    appointment.status = req.body.status;

    if (req.body.staffNotes !== undefined) {
      appointment.staffNotes = req.body.staffNotes;
    }
  }

  writeData(data);

  res.redirect("/staff-appointments");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});