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

function normalizeRequestStatus(status) {
  if (status === "Pending") {
    return "Submitted";
  }

  if (status === "Resolved") {
    return "Completed";
  }

  return status || "Submitted";
}

function ensureRequestHistory(request) {
  request.status = normalizeRequestStatus(request.status);

  if (!Array.isArray(request.history)) {
    request.history = [];
  }

  const submissionDate =
    request.createdAt ||
    request.updatedAt ||
    new Date(Number(request.id) || Date.now()).toISOString();

  const hasSubmissionEntry = request.history.some(
    (entry) => entry.type === "submission"
  );

  if (!hasSubmissionEntry) {
    request.history.push({
      id: `${request.id}-submission`,
      type: "submission",
      title: "Request Submitted",
      description: "Service request was submitted by the student.",
      status: "Submitted",
      actor: request.student || "Student",
      note: "",
      date: submissionDate,
    });
  }

  return request;
}

function loadData() {
  try {
    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    const parsedData = JSON.parse(rawData);

    parsedData.users = Array.isArray(parsedData.users)
      ? parsedData.users
      : DEFAULT_USERS.map((user) => ({ ...user }));
    parsedData.requests = Array.isArray(parsedData.requests)
      ? parsedData.requests.map(ensureRequestHistory)
      : [];
    parsedData.notifications = Array.isArray(parsedData.notifications)
      ? parsedData.notifications
      : [];

    return parsedData;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to read data file:", error.message);
    }

    return {
      users: DEFAULT_USERS.map((user) => ({ ...user })),
      requests: [],
      notifications: [],
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function findUserByUsername(data, username) {
  return data.users.find((user) => user.username === username);
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

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function addNotification(data, userId, message, href = "/") {
  data.notifications.push({
    id: getNextId(data.notifications),
    userId,
    message,
    href,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function getNotificationsForUser(data, userId) {
  return data.notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderPage(req, res, view, locals = {}) {
  const data = loadData();
  const notifications = req.session.user
    ? getNotificationsForUser(data, req.session.user.id)
    : [];

  res.render(view, {
    user: req.session.user || null,
    notifications,
    unreadNotificationCount: notifications.filter((notification) => !notification.read).length,
    ...locals,
  });
}

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  res.redirect("/login");
});

app.get("/login", (req, res) => {
  renderPage(req, res, "login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const data = loadData();
  const user = findUserByUsername(data, username);

  if (!user || user.password !== password) {
    return renderPage(req, res, "login", {
      error: "Invalid username or password.",
    });
  }

  if (user.status !== "active") {
    return renderPage(req, res, "login", {
      error: "This account is inactive.",
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  res.redirect("/dashboard");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  const data = loadData();
  const user = req.session.user;

  if (user.role === "student") {
    const requests = data.requests.filter((request) => request.studentId === user.id);
    return renderPage(req, res, "student-dashboard", { requests });
  }

  if (user.role === "staff") {
    const requests = data.requests.filter(
      (request) => request.assignedTo === user.id || !request.assignedTo
    );
    return renderPage(req, res, "staff-dashboard", { requests });
  }

  renderPage(req, res, "admin-dashboard", {
    requests: data.requests,
    users: data.users,
  });
});

app.get("/requests/new", requireRole("student"), (req, res) => {
  renderPage(req, res, "new-request", {
    categories: REQUEST_CATEGORIES,
    error: null,
  });
});

app.post("/requests", requireRole("student"), upload.single("attachment"), (req, res) => {
  const { title, category, description } = req.body;

  if (!title?.trim() || !description?.trim() || !REQUEST_CATEGORIES.includes(category)) {
    return renderPage(req, res, "new-request", {
      categories: REQUEST_CATEGORIES,
      error: "Please provide a title, description, and valid category.",
    });
  }

  const data = loadData();
  const requestId = getNextId(data.requests);
  const now = new Date().toISOString();
  const request = ensureRequestHistory({
    id: requestId,
    studentId: req.session.user.id,
    student: req.session.user.username,
    title: title.trim(),
    category,
    description: description.trim(),
    status: "Submitted",
    assignedTo: null,
    attachment: req.file
      ? {
          originalName: req.file.originalname,
          url: req.file.path,
          publicId: req.file.filename,
        }
      : null,
    createdAt: now,
    updatedAt: now,
    history: [],
  });

  data.requests.push(request);
  saveData(data);
  res.redirect(`/requests/${requestId}`);
});

app.get("/requests/:id", requireAuth, (req, res) => {
  const data = loadData();
  const request = data.requests.find((item) => String(item.id) === req.params.id);

  if (!request) {
    return res.status(404).send("Request not found");
  }

  if (
    req.session.user.role === "student" &&
    request.studentId !== req.session.user.id
  ) {
    return res.status(403).send("Forbidden");
  }

  renderPage(req, res, "request-details", { request });
});

app.post("/requests/:id/status", requireRole("staff", "admin"), (req, res) => {
  const data = loadData();
  const request = data.requests.find((item) => String(item.id) === req.params.id);
  const status = req.body.status;

  if (!request) {
    return res.status(404).send("Request not found");
  }

  if (!REQUEST_STATUSES.includes(status)) {
    return res.status(400).send("Invalid status");
  }

  const previousStatus = request.status;
  request.status = status;
  request.updatedAt = new Date().toISOString();
  request.history.push({
    id: `${request.id}-status-${Date.now()}`,
    type: "status",
    title: "Status Updated",
    description: `Status changed from ${previousStatus} to ${status}.`,
    status,
    actor: req.session.user.username,
    note: req.body.note?.trim() || "",
    date: request.updatedAt,
  });

  addNotification(
    data,
    request.studentId,
    `Request #${request.id} status changed to ${status}.`,
    `/requests/${request.id}`
  );

  saveData(data);
  res.redirect(`/requests/${request.id}`);
});

app.post("/requests/:id/assign", requireRole("admin"), (req, res) => {
  const data = loadData();
  const request = data.requests.find((item) => String(item.id) === req.params.id);
  const staffId = Number(req.body.staffId);
  const staff = data.users.find((user) => user.id === staffId && user.role === "staff");

  if (!request) {
    return res.status(404).send("Request not found");
  }

  if (!staff) {
    return res.status(400).send("Invalid staff member");
  }

  request.assignedTo = staff.id;
  request.updatedAt = new Date().toISOString();
  request.history.push({
    id: `${request.id}-assignment-${Date.now()}`,
    type: "assignment",
    title: "Request Assigned",
    description: `Request assigned to ${staff.username}.`,
    status: request.status,
    actor: req.session.user.username,
    note: "",
    date: request.updatedAt,
  });

  addNotification(
    data,
    staff.id,
    `Request #${request.id} was assigned to you.`,
    `/requests/${request.id}`
  );

  saveData(data);
  res.redirect(`/requests/${request.id}`);
});

app.post("/notifications/read-all", requireAuth, (req, res) => {
  const data = loadData();

  data.notifications.forEach((notification) => {
    if (notification.userId === req.session.user.id) {
      notification.read = true;
    }
  });

  saveData(data);
  res.redirect(req.get("referer") || "/dashboard");
});

app.post("/admin/users/:id/status", requireRole("admin"), (req, res) => {
  const data = loadData();
  const user = data.users.find((item) => String(item.id) === req.params.id);
  const status = req.body.status;

  if (!user) {
    return res.status(404).send("User not found");
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).send("Invalid status");
  }

  user.status = status;
  saveData(data);
  res.redirect("/dashboard");
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send("Attachment must be 10 MB or smaller.");
    }

    return res.status(400).send(error.message);
  }

  if (error) {
    return res.status(400).send(error.message);
  }

  next();
});

app.listen(PORT, () => {
  console.log(`Academia Service Hub running on http://localhost:${PORT}`);
});
