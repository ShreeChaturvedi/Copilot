document.addEventListener("DOMContentLoaded", () => {
  const darkModeToggle = document.getElementById("dark-mode");
  const settingsBtn = document.getElementById("settings-btn");
  const addButton = document.getElementById("add-task-btn");
  const inputField = document.getElementById("new-task-input");
  const tasksList = document.getElementById("todo-list");
  const toggleCompletedTasksDiv = document.createElement("div");
  const toggleCompletedTasksPlaceholder = document.getElementById("toggle-completed-tasks-placeholder");
  toggleCompletedTasksDiv.className = "toggle-completed-tasks";
  toggleCompletedTasksDiv.textContent = "Show completed tasks";
  toggleCompletedTasksDiv.style.display = "none"; // Initially hidden
  toggleCompletedTasksPlaceholder.appendChild(toggleCompletedTasksDiv);

  let completedTasks = [];
  let showCompleted = false;

  addButton.addEventListener("click", addTask);
  inputField.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      addTask();
    }
  });

  function createTaskElement(taskContent, newEvent) {
    const taskCard = document.createElement("div");
    taskCard.className = "task-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.id = `checkbox-${taskContent.replace(/\s+/g, "-")}`; // Ensure ID is valid by replacing spaces with hyphens

    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = checkbox.id;
    checkboxLabel.className = "custom-checkbox";

    const label = document.createElement("input");
    label.value = taskContent;
    label.className = "task-label";

    label.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        this.blur();
        newEvent.setProp("title", this.value);
      }
    });

    label.addEventListener("blur", function () {
      newEvent.setProp("title", this.value);
    });

    const underline = document.createElement("span");
    underline.className = "task-label-underline";

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "task-label-wrapper";
    labelWrapper.appendChild(label);
    labelWrapper.appendChild(underline);

    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    deleteButton.className = "task-delete-btn";

    taskCard.appendChild(checkbox);
    taskCard.appendChild(checkboxLabel); // Append the custom checkbox label
    taskCard.appendChild(labelWrapper);
    taskCard.appendChild(deleteButton);

    checkbox.addEventListener("change", markTaskAsDone);

    deleteButton.addEventListener("click", deleteTask);

    return taskCard;
  }

  function addTask() {
    // Trim the input value to remove whitespace and capitalize the first letter
    const taskContent = inputField.value.trim().replace(/^\w/, (c) => c.toUpperCase());
    var newEvent = addCalendarEvent(taskContent);
    if (taskContent) {
      const taskCard = createTaskElement(taskContent, newEvent);
      tasksList.appendChild(taskCard);
      inputField.value = ""; // Clear the input field after adding the task
      updateToggleCompletedTasksVisibility();

      // update the p inside the ul
      const p = document.querySelector("ul p");
      p.style.display = "none";
      return newEvent;
    }
  }

  function markTaskAsDone(event) {
    const taskCard = event.target.parentElement;
    const label = taskCard.querySelector(".task-label");

    // Transition effect
    taskCard.style.transition = "opacity 0.5s";
    taskCard.style.opacity = "0";

    setTimeout(() => {
      taskCard.style.opacity = "1";

      if (event.target.checked) {
        // Move the completed task to the end of the list after the transition
        taskCard.classList.add("completed");
        label.classList.add("task-completed");
        label.textContent = label.textContent.trim();
        label.innerHTML = "&nbsp;" + label.textContent.trim() + "&nbsp;";
        tasksList.appendChild(taskCard); // This moves the task card to the bottom of the list
        completedTasks.push(label.textContent); // Add to the completed tasks list
      } else {
        taskCard.classList.remove("completed");
        label.classList.remove("task-completed");
        completedTasks = completedTasks.filter((task) => task !== label.textContent); // Remove from the completed tasks list
      }

      updateToggleCompletedTasksVisibility();
    }, 500);
    removeCalendarEvent(taskCard.querySelector(".task-label").value);
  }

  function deleteTask(event) {
    const taskCard = event.target.closest(".task-card");
    const isCompleted = taskCard.classList.contains("completed");
    taskCard.style.transition = "opacity 0.5s";
    taskCard.style.opacity = "0";
    setTimeout(() => {
      taskCard.remove();
      if (isCompleted) {
        // Remove from the completed tasks array if it was completed
        completedTasks = completedTasks.filter((task) => task !== taskCard.querySelector(".task-label").textContent);
      }

      // check if no elements are left, if so, display the p inside the ul
      const p = document.querySelector("ul p");
      if (tasksList.childElementCount === 1) {
        p.style.display = "block";
      }
      updateToggleCompletedTasksVisibility();
    }, 500);
    removeCalendarEvent(taskCard.querySelector(".task-label").value);
  }

  function updateCompletedTasksDisplay() {
    const completedTaskCards = tasksList.querySelectorAll(".completed");
    if (showCompleted) {
      completedTaskCards.forEach((card) => {
        card.style.display = "flex";
        // Move the completed task to the end of the list to maintain order
        tasksList.appendChild(card);
      });
      toggleCompletedTasksDiv.textContent = `Hide ${completedTasks.length} completed task${completedTasks.length !== 1 ? "s" : ""
        }`;
    } else {
      completedTaskCards.forEach((card) => {
        card.style.display = "none";
      });
      toggleCompletedTasksDiv.textContent = `Show ${completedTasks.length} completed task${completedTasks.length !== 1 ? "s" : ""
        }`;
    }
  }

  toggleCompletedTasksDiv.addEventListener("click", () => {
    showCompleted = !showCompleted;
    updateCompletedTasksDisplay();
    if (showCompleted) {
      toggleCompletedTasksDiv.textContent = `Hide completed tasks`;
    } else {
      toggleCompletedTasksDiv.textContent = `Show ${completedTasks.length} completed task${completedTasks.length !== 1 ? "s" : ""
        }`;
    }
  });

  darkModeToggle.addEventListener("change", function () {
    if (darkModeToggle.checked) {
      // If toggle is on, use the dark color scheme
      const properties = [
        ["--background", "#fff"],
        ["--foreground", "#000"],
        ["--fsub", "#222"],
        ["--bsub", "#ddd"],
      ];
      properties.forEach((property) => {
        document.documentElement.style.setProperty(property[0], property[1]);
      });
      document.getElementById("logo").src = "./logo.png";
    } else {
      // If toggle is off, use a light color scheme
      const properties = [
        ["--background", "#000"],
        ["--foreground", "#fff"],
        ["--fsub", "#ddd"],
        ["--bsub", "#222"],
      ];
      properties.forEach((property) => {
        document.documentElement.style.setProperty(property[0], property[1]);
      });
      document.getElementById("logo").src = "./logo-light.png";
    }
  });

  // Add event listener to settings and toggle the settings menu
  settingsBtn.addEventListener("click", () => {
    const settingsMenu = document.querySelector(".settings-container");
    settingsMenu.classList.toggle("hidden");
  });

  document.getElementById("collapse-calendars-btn").addEventListener("click", () => {
    const calendarsList = document.getElementById("calendars-list");
    calendarsList.classList.toggle("collapsed");
    document.getElementById("collapse-calendars-btn").classList.toggle("collapsed");
  });

  document.getElementById("add-calendar-btn").addEventListener("click", () => {
    // get input using basic console prompt
    const calendarName = prompt("Enter the name of the calendar");
    if (calendarName) {
      // If the user entered a name, add the calendar
      calendarStates.set(calendarName, {display: true, color: "black"});
      updateCalendarsAndCheckboxes();
    }
  });

  // Call this function whenever a task is marked as completed or deleted
  function updateToggleCompletedTasksVisibility() {
    toggleCompletedTasksDiv.style.display = completedTasks.length ? "block" : "none";
    updateCompletedTasksDisplay();
  }

  updateToggleCompletedTasksVisibility();
});
