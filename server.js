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
  const data = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(data);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  const user = data.users.find(
    (existingUser) =>
      existingUser.username === username &&
      existingUser.password === password
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

  if (user.role === "student") {
    return res.redirect("/student");
  }

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
  res.sendFile(path.join(__dirname, "views", "staff.html"));
});

app.get("/admin", authMiddleware, roleMiddleware("admin"), (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
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
    res.sendFile(path.join(__dirname, "views", "submit-request.html"));
  }
);

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
    res.sendFile(path.join(__dirname, "views", "track-requests.html"));
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

    res.json(appointments);
  }
);

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});