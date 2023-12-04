document.addEventListener('DOMContentLoaded', function () {
    // Inject the search bar
    const searchBarHTML = `
        <div class="searchBar-wrapper">
            <div class="searchBar-input-wrapper">
                <span class="material-symbols-outlined">search</span>
                <input type="text" id="mySearchBar" placeholder="Search...">
            </div>
            <button id="clearSearch">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `;
    document.querySelector(".fc-searchBar-button").innerHTML = searchBarHTML;

    // Function to filter events
    function filterEvents() {
        toSearch = true;
        searchTerm = document.getElementById("mySearchBar").value;

        // reredner the calendar
        calendar.refetchEvents();
    }

    // Clear search and reset display property
    function clearSearch() {
        document.getElementById("mySearchBar").value = "";
        toSearch = false;
        calendar.refetchEvents();
    }

    document.getElementById("clearSearch").addEventListener("click", clearSearch);

    // Search functionality
    document.getElementById("mySearchBar").addEventListener("input", function () {
        if (this.value.length = 0) {
            clearSearch();
        } else {
            filterEvents();
        }
    });
});
