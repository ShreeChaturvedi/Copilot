// Function to initialize or update checkboxes and event handling
function updateCalendarsAndCheckboxes() {
    // Clear existing checkboxes
    const calendarsList = document.getElementById('calendars-list');
    calendarsList.innerHTML = '';

    // Create checkboxes based on the map
    calendarStates.forEach((calendarState, calendarName) => {
        const color = lightenColor(calendarState.color);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = calendarName;
        checkbox.className = 'calendar-checkbox';
        checkbox.checked = calendarState.display;  // Use the 'display' property

        const customCheckbox = document.createElement('label');
        customCheckbox.htmlFor = calendarName;
        customCheckbox.className = 'custom-calendar-checkbox';
        customCheckbox.style.borderColor = color; // Set initial border color
        customCheckbox.style.backgroundColor = checkbox.checked ? color : lightenColor('#000000'); // Set initial background color

        const label = document.createElement('label');
        label.htmlFor = calendarName;
        label.className = 'calendar-label';
        label.textContent = calendarName;

        const deleteButton = document.createElement("button");
        deleteButton.innerHTML = '<span class="material-symbols-outlined">delete</span>';
        deleteButton.className = "calendar-delete-btn";

        const wrapper = document.createElement('div');
        wrapper.className = 'calendar-card';
        wrapper.appendChild(checkbox);
        wrapper.appendChild(customCheckbox);
        wrapper.appendChild(label);
        wrapper.appendChild(deleteButton);

        calendarsList.appendChild(wrapper);

        checkbox.addEventListener('change', (event) => {
            customCheckbox.style.backgroundColor = event.target.checked ? color : 'black';
        });

        deleteButton.addEventListener('click', () => {
            calendarStates.delete(calendarName);
            updateCalendarsAndCheckboxes();
        });

        // Update the 'display' property in the map and refresh events when checkbox state changes
        checkbox.addEventListener('change', (event) => {
            // Update the 'display' property for the corresponding calendar
            const updatedState = calendarStates.get(calendarName);
            updatedState.display = event.target.checked;
            calendarStates.set(calendarName, updatedState);

            calendar.refetchEvents(); // Assuming this is a method to refresh the calendar view
        });
    });
}

function lightenColor(hex, minLuminance = 0.3) {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Remap each color component from the range [0, 255] to [minLuminance * 255, 255]
    r = Math.round(minLuminance * 255 + (1 - minLuminance) * r);
    g = Math.round(minLuminance * 255 + (1 - minLuminance) * g);
    b = Math.round(minLuminance * 255 + (1 - minLuminance) * b);

    // Convert back to hex
    r = r.toString(16).padStart(2, '0');
    g = g.toString(16).padStart(2, '0');
    b = b.toString(16).padStart(2, '0');

    console.log("Converted", hex, "to", `#${r}${g}${b}`);

    return `#${r}${g}${b}`;
}

