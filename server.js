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
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    return {
      folder: "prj666-service-attachments",
      resource_type: "auto",
      public_id: `${Date.now()}-${Math.round(
        Math.random() * 1_000_000
      )}-${safeBaseName || "attachment"}`,
    };
  },
});

function attachmentFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  const validExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
  const validMimeType = ALLOWED_MIME_TYPES.has(file.mimetype);

  if (!validExtension || !validMimeType) {
    return callback(
      new Error(
        "Unsupported attachment type. Please upload a PDF, DOC, DOCX, PNG, JPG, or JPEG file."
      )
    );
  }

  callback(null, true);
}

const upload = multer({
  storage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

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

  if (
    request.status !== "Submitted" &&
    !request.history.some(
      (entry) =>
        entry.type === "status" &&
        normalizeRequestStatus(entry.status) === request.status
    )
  ) {
    request.history.push({
      id: `${request.id}-legacy-status-${request.status}`,
      type: "status",
      title: `Status: ${request.status}`,
      description: `Current request status is ${request.status}.`,
      status: request.status,
      actor: "System",
      note: request.notes || "",
      date: request.updatedAt || submissionDate,
    });
  }

  request.history.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return request;
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      users: DEFAULT_USERS,
      appointments: [],
      requests: [],
    };

    writeData(defaultData);
    return defaultData;
  }

  try {
    const fileContent = fs.readFileSync(DATA_FILE, "utf8");

    const parsedData = fileContent.trim()
      ? JSON.parse(fileContent)
      : {
          users: DEFAULT_USERS,
          appointments: [],
          requests: [],
        };

    if (!Array.isArray(parsedData.users)) {
      parsedData.users = DEFAULT_USERS;
    }

    if (!Array.isArray(parsedData.appointments)) {
      parsedData.appointments = [];
    }

    if (!Array.isArray(parsedData.requests)) {
      parsedData.requests = [];
    }

    parsedData.requests = parsedData.requests.map((request) =>
      ensureRequestHistory(request)
    );

    return parsedData;
  } catch (error) {
    console.error("Unable to read data file:", error);

    return {
      users: DEFAULT_USERS,
      appointments: [],
      requests: [],
    };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => Number(b.id) - Number(a.id));
}

function getTodayDateString() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - timezoneOffset).toISOString().slice(0, 10);
}

function removeUploadedFile(file) {
  if (!file || !file.path) {
    return;
  }

  if (file.filename) {
    cloudinary.uploader
      .destroy(file.filename, { resource_type: "image" })
      .catch(() => {
        return cloudinary.uploader.destroy(file.filename, {
          resource_type: "raw",
        });
      })
      .catch((error) => {
        console.error("Unable to remove uploaded Cloudinary file:", error);
      });

    return;
  }

  fs.unlink(file.path, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Unable to remove uploaded file:", error);
    }
  });
}

function removeStoredAttachment(attachment) {
  if (!attachment) {
    return;
  }

  if (attachment.storage === "cloudinary" && attachment.publicId) {
    cloudinary.uploader
      .destroy(attachment.publicId, { resource_type: "image" })
      .catch(() => {
        return cloudinary.uploader.destroy(attachment.publicId, {
          resource_type: "raw",
        });
      })
      .catch((error) => {
        console.error("Unable to remove Cloudinary attachment:", error);
      });

    return;
  }

  let storedPath = null;

  if (typeof attachment === "string") {
    storedPath = path.join(__dirname, "public", attachment);
  } else if (attachment.path && attachment.path.startsWith("/uploads/")) {
    storedPath = path.join(__dirname, "public", attachment.path);
  }

  if (!storedPath) {
    return;
  }

  fs.unlink(storedPath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Unable to remove old attachment:", error);
    }
  });
}

function buildAttachment(file) {
  if (!file) {
    return null;
  }

  return {
    path: file.path,
    originalName: file.originalname,
    storedName: file.filename,
    publicId: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    storage: "cloudinary",
  };
}

