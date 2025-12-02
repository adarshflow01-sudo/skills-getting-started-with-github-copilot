document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupButton = signupForm.querySelector('button[type="submit"]');

  // Helper: build initials from email (before the @)
  function getInitials(email) {
    const local = email.split("@")[0];
    // split on common delimiters to handle names like first.last or first_last
    const parts = local.split(/[\.\-_]/).filter(Boolean);
    if (parts.length === 0) return local.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      // don't use cached responses so the UI always reflects the server state
      const response = await fetch("/activities", { cache: "no-store" });
      const activities = await response.json();

      // Clear loading message and reset options
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants section using DOM nodes (more reliable than innerHTML)
        const participantsSection = document.createElement("div");
        participantsSection.className = "participants-section";
        const participantsHeading = document.createElement("h5");
        participantsHeading.textContent = "Participants";
        participantsSection.appendChild(participantsHeading);

        if (details.participants && details.participants.length > 0) {
          const list = document.createElement("ul");
          list.className = "participants-list";
          details.participants.forEach((email) => {
            const li = document.createElement("li");
            li.className = "participant-row";

            const avatar = document.createElement("span");
            avatar.className = "participant-avatar";
            avatar.textContent = getInitials(email);

            const emailSpan = document.createElement("span");
            emailSpan.className = "participant-email";
            emailSpan.textContent = email;
            // delete button for unregistering
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "participant-delete";
            deleteBtn.title = "Unregister participant";
            deleteBtn.setAttribute("aria-label", "Unregister participant");
            deleteBtn.textContent = "✕";
            // store identifying info on the button so handlers can pick it up
            deleteBtn.dataset.activity = name;
            deleteBtn.dataset.email = email;

            li.appendChild(avatar);
            li.appendChild(emailSpan);
            li.appendChild(deleteBtn);
            list.appendChild(li);
          });
          participantsSection.appendChild(list);
        } else {
          const empty = document.createElement("div");
          empty.className = "participants-empty";
          empty.textContent = "No participants yet";
          participantsSection.appendChild(empty);
        }

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        `;
        activityCard.appendChild(participantsSection);

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Return activities so callers can await and inspect
      return activities;
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
      throw error;
    }
  }

  // Small helper that tries to add the new participant to the matching card in the DOM
  function appendParticipantToCard(activityName, email) {
    const cards = Array.from(activitiesList.querySelectorAll(".activity-card"));
    const card = cards.find(c => {
      const h4 = c.querySelector("h4");
      return h4 && h4.textContent.trim() === activityName;
    });
    if (!card) return;

    let section = card.querySelector(".participants-section");
    if (!section) {
      section = document.createElement("div");
      section.className = "participants-section";
      section.innerHTML = `<h5>Participants</h5><div class="participants-empty">No participants yet</div>`;
      card.appendChild(section);
    }

    const emptyEl = section.querySelector(".participants-empty");
    if (emptyEl) emptyEl.remove();

    let list = section.querySelector(".participants-list");
    if (!list) {
      list = document.createElement("ul");
      list.className = "participants-list";
      section.appendChild(list);
    }

    const li = document.createElement("li");
    li.className = "participant-row";
    const avatar = document.createElement("span");
    avatar.className = "participant-avatar";
    avatar.textContent = getInitials(email);
    const emailSpan = document.createElement("span");
    emailSpan.className = "participant-email";
    emailSpan.textContent = email;
    // add delete button when we dynamically append a new participant
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "participant-delete";
    deleteBtn.title = "Unregister participant";
    deleteBtn.setAttribute("aria-label", "Unregister participant");
    deleteBtn.textContent = "✕";
    deleteBtn.dataset.activity = activityName;
    deleteBtn.dataset.email = email;

    li.appendChild(avatar);
    li.appendChild(emailSpan);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!activity) {
      messageDiv.textContent = "Please select an activity.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 3000);
      return;
    }

    try {
      // disable submit UI while request is in-flight
      signupButton.disabled = true;
      signupButton.textContent = "Signing up...";

      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      console.log("Signup response", response.status, result);

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        signupForm.reset();

        // Refresh from the server so what we render comes directly from the authoritative source
        // (avoid relying on a local DOM append which can become inconsistent)
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    } finally {
      // re-enable submit UI
      signupButton.disabled = false;
      signupButton.textContent = "Sign Up";
    }
  });

  // Initialize app
  // Event delegation for participant delete events
  activitiesList.addEventListener("click", async (event) => {
    const button = event.target.closest(".participant-delete");
    if (!button) return;

    const activity = button.dataset.activity;
    const email = button.dataset.email;
    if (!activity || !email) return;

    // quick UI feedback
    button.disabled = true;
    const previousText = button.textContent;
    button.textContent = "...";

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (response.ok) {
        // remove the row from DOM and show a message
        const row = button.closest("li");
        if (row) row.remove();
        messageDiv.textContent = result.message || `Unregistered ${email} from ${activity}`;
        messageDiv.className = "message success";
        messageDiv.classList.remove("hidden");

        // refresh activities from server for consistency
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Failed to unregister";
        messageDiv.className = "message error";
        messageDiv.classList.remove("hidden");
      }
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    } finally {
      button.disabled = false;
      button.textContent = previousText;
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    }
  });

  fetchActivities();
});
