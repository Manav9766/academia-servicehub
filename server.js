require("dotenv").config();

const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data", "db.json");
const UPLOAD_DIRECTORY = path.join(__dirname, "public", "uploads");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const REQUEST_CATEGORIES = [
  "Academic Advising",
  "Registration & Enrollment",
  "Financial Aid",
  "IT Support",
  "Career Services",
  "Mental Health",
  "General",
];

const REQUEST_STATUSES = [
  "Submitted",
  "In Progress",
  "Completed",
  "Closed",
  "Cancelled",
];

const DEFAULT_USERS = [
  {
    id: 1,
    username: "student",
    password: "123",
    role: "student",
    status: "active",
  },
  {
    id: 2,
    username: "staff",
    password: "123",
    role: "staff",
    status: "active",
  },
  {
    id: 3,
    username: "admin",
    password: "123",
    role: "admin",
    status: "active",
  },
];

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".doc",
  ".docx",
]);

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "attachment";

    return {
      folder: "academia-servicehub",
      resource_type: "auto",
      public_id: `${Date.now()}-${safeBaseName}`,
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
    const hasAllowedMimeType = ALLOWED_MIME_TYPES.has(file.mimetype);

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return cb(
        new Error("Unsupported file type. Please upload PNG, JPG, PDF, DOC, or DOCX files.")
      );
    }

    cb(null, true);
  },
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "sprint2secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 1000 * 60 * 60,
      httpOnly: true,
    },
  })
);

function normalizeRequestStatus(status) {
  if (status === "Pending") {
    return "Submitted";
  }

  if (status === "Resolved") {
    return "Completed";
  }

  return REQUEST_STATUSES.includes(status) ? status : "Submitted";
}

function getEmptyDatabase() {
  return {
    users: DEFAULT_USERS.map((user) => ({ ...user })),
    requests: [],
    appointments: [],
  };
}

function readDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return getEmptyDatabase();
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      users: Array.isArray(data.users) && data.users.length > 0
        ? data.users
        : DEFAULT_USERS.map((user) => ({ ...user })),
      requests: Array.isArray(data.requests)
        ? data.requests.map((request) => ({
            ...request,
            status: normalizeRequestStatus(request.status),
          }))
        : [],
      appointments: Array.isArray(data.appointments) ? data.appointments : [],
    };
  } catch (error) {
    console.error("Failed to read database:", error);
    return getEmptyDatabase();
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getNextId(items) {
  if (!items.length) return 1;
  return Math.max(...items.map((item) => Number(item.id) || 0)) + 1;
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

function redirectForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/student";
}

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect(redirectForRole(req.session.user.role));
  }
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDatabase();
  const user = db.users.find(
    (candidate) => candidate.username === username && candidate.password === password
  );

  if (!user) {
    return res.status(401).render("login", {
      error: "Invalid username or password.",
    });
  }

  if (user.status === "disabled") {
    return res.status(403).render("login", {
      error: "This account is disabled.",
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  res.redirect(redirectForRole(user.role));
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/student", requireAuth, requireRole("student"), (req, res) => {
  const db = readDatabase();
  const requests = db.requests.filter(
    (request) => request.studentId === req.session.user.id
  );
  const appointments = db.appointments.filter(
    (appointment) => appointment.studentId === req.session.user.id
  );

  res.render("student-dashboard", {
    user: req.session.user,
    requests,
    appointments,
    categories: REQUEST_CATEGORIES,
  });
});

app.post(
  "/student/requests",
  requireAuth,
  requireRole("student"),
  upload.single("attachment"),
  (req, res) => {
    const { category, subject, description } = req.body;
    const cleanedSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanedDescription = typeof description === "string" ? description.trim() : "";

    if (!REQUEST_CATEGORIES.includes(category) || !cleanedSubject || !cleanedDescription) {
      return res.status(400).send("Please provide a valid category, subject, and description.");
    }

    const db = readDatabase();
    const request = {
      id: getNextId(db.requests),
      studentId: req.session.user.id,
      studentName: req.session.user.username,
      category,
      subject: cleanedSubject,
      description: cleanedDescription,
      status: "Submitted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      staffNote: "",
      attachment: req.file
        ? {
            name: req.file.originalname,
            url: req.file.path,
          }
        : null,
    };

    db.requests.push(request);
    writeDatabase(db);
    res.redirect("/student");
  }
);

app.post(
  "/student/appointments",
  requireAuth,
  requireRole("student"),
  (req, res) => {
    const { service, appointmentDate, notes } = req.body;
    const cleanedAppointmentDate =
      typeof appointmentDate === "string" ? appointmentDate.trim() : "";
    const cleanedNotes = typeof notes === "string" ? notes.trim() : "";

    if (!REQUEST_CATEGORIES.includes(service) || !cleanedAppointmentDate) {
      return res.status(400).send("Please provide a valid service and appointment date.");
    }

    const db = readDatabase();
    const appointment = {
      id: getNextId(db.appointments),
      studentId: req.session.user.id,
      studentName: req.session.user.username,
      service,
      appointmentDate: cleanedAppointmentDate,
      notes: cleanedNotes,
      status: "Scheduled",
      createdAt: new Date().toISOString(),
    };

    db.appointments.push(appointment);
    writeDatabase(db);
    res.redirect("/student");
  }
);

app.get("/staff", requireAuth, requireRole("staff"), (req, res) => {
  const db = readDatabase();
  const activeRequests = db.requests.filter(
    (request) => !["Closed", "Cancelled"].includes(request.status)
  );

  res.render("staff-dashboard", {
    user: req.session.user,
    requests: activeRequests,
    statuses: REQUEST_STATUSES,
  });
});

app.post(
  "/staff/requests/:id/status",
  requireAuth,
  requireRole("staff"),
  (req, res) => {
    const requestId = Number(req.params.id);
    const { status, staffNote } = req.body;

    if (!REQUEST_STATUSES.includes(status)) {
      return res.status(400).send("Invalid request status.");
    }

    const db = readDatabase();
    const request = db.requests.find((item) => item.id === requestId);

    if (!request) {
      return res.status(404).send("Request not found.");
    }

    request.status = status;
    request.staffNote = (staffNote || "").trim();
    request.updatedAt = new Date().toISOString();
    writeDatabase(db);
    res.redirect("/staff");
  }
);

app.get("/admin", requireAuth, requireRole("admin"), (req, res) => {
  const db = readDatabase();

  res.render("admin-dashboard", {
    user: req.session.user,
    users: db.users,
    requests: db.requests,
    appointments: db.appointments,
  });
});

app.post(
  "/admin/users/:id/status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const userId = Number(req.params.id);
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).send("Invalid user status.");
    }

    const db = readDatabase();
    const user = db.users.find((candidate) => candidate.id === userId);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    user.status = status;
    writeDatabase(db);
    res.redirect("/admin");
  }
);

