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
          appointments: [],
          requests: [],
        };

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
      appointments: [],
      requests: [],
    };
  }

  const data = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(data);

}


function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
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

  const user = users.find(

  const { username, password } = req.body;
  const data = readData();

  const user = data.users.find(

    (existingUser) =>
      existingUser.username === username &&
      existingUser.password === password
  );

  if (!user) {

    return res.status(401).send("Invalid Credentials");
  }

  req.session.user = {

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



app.get(
  "/student",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(path.join(__dirname, "views", "student.html"));
  }
);

  if (user.role === "staff") {
    return res.redirect("/staff");
  }

  if (user.role === "admin") {
    return res.redirect("/admin");
  }

  return res.redirect(
    "/?error=" + encodeURIComponent("Invalid user role.")
  );
});

/* ---------------- DASHBOARDS ---------------- */

app.get("/student", authMiddleware, roleMiddleware("student"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "student.html"));
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

app.get("/admin", authMiddleware, roleMiddleware("admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "views", "admin.html"));
});



/* ---------------- ADMIN USER MANAGEMENT ---------------- */

app.get(
  "/manage-users",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "views", "manage-users.html"));
  }
);

/*
  Returns all users to the admin page.
  Passwords are intentionally not returned.
*/
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

    res.json(safeUsers);
  }
);

/*
  Task #23:
  Admin creates a student, staff, or admin account.
*/
app.post(
  "/admin/users/create",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const username = req.body.username?.trim();
    const password = req.body.password?.trim();
    const role = req.body.role;

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

/*
  Task #24:
  Admin edits a user's username or role.
*/
app.post(
  "/admin/users/:id/edit",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    const data = readData();

    const userId = Number(req.params.id);
    const username = req.body.username?.trim();
    const role = req.body.role;

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

    /*
      If the admin edits their own account, update the current session too.
    */
    if (req.session.user.id === user.id) {
      req.session.user.username = user.username;
      req.session.user.role = user.role;
    }

    writeData(data);

    /*
      If the current admin changes their own role, they no longer have
      permission to stay in the admin section.
    */
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

/*
  Task #25:
  Admin disables or re-enables a user account.
*/
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

    /*
      Prevent an admin from disabling the account currently being used.
    */
    if (req.session.user.id === user.id) {
      return res.redirect(
        "/manage-users?error=" +
          encodeURIComponent("You cannot disable your own account.")
      );
    }

    user.status =
      user.status === "disabled" ? "active" : "disabled";

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

/* ---------------- STUDENT REQUESTS ---------------- */


app.get(
  "/submit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(
      path.join(__dirname, "views", "submit-request.html")
    );
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
      notes: "",
      createdAt: new Date().toISOString(),
    };

    data.requests.push(newRequest);
    writeData(data);

    return res.redirect("/track-requests");

app.post(
  "/submit-request",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
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

  }
);

app.get(
  "/track-requests",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    return res.sendFile(
      path.join(__dirname, "views", "track-requests.html")
    );
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


    return res.json(requests);
  }
);

app.get(
  "/staff-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    return res.sendFile(
      path.join(__dirname, "views", "staff-requests.html")
    );
  }
);

app.get(
  "/api/all-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();
    return res.json(data.requests);
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
    request.updatedAt = new Date().toISOString();

    writeData(data);

    return res.redirect("/staff-requests");
  }
);


app.post(
  "/book-appointment",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
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

    res.json(requests);
  }
);

/* ---------------- STAFF REQUESTS ---------------- */

app.get(
  "/staff-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    res.sendFile(path.join(__dirname, "views", "staff-requests.html"));
  }
);

app.get(
  "/api/all-requests",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();
    res.json(data.requests);
  }
);

app.post(
  "/update-status",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();

    const request = data.requests.find(
      (existingRequest) => existingRequest.id == req.body.id
    );

    if (request) {
      request.status = req.body.status;
    }

    writeData(data);
    res.redirect("/staff-requests");
  }
);

/* ---------------- APPOINTMENTS ---------------- */

app.post(
  "/book-appointment",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const appointment = {
      id: Date.now(),
      student: req.session.user.username,
      date: req.body.date,
      service: req.body.service,

    };

    data.appointments.push(appointment);
    writeData(data);


    return res.redirect("/student");

    res.send("Appointment Booked Successfully");

  }
);

app.get(
  "/api/appointments",
  authMiddleware,
  roleMiddleware("student"),
  (req, res) => {
    const data = readData();

    const appointments = data.appointments.filter(
      (appointment) =>
        appointment.student === req.session.user.username
    );


    return res.json(appointments);
  }
);



app.get(
  "/api/all-appointments",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();
    return res.json(data.appointments);
  }
);

app.post(
  "/update-appointment-status",
  authMiddleware,
  roleMiddleware("staff"),
  (req, res) => {
    const data = readData();

    const appointment = data.appointments.find(
      (existingAppointment) =>
        existingAppointment.id == req.body.id
    );

    if (appointment) {
      appointment.status = req.body.status;

      if (req.body.staffNotes !== undefined) {
        appointment.staffNotes = req.body.staffNotes;
      }
    }

    writeData(data);

    return res.redirect("/staff-appointments");
  }
);

    res.json(appointments);
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
