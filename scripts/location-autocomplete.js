document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("event-location");
    const container = document.getElementById("autocomplete-container");

    function fetchSuggestions(text) {
        var requestOptions = {
            method: "GET",
        };

        fetch(
            `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
                text
            )}&apiKey=611dd4eaf85c47d19834c3fce2af678c`,
            requestOptions
        )
            .then((response) => response.json())
            .then((result) => showSuggestions(result.features))
            .catch((error) => console.log("error", error));
    }

    function showSuggestions(suggestions) {
        container.innerHTML = ""; // clear previous suggestions
        suggestions.forEach((suggestion) => {
            // Create a new div element for each suggestion
            const item = document.createElement("div");
            item.className = "autocomplete-item";

            // Configure icon
            const itemIcon = document.createElement("span");
            itemIcon.className = "material-symbols-outlined";
            itemIcon.textContent = "location_on";

            // Configure text
            const itemText = document.createElement("span");
            itemText.textContent = suggestion.properties.formatted;

            // Append icon and text to the suggestion item
            item.appendChild(itemIcon);
            item.appendChild(itemText);

            container.appendChild(item);

            // Add click event listener to the suggestion item
            item.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent the click event from bubbling up to the document
                input.value = itemText.textContent;
                container.style.display = "none";
                console.log(e);
            });
        });
    }

    input.addEventListener("input", function () {
        if (input.value.length >= 3) {
            fetchSuggestions(input.value);
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    });

    input.addEventListener("blur", function (e) {
        window.addEventListener("mouseup", function (e) {
            container.style.display = "none";
        });
    });    
});
