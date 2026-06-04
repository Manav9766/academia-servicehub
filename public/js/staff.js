// staff.js - Uses API endpoints for data

async function fetchAppointments() {
  try {
    const res = await fetch("/api/appointments");
    const appointments = await res.json();
    renderAppointments(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
  }
}

async function fetchRequests() {
  try {
    const res = await fetch("/api/all-requests");
    const requests = await res.json();
    renderRequests(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
  }
}

function renderAppointments(appointments) {
  const container = document.getElementById("appointmentsList");
  container.innerHTML = "";
  
  if(appointments.length === 0) {
    container.innerHTML = "<p>No appointments found.</p>";
    return;
  }

  appointments.forEach(app => {
    const card = document.createElement("div");
    card.className = "item-card";
    const safeStatus = (app.status || "").replace(" ", "").toLowerCase();
    card.innerHTML = `
      <div class="item-header">
        <h3>${app.service} - ${app.student}</h3>
        <span class="status-badge status-${safeStatus}">${app.status}</span>
      </div>
      <div class="item-body">
        <p><strong>Date:</strong> ${app.date}</p>
        <p><strong>Time:</strong> ${app.time}</p>
        <div class="status-updater">
          <label>Update Status:</label>
          <select id="app-status-${app.id}">
            <option value="Scheduled" ${app.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="In Progress" ${app.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${app.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          <button class="small-btn" onclick="updateAppointmentStatus(${app.id})">Update Status</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderRequests(requests) {
  const container = document.getElementById("requestsList");
  container.innerHTML = "";

  if(requests.length === 0) {
    container.innerHTML = "<p>No service requests found.</p>";
    return;
  }

  requests.forEach(req => {
    const card = document.createElement("div");
    card.className = "item-card";
    const safeStatus = (req.status || "").replace(" ", "").toLowerCase();
    card.innerHTML = `
      <div class="item-header">
        <h3>[#${req.requestId}] ${req.subject} (${req.category})</h3>
        <span class="status-badge status-${safeStatus}">${req.status}</span>
      </div>
      <div class="item-body">
        <p><strong>Student:</strong> ${req.student}</p>
        <p><strong>Description:</strong> ${req.description}</p>
        
        <div class="status-updater">
          <label>Update Status:</label>
          <select id="req-status-${req.requestId}">
            <option value="Submitted" ${req.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
            <option value="In Progress" ${req.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${req.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
          <button class="small-btn" onclick="updateRequestStatus('${req.requestId}')">Update Status</button>
        </div>

        <div class="notes-section">
          <label>Staff Notes:</label>
          <textarea id="notes-${req.requestId}" rows="2" placeholder="Add notes...">${req.notes || ""}</textarea>
          <button class="small-btn" onclick="saveNotes('${req.requestId}')">Save Notes</button>
          <span id="note-msg-${req.requestId}" class="save-msg"></span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function updateAppointmentStatus(id) {
  const status = document.getElementById(`app-status-${id}`).value;
  try {
    await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    fetchAppointments(); // Re-render
  } catch (error) {
    console.error("Error updating appointment:", error);
  }
}

async function updateRequestStatus(requestId) {
  const status = document.getElementById(`req-status-${requestId}`).value;
  try {
    await fetch(`/api/requests/${requestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    fetchRequests(); // Re-render
  } catch (error) {
    console.error("Error updating request:", error);
  }
}

async function saveNotes(requestId) {
  const notes = document.getElementById(`notes-${requestId}`).value;
  try {
    await fetch(`/api/requests/${requestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes })
    });
    
    const msg = document.getElementById(`note-msg-${requestId}`);
    msg.textContent = "Saved!";
    msg.style.color = "green";
    setTimeout(() => { msg.textContent = ""; }, 2000);
    
    // fetchRequests(); // Optional: Re-render if you want to sync other fields
  } catch (error) {
    console.error("Error saving notes:", error);
  }
}

// Initial render
document.addEventListener("DOMContentLoaded", () => {
  fetchAppointments();
  fetchRequests();
});