function addHistoryEntry(request, entry) {
  ensureRequestHistory(request);

  request.history.push({
    id: `${request.id}-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    type: entry.type,
    title: entry.title,
    description: entry.description || "",
    status: entry.status || request.status,
    actor: entry.actor || "System",
    note: entry.note || "",
    date: entry.date || new Date().toISOString(),
  });

  request.history.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function validateRequestFields(category, subject, issue) {
  if (!category || !subject || !issue) {
    return "Category, subject, and detailed description are required.";
  }

  if (!REQUEST_CATEGORIES.includes(category)) {
    return "Please select a valid service request category.";
  }

  if (subject.length < 3 || subject.length > 120) {
    return "The subject must contain between 3 and 120 characters.";
  }

  if (issue.length < 10 || issue.length > 3000) {
    return "The detailed description must contain between 10 and 3,000 characters.";
  }

  return null;
}

function sendRequestError(res, message, statusCode = 400) {
  return res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Request Error</title>
        <link rel="stylesheet" href="/css/style.css">
      </head>

      <body class="student-page">
        <header class="student-header">
          <div>
            <h1>Service Request Error</h1>
            <p>Your request could not be completed</p>
          </div>

          <a href="/logout" class="logout-btn">Logout</a>
        </header>

        <main class="student-container">
          <div class="student-card">
            <p class="error">${message}</p>

            <div
              class="student-actions"
              style="justify-content: flex-start; margin-top: 20px;"
            >
              <a href="/track-requests" class="action-btn">
                Track Requests
              </a>

              <a href="/student" class="action-btn secondary">
                Back to Dashboard
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  `);
}

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
      return res.status(403).send("Access Denied");
    }

    next();
  };
}

/* ---------------- LOGIN ---------------- */

app.get("/", (req, res) => {
  if (req.session.user) {
    return redirectByRole(req, res);
  }

  return res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const data = readData();

  const user = data.users.find(
    (existingUser) =>
      existingUser.username === username && existingUser.password === password
  );

  if (!user) {
    return res.redirect(
      "/?error=" + encodeURIComponent("Invalid username or password.")
    );
  }

  if (user.status === "disabled") {
    return res.redirect(
      "/?error=" +
        encodeURIComponent(
          "This account has been disabled. Please contact an administrator."
        )
    );
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  req.session.save((error) => {
    if (error) {
      console.error("Login session error:", error);
      return res.status(500).send("Login session error");
    }

    return redirectByRole(req, res);
  });
});

/* ---------------- DASHBOARDS ---------------- */

app.get("/student", authMiddleware, roleMiddleware("student"), (req, res) => {
  return res.sendFile(path.join(__dirname, "views", "student.html"));
});

app.get("/staff", authMiddleware, roleMiddleware("staff"), (req, res) => {
  return res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get(
  "/staff-appointments",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    return res.sendFile(
      path.join(__dirname, "views", "staff-appointments.html")
    );
  }
);

app.get(
  "/todays-appointments",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    return res.sendFile(
      path.join(__dirname, "views", "todays-appointments.html")
    );
  }
);

app.get("/admin", authMiddleware, roleMiddleware("admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "views", "admin.html"));
});

/* ---------------- ADMIN USER MANAGEMENT ---------------- */

app.get(
  "/manage-users",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "manage-users.html"));
  }
);

app.get("/api/users", authMiddleware, roleMiddleware("admin"), (req, res) => {
  const data = readData();

  const safeUsers = data.users.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status || "active",
  }));

  return res.json(safeUsers);
});

app.post(
  "/admin/users/create",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = String(req.body.role || "").trim();

    const allowedRoles = ["student", "staff", "admin"];

    if (!username || !password || !allowedRoles.includes(role)) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("Please enter valid user information.")
      );
    }

    const usernameExists = data.users.some(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameExists) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("That username already exists.")
      );
    }

    const newUser = {
      id: Date.now(),
      username,
      password,
      role,
      status: "active",
    };

    data.users.push(newUser);
    writeData(data);

    return res.redirect(
      "/manage-users?success=" +
        encodeURIComponent("User account created successfully.")
    );
  }
);