app.get("/admin/requests/:id", requireAuth, requireRole("admin"), (req, res) => {
  const requestId = Number(req.params.id);
  const db = readDatabase();
  const request = db.requests.find((item) => item.id === requestId);

  if (!request) {
    return res.status(404).send("Request not found.");
  }

  res.render("admin-request", {
    user: req.session.user,
    request,
    statuses: REQUEST_STATUSES,
  });
});

app.post(
  "/admin/requests/:id/status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const requestId = Number(req.params.id);
    const { status, staffNote } = req.body;

    if (!REQUEST_STATUSES.includes(status)) {
      return res.status(400).send("Invalid request status.");
    }

    const db = readDatabase();
    const request = db.requests.find((item) => item.id === requestId);

    if (!request) {
      return res.status(404).send("Request not found.");
    }

    request.status = status;
    request.staffNote = (staffNote || "").trim();
    request.updatedAt = new Date().toISOString();
    writeDatabase(db);
    res.redirect(`/admin/requests/${requestId}`);
  }
);

app.post(
  "/admin/appointments/:id/status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const appointmentId = Number(req.params.id);
    const { status } = req.body;

    if (!["Scheduled", "Completed", "Cancelled"].includes(status)) {
      return res.status(400).send("Invalid appointment status.");
    }

    const db = readDatabase();
    const appointment = db.appointments.find((item) => item.id === appointmentId);

    if (!appointment) {
      return res.status(404).send("Appointment not found.");
    }

    appointment.status = status;
    writeDatabase(db);
    res.redirect("/admin");
  }
);

app.use((err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).send("Attachment is too large. Maximum size is 10 MB.");
  }

  if (err.message && err.message.startsWith("Unsupported file type")) {
    return res.status(400).send(err.message);
  }

  res.status(500).send("Something went wrong.");
});

app.listen(PORT, () => {
  console.log(`Academia Service Hub running on http://localhost:${PORT}`);
});
