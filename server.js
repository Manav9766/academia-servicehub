const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data", "db.json");
const UPLOAD_DIRECTORY = path.join(__dirname, "public", "uploads");

const REQUEST_CATEGORIES = [
  "Academic Advising",
  "Registration & Enrollment",
  "Financial Aid",
  "IT Support",
  "Career Services",
  "Mental Health",
  "General",
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

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIRECTORY);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1_000_000
    )}-${safeBaseName || "attachment"}${extension}`;

    callback(null, uniqueName);
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

function removeUploadedFile(file) {
  if (!file || !file.path) {
    return;
  }

  fs.unlink(file.path, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Unable to remove uploaded file:", error);
    }
  });
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
            <p>Your request could not be submitted</p>
          </div>

          <a href="/logout" class="logout-btn">Logout</a>
        </header>

        <main class="student-container">
          <div class="student-card">
            <p class="error">${message}</p>

            <div class="student-actions" style="justify-content: flex-start; margin-top: 20px;">
              <a href="/submit-request" class="action-btn">
                Return to Request Form
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
    return res.sendFile(path.join(__dirname, "views", "staff-appointments.html"));
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

app.get(
  "/api/users",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const safeUsers = data.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status || "active",
    }));

    return res.json(safeUsers);
  }
);

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

    const statistics = {
      totalStudents: data.users.filter(
        (user) => user.role === "student"
      ).length,

      totalStaff: data.users.filter(
        (user) => user.role === "staff"
      ).length,

      totalAppointments: data.appointments.length,

      totalRequests: data.requests.length,
    };

    return res.json(statistics);
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

    const user = data.users.find(
      (existingUser) => existingUser.id === userId
    );

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

          if (error.code === "LIMIT_FILE_COUNT") {
            return sendRequestError(
              res,
              "Only one attachment may be uploaded with each request."
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

    if (!category || !subject || !issue) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "Category, subject, and detailed description are required."
      );
    }

    if (!REQUEST_CATEGORIES.includes(category)) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "Please select a valid service request category."
      );
    }

    if (subject.length < 3) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "The subject must contain at least 3 characters."
      );
    }

    if (subject.length > 120) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "The subject cannot contain more than 120 characters."
      );
    }

    if (issue.length < 10) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "The detailed description must contain at least 10 characters."
      );
    }

    if (issue.length > 3000) {
      removeUploadedFile(req.file);

      return sendRequestError(
        res,
        "The detailed description cannot contain more than 3,000 characters."
      );
    }

    const data = readData();

    const attachment = req.file
      ? {
          path: `/uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        }
      : null;

    const newRequest = {
      id: Date.now(),
      student: req.session.user.username,
      category,
      subject,
      issue,
      attachment,
      status: "Pending",
      assignedTo: "Unassigned",
      notes: "",
      createdAt: new Date().toISOString(),
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

    if (request.status === "Resolved") {
      return res.status(400).send("Resolved requests cannot be cancelled.");
    }

    request.status = "Cancelled";
    request.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/track-requests");
  }
);

app.post(
  "/edit-service-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const requestId = String(req.body.id || "").trim();
    const category = String(req.body.category || "").trim();
    const subject = String(req.body.subject || "").trim();
    const issue = String(req.body.issue || "").trim();

    if (!requestId || !category || !subject || !issue) {
      return res
        .status(400)
        .send("Request ID, category, subject, and description are required.");
    }

    if (!REQUEST_CATEGORIES.includes(category)) {
      return res.status(400).send("Invalid service request category.");
    }

    if (subject.length < 3 || subject.length > 120) {
      return res
        .status(400)
        .send("Subject must be between 3 and 120 characters.");
    }

    if (issue.length < 10 || issue.length > 3000) {
      return res
        .status(400)
        .send("Description must be between 10 and 3000 characters.");
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

    if (request.status === "Cancelled" || request.status === "Resolved") {
      return res
        .status(400)
        .send("Cancelled or resolved requests cannot be edited.");
    }

    request.category = category;
    request.subject = subject;
    request.issue = issue;
    request.status = "Pending";
    request.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/track-requests");
  }
);

/* ---------------- STAFF REQUESTS ---------------- */

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
    const allowedStatuses = [
      "Pending",
      "In Progress",
      "Resolved",
      "Cancelled",
    ];

    const requestId = String(req.body.id || "").trim();
    const status = String(req.body.status || "").trim();
    const notes = String(req.body.notes || "").trim();

    if (!requestId || !allowedStatuses.includes(status)) {
      return res.status(400).send("Invalid request status update.");
    }

    const data = readData();

    const request = data.requests.find(
      (existingRequest) => String(existingRequest.id) === requestId
    );

    if (!request) {
      return res.status(404).send("Service request not found.");
    }

    request.status = status;
    request.notes = notes;
    
    if (req.body.assignedTo !== undefined) {
      request.assignedTo = req.body.assignedTo;
    }
    
    request.updatedAt = new Date().toISOString();

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

    return res.redirect("/student");
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
      return res.status(400).send("Completed appointments cannot be cancelled.");
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
      return res.status(400).send("Appointment ID, date, and time are required.");
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

    if (appointment.status === "Cancelled" || appointment.status === "Completed") {
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