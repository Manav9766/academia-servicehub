// Mock data for appointments
let appointments = [
  { id: 1, student: "Alice Smith", service: "Academic Advising", date: "2026-05-25", time: "10:00", status: "Scheduled" },
  { id: 2, student: "Bob Jones", service: "Financial Aid", date: "2026-05-26", time: "14:30", status: "In Progress" }
];

// Mock data for requests
let requests = [
  { id: 101, student: "Alice Smith", category: "Course Registration", subject: "Error adding math class", description: "Getting a prerequisite error even though I took it.", status: "Submitted", notes: "" },
  { id: 102, student: "Charlie Brown", category: "IT Support", subject: "Can't access portal", description: "Password reset is not working.", status: "In Progress", notes: "Emailed IT desk." }
];

function renderAppointments() {
  const container = document.getElementById("appointmentsList");
  container.innerHTML = "";
  
  if(appointments.length === 0) {
    container.innerHTML = "<p>No appointments found.</p>";
    return;
  }

  appointments.forEach(app => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-header">
        <h3>${app.service} - ${app.student}</h3>
        <span class="status-badge status-${app.status.replace(" ", "").toLowerCase()}">${app.status}</span>
      </div>
      <div class="item-body">
        <p><strong>Date:</strong> ${app.date}</p>
        <p><strong>Time:</strong> ${app.time}</p>
        <div class="status-updater">
          <label>Update Status:</label>
          <select onchange="updateAppointmentStatus(${app.id}, this.value)">
            <option value="Scheduled" ${app.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="In Progress" ${app.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${app.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderRequests() {
  const container = document.getElementById("requestsList");
  container.innerHTML = "";

  if(requests.length === 0) {
    container.innerHTML = "<p>No service requests found.</p>";
    return;
  }

  requests.forEach(req => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-header">
        <h3>[#${req.id}] ${req.subject} (${req.category})</h3>
        <span class="status-badge status-${req.status.replace(" ", "").toLowerCase()}">${req.status}</span>
      </div>
      <div class="item-body">
        <p><strong>Student:</strong> ${req.student}</p>
        <p><strong>Description:</strong> ${req.description}</p>
        
        <div class="status-updater">
          <label>Update Status:</label>
          <select onchange="updateRequestStatus(${req.id}, this.value)">
            <option value="Submitted" ${req.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
            <option value="In Progress" ${req.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${req.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>

        <div class="notes-section">
          <label>Staff Notes:</label>
          <textarea id="notes-${req.id}" rows="2" placeholder="Add notes...">${req.notes}</textarea>
          <button class="small-btn" onclick="saveNotes(${req.id})">Save Notes</button>
          <span id="note-msg-${req.id}" class="save-msg"></span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateAppointmentStatus(id, newStatus) {
  const app = appointments.find(a => a.id === id);
  if (app) {
    app.status = newStatus;
    renderAppointments();
  }
}

function updateRequestStatus(id, newStatus) {
  const req = requests.find(r => r.id === id);
  if (req) {
    req.status = newStatus;
    renderRequests();
  }
}

function saveNotes(id) {
  const req = requests.find(r => r.id === id);
  if (req) {
    const notesInput = document.getElementById(`notes-${id}`).value;
    req.notes = notesInput;
    
    const msg = document.getElementById(`note-msg-${id}`);
    msg.textContent = "Saved!";
    msg.style.color = "green";
    setTimeout(() => { msg.textContent = ""; }, 2000);
  }
}

// Initial render
document.addEventListener("DOMContentLoaded", () => {
  renderAppointments();
  renderRequests();
});
