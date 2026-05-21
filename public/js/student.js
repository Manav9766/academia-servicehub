const appointmentForm = document.getElementById("appointmentForm");
const appointmentDisplay = document.getElementById("appointmentDisplay");
const message = document.getElementById("message");

appointmentForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const serviceType = document.getElementById("serviceType").value;
  const appointmentDate = document.getElementById("appointmentDate").value;
  const appointmentTime = document.getElementById("appointmentTime").value;
  const notes = document.getElementById("notes").value.trim();

  if (!serviceType || !appointmentDate || !appointmentTime) {
    message.textContent = "Please fill all required fields.";
    message.className = "message error";
    return;
  }

  appointmentDisplay.innerHTML = `
    <div class="booked-appointment">
      <p><strong>Service:</strong> ${serviceType}</p>
      <p><strong>Date:</strong> ${appointmentDate}</p>
      <p><strong>Time:</strong> ${appointmentTime}</p>
      <p><strong>Status:</strong> Scheduled</p>
      <p><strong>Notes:</strong> ${notes || "No notes provided"}</p>
    </div>
  `;

  message.textContent = "Appointment booked successfully.";
  message.className = "message success";

  appointmentForm.reset();
});