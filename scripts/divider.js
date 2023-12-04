document.addEventListener('DOMContentLoaded', function() {
    var startX, startWidth;
    var leftPane = document.querySelector('.left-pane');
    var rightPane = document.querySelector('.right-pane');
    var divider = document.getElementById('draggable-divider');

    divider.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startWidth = leftPane.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); // Prevent default dragging behavior
    });

    function onMouseMove(e) {
        var newWidth = startWidth + e.clientX - startX;
        var minWidth = window.innerWidth * 0.20; // 20% of the screen width
        var maxWidth = window.innerWidth * 0.40; // 40% of the screen width

        // Constrain the new width between the min and max bounds
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        // Update the width of the left pane
        leftPane.style.width = newWidth + 'px';
        rightPane.style.width = (window.innerWidth - newWidth) + 'px';
        calendar.render();
    }

    function onMouseUp(e) {
        // Remove the event listeners when dragging is finished
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
});

document.getElementById("modal-content").addEventListener("click", function (event) {
    event.stopPropagation();
});