# Academia Service Hub

A role-based student services portal built with Node.js and Express. The application supports student, staff, and admin workflows, including appointments, service requests, status tracking, and file attachments.

## Requirements

- Node.js 18+ recommended
- npm
- A Cloudinary account if you want attachment uploads to work

## Setup

1. Clone the repository and enter the project directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the provided environment template to `.env`:

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Replace `SESSION_SECRET` with a long, random value. If you want attachment uploads to work, also replace the placeholder Cloudinary credentials. The default `PORT=3000` can be changed if needed.

4. Start the application:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.

## Demo accounts

The application initializes these local demo users when no data file exists:

| Role | Username | Password |
| --- | --- | --- |
| Student | `student` | `123` |
| Staff | `staff` | `123` |
| Admin | `admin` | `123` |

These credentials are intended for local/demo use only.

## Data and uploads

Application data is stored in `data/db.json`. The server creates the data and upload directories when needed. Attachments are uploaded through Cloudinary, so valid Cloudinary credentials are required for that feature.

## Project structure

```text
.
├── data/           # Local JSON application data
├── public/         # Static assets
├── views/          # HTML views for role-based workflows
├── server.js       # Express application and routes
├── package.json    # Dependencies and npm scripts
└── .gitignore
```

## Deployment note

This repository is a course/demo application, not a production-ready authentication or persistence stack. It currently uses plaintext demo passwords, local JSON storage, and the default in-memory `express-session` store. Before deploying it for real users, replace those pieces with password hashing, persistent database-backed storage, a production session store, and environment-managed secrets.

## Development notes

- `npm start` runs `node server.js`.
- The default port is `3000` unless `PORT` is set.
- Keep `.env` and other credentials out of version control.
- `node_modules/` should not be committed; dependencies should be restored with `npm install` from `package-lock.json`.