app.post(
  "/admin/users/:id/edit",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const userId = Number(req.params.id);
    const username = String(req.body.username || "").trim();
    const role = String(req.body.role || "").trim();

    const allowedRoles = ["student", "staff", "admin"];

    const user = data.users.find((existingUser) => existingUser.id === userId);

    if (!user) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("User account was not found.")
      );
    }

    if (!username || !allowedRoles.includes(role)) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("Please enter a valid username and role.")
      );
    }

    const usernameExists = data.users.some(
      (existingUser) =>
        existingUser.id !== userId &&
        existingUser.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameExists) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("That username is already being used.")
      );
    }

    user.username = username;
    user.role = role;

    if (req.session.user.id === user.id) {
      req.session.user.username = user.username;
      req.session.user.role = user.role;
    }

    writeData(data);

    if (req.session.user.role !== "admin") {
      if (req.session.user.role === "student") {
        return res.redirect("/student");
      }

      if (req.session.user.role === "staff") {
        return res.redirect("/staff");
      }
    }

    return res.redirect(
      "/manage-users?success=" +
        encodeURIComponent("User information updated successfully.")
    );
  }
);

app.post(
  "/admin/users/:id/toggle-status",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const userId = Number(req.params.id);

    const user = data.users.find((existingUser) => existingUser.id === userId);

    if (!user) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("User account was not found.")
      );
    }

    if (req.session.user.id === user.id) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("You cannot disable your own account.")
      );
    }

    user.status = user.status === "disabled" ? "active" : "disabled";

    writeData(data);

    const message =
      user.status === "disabled"
        ? "User account disabled successfully."
        : "User account enabled successfully.";

    return res.redirect(
      "/manage-users?success=" + encodeURIComponent(message)
    );
  }
);

app.get(
  "/api/admin/statistics",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    return res.json({
      totalStudents: data.users.filter((user) => user.role === "student")
        .length,
      totalStaff: data.users.filter((user) => user.role === "staff").length,
      totalAppointments: data.appointments.length,
      totalRequests: data.requests.length,
    });
  }
);

app.post(
  "/admin/users/:id/reset-password",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const userId = Number(req.params.id);
    const newPassword = String(req.body.password || "").trim();

    const user = data.users.find((existingUser) => existingUser.id === userId);

    if (!user) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("User account was not found.")
      );
    }

    if (newPassword.length < 3) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("Password must be at least 3 characters.")
      );
    }

    user.password = newPassword;

    writeData(data);

    return res.redirect(
      "/manage-users?success=" +
        encodeURIComponent("Password reset successfully.")
    );
  }
);

/* ---------------- STUDENT REQUESTS ---------------- */

app.get(
  "/submit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "submit-request.html"));
  }
);

app.post(
  "/submit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res, next) => {
    upload.single("attachment")(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") {
            return sendRequestError(
              res,
              "The attachment is too large. The maximum allowed file size is 5 MB."
            );
          }

          return sendRequestError(
            res,
            `Attachment upload failed: ${error.message}`
          );
        }

        return sendRequestError(res, error.message);
      }

      return next();
    });
  },
  (req, res) => {
    const category = String(req.body.category || "").trim();
    const subject = String(req.body.subject || "").trim();
    const issue = String(req.body.issue || "").trim();

    const validationError = validateRequestFields(category, subject, issue);

    if (validationError) {
      removeUploadedFile(req.file);
      return sendRequestError(res, validationError);
    }

    const data = readData();
    const now = new Date().toISOString();
    const requestId = Date.now();

    const newRequest = {
      id: requestId,
      student: req.session.user.username,
      category,
      subject,
      issue,
      attachment: buildAttachment(req.file),
      status: "Submitted",
      assignedTo: "Unassigned",
      notes: "",
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: `${requestId}-submission`,
          type: "submission",
          title: "Request Submitted",
          description: "Service request was submitted by the student.",
          status: "Submitted",
          actor: req.session.user.username,
          note: "",
          date: now,
        },
      ],
    };

    data.requests.push(newRequest);
    writeData(data);

    return res.redirect("/track-requests");
  }
);

app.get(
  "/track-requests",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "track-requests.html"));
  }
);

app.get(
  "/api/student-requests",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const requests = data.requests.filter(
      (request) => request.student === req.session.user.username
    );

    return res.json(sortNewestFirst(requests));
  }
);

app.get(
  "/request-history",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "request-history.html"));
  }
);

app.get(
  "/api/request-history/:id",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const request = data.requests.find(
      (existingRequest) =>
        String(existingRequest.id) === String(req.params.id) &&
        existingRequest.student === req.session.user.username
    );

    if (!request) {
      return res.status(404).json({
        error: "Service request not found.",
      });
    }

    ensureRequestHistory(request);

    return res.json({
      id: request.id,
      student: request.student,
      subject: request.subject,
      category: request.category,
      issue: request.issue,
      attachment: request.attachment || null,
      status: request.status,
      assignedTo: request.assignedTo || "Unassigned",
      notes: request.notes || "",
      createdAt: request.createdAt,
      updatedAt: request.updatedAt || request.createdAt,
      closedAt: request.closedAt || null,
      history: [...request.history].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    });
  }
);

app.get(
  "/api/student-request/:id",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const request = data.requests.find(
      (existingRequest) =>
        String(existingRequest.id) === String(req.params.id) &&
        existingRequest.student === req.session.user.username
    );

    if (!request) {
      return res.status(404).json({
        error: "Service request not found.",
      });
    }

    return res.json(request);
  }
);

app.get(
  "/edit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "edit-request.html"));
  }
);

app.post(
  "/edit-service-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res, next) => {
    upload.single("attachment")(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") {
            return sendRequestError(
              res,
              "The attachment is too large. The maximum allowed file size is 5 MB."
            );
          }

          return sendRequestError(
            res,
            `Attachment upload failed: ${error.message}`
          );
        }

        return sendRequestError(res, error.message);
      }

      return next();
    });
  },
  (req, res) => {
    const requestId = String(req.body.id || "").trim();
    const category = String(req.body.category || "").trim();
    const subject = String(req.body.subject || "").trim();
    const issue = String(req.body.issue || "").trim();

    if (!requestId) {
      removeUploadedFile(req.file);
      return sendRequestError(res, "Request ID is required.");
    }

    const validationError = validateRequestFields(category, subject, issue);

    if (validationError) {
      removeUploadedFile(req.file);
      return sendRequestError(res, validationError);
    }

    const data = readData();

    const request = data.requests.find(
      (existingRequest) =>
        String(existingRequest.id) === requestId &&
        existingRequest.student === req.session.user.username
    );

    if (!request) {
      removeUploadedFile(req.file);

      return sendRequestError(res, "Service request was not found.", 404);
    }

    request.status = normalizeRequestStatus(request.status);

    if (request.status !== "Submitted") {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "This request can no longer be edited because processing has already started."
      );
    }

    const previousCategory = request.category;
    const previousSubject = request.subject;
    const previousIssue = request.issue;

    request.category = category;
    request.subject = subject;
    request.issue = issue;

    if (req.file) {
      removeStoredAttachment(request.attachment);
      request.attachment = buildAttachment(req.file);
    }

    request.updatedAt = new Date().toISOString();

    const changedFields = [];

    if (previousCategory !== category) {
      changedFields.push("category");
    }

    if (previousSubject !== subject) {
      changedFields.push("subject");
    }

    if (previousIssue !== issue) {
      changedFields.push("description");
    }

    if (req.file) {
      changedFields.push("attachment");
    }

    addHistoryEntry(request, {
      type: "student-edit",
      title: "Request Updated",
      description:
        changedFields.length > 0
          ? `Student updated: ${changedFields.join(", ")}.`
          : "Student saved the request without changing request details.",
      status: request.status,
      actor: req.session.user.username,
    });

    writeData(data);

    return res.redirect(
      `/request-history?id=${encodeURIComponent(request.id)}`
    );
  }
);

app.post(
  "/close-service-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const requestId = String(req.body.id || "").trim();

    if (!requestId) {
      return sendRequestError(res, "Request ID is required.");
    }

    const data = readData();

    const request = data.requests.find(
      (existingRequest) =>
        String(existingRequest.id) === requestId &&
        existingRequest.student === req.session.user.username
    );

    if (!request) {
      return sendRequestError(res, "Service request was not found.", 404);
    }

    request.status = normalizeRequestStatus(request.status);

    if (request.status !== "Completed") {
      return sendRequestError(
        res,
        "Only completed service requests can be closed."
      );
    }

    const now = new Date().toISOString();

    request.status = "Closed";
    request.closedAt = now;
    request.updatedAt = now;

    addHistoryEntry(request, {
      type: "closure",
      title: "Request Closed",
      description: "Student confirmed that the completed request can be closed.",
      status: "Closed",
      actor: req.session.user.username,
      date: now,
    });

    writeData(data);

    return res.redirect(
      `/request-history?id=${encodeURIComponent(request.id)}`
    );
  }
);

app.post(
  "/cancel-service-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const requestId = String(req.body.id || "").trim();

    if (!requestId) {
      return res.status(400).send("Request ID is required.");
    }

    const data = readData();

    const request = data.requests.find(
      (existingRequest) =>
        String(existingRequest.id) === requestId &&
        existingRequest.student === req.session.user.username
    );

    if (!request) {
      return res.status(404).send("Service request not found.");
    }

    request.status = normalizeRequestStatus(request.status);

    if (request.status !== "Submitted") {
      return res.status(400).send("Only submitted requests can be cancelled.");
    }

    const now = new Date().toISOString();

    request.status = "Cancelled";
    request.updatedAt = now;

    addHistoryEntry(request, {
      type: "cancellation",
      title: "Request Cancelled",
      description: "Student cancelled the service request.",
      status: "Cancelled",
      actor: req.session.user.username,
      date: now,
    });

    writeData(data);

    return res.redirect("/track-requests");
  }
);

/* ---------------- STAFF REQUESTS ---------------- */

app.get(
  "/staff-report",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "staff-report.html"));
  }
);

app.get(
  "/staff-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "staff-requests.html"));
  }
);

app.get(
  "/api/all-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();

    return res.json(sortNewestFirst(data.requests));
  }
);

app.post(
  "/update-status",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const requestId = String(req.body.id || "").trim();

    let newStatus = String(req.body.status || "").trim();

    newStatus = normalizeRequestStatus(newStatus);

    const newNotes = String(req.body.notes || "").trim();

    if (!requestId || !REQUEST_STATUSES.includes(newStatus)) {
      return res.status(400).send("Invalid request status update.");
    }

    const data = readData();

    const request = data.requests.find(
      (existingRequest) => String(existingRequest.id) === requestId
    );

    if (!request) {
      return res.status(404).send("Service request not found.");
    }

    request.status = normalizeRequestStatus(request.status);

    if (request.status === "Closed") {
      return res.status(400).send("Closed requests cannot be modified.");
    }

    const previousStatus = request.status;
    const previousNotes = request.notes || "";

    if (req.body.assignedTo !== undefined) {
      request.assignedTo =
        String(req.body.assignedTo || "").trim() || "Unassigned";
    }

    const now = new Date().toISOString();

    if (previousStatus !== newStatus) {
      request.status = newStatus;

      addHistoryEntry(request, {
        type: "status",
        title: "Status Updated",
        description: `Request status changed from ${previousStatus} to ${newStatus}.`,
        status: newStatus,
        actor: req.session.user.username,
        date: now,
      });
    }

    if (newNotes && newNotes !== previousNotes) {
      request.notes = newNotes;

      addHistoryEntry(request, {
        type: "staff-note",
        title: "Staff Note Added",
        description: "A staff member added or updated a note.",
        status: request.status,
        actor: req.session.user.username,
        note: newNotes,
        date: now,
      });
    } else {
      request.notes = newNotes;
    }

    request.updatedAt = now;

    writeData(data);

    return res.redirect("/staff-requests");
  }
);

/* ---------------- APPOINTMENTS ---------------- */

app.post(
  "/book-appointment",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const service = String(req.body.service || "").trim();
    const date = String(req.body.date || "").trim();
    const time = String(req.body.time || "").trim();
    const notes = String(req.body.notes || "").trim();

    if (!service || !date || !time) {
      return res.status(400).send("Service, date, and time are required.");
    }

    const data = readData();

    const appointment = {
      id: Date.now(),
      student: req.session.user.username,
      service,
      date,
      time,
      notes,
      staffNotes: "",
      status: "Scheduled",
      createdAt: new Date().toISOString(),
    };

    data.appointments.push(appointment);
    writeData(data);

    return res.redirect(`/student?appointmentConfirmed=${appointment.id}`);
  }
);

app.get(
  "/api/appointments",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const appointments = data.appointments.filter(
      (appointment) => appointment.student === req.session.user.username
    );

    return res.json(sortNewestFirst(appointments));
  }
);

app.post(
  "/cancel-appointment",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const appointmentId = String(req.body.id || "").trim();

    if (!appointmentId) {
      return res.status(400).send("Appointment ID is required.");
    }

    const data = readData();

    const appointment = data.appointments.find(
      (existingAppointment) =>
        String(existingAppointment.id) === appointmentId &&
        existingAppointment.student === req.session.user.username
    );

    if (!appointment) {
      return res.status(404).send("Appointment not found.");
    }

    if (appointment.status === "Completed") {
      return res
        .status(400)
        .send("Completed appointments cannot be cancelled.");
    }

    appointment.status = "Cancelled";
    appointment.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/student");
  }
);

app.post(
  "/reschedule-appointment",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const appointmentId = String(req.body.id || "").trim();
    const newDate = String(req.body.date || "").trim();
    const newTime = String(req.body.time || "").trim();

    if (!appointmentId || !newDate || !newTime) {
      return res
        .status(400)
        .send("Appointment ID, date, and time are required.");
    }

    const data = readData();

    const appointment = data.appointments.find(
      (existingAppointment) =>
        String(existingAppointment.id) === appointmentId &&
        existingAppointment.student === req.session.user.username
    );

    if (!appointment) {
      return res.status(404).send("Appointment not found.");
    }

    if (
      appointment.status === "Cancelled" ||
      appointment.status === "Completed"
    ) {
      return res
        .status(400)
        .send("Cancelled or completed appointments cannot be rescheduled.");
    }

    appointment.date = newDate;
    appointment.time = newTime;
    appointment.status = "Rescheduled";
    appointment.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/student");
  }
);

app.get(
  "/api/all-appointments",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();

    return res.json(sortNewestFirst(data.appointments));
  }
);

app.get(
  "/api/todays-appointments",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();
    const today = getTodayDateString();

    const todaysAppointments = data.appointments.filter(
      (appointment) => appointment.date === today
    );

    return res.json(sortNewestFirst(todaysAppointments));
  }
);

app.post(
  "/update-appointment-status",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const allowedStatuses = [
      "Scheduled",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rescheduled",
    ];

    const appointmentId = String(req.body.id || "").trim();
    const status = String(req.body.status || "").trim();
    const staffNotes = String(req.body.staffNotes || "").trim();

    if (!appointmentId || !allowedStatuses.includes(status)) {
      return res.status(400).send("Invalid appointment status update.");
    }

    const data = readData();

    const appointment = data.appointments.find(
      (existingAppointment) => String(existingAppointment.id) === appointmentId
    );

    if (!appointment) {
      return res.status(404).send("Appointment not found.");
    }

    appointment.status = status;
    appointment.staffNotes = staffNotes;
    appointment.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/staff-appointments");
  }
);

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
    }

    res.clearCookie("connect.sid");

    return res.redirect("/");
  });
});

app.use((error, req, res, next) => {
  console.error("Unexpected server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).send("An unexpected server error occurred.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});