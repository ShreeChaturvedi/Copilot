document.addEventListener('DOMContentLoaded', function () {
    DecoupledEditor
        .create(document.querySelector('.document-editor__editable'), {
            // Extensive toolbar configuration

            fontFamily: {

            },

            image: {
                // Image plugin configuration
                toolbar: ['imageTextAlternative', '|', 'imageStyle:full', 'imageStyle:side']
            },
            table: {
                // Table plugin configuration
                contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
            },

            autosave: {
                save(editor) {
                    let eventToEdit = getCurrentEvent();
                    // get the event from allEvents
                    allEvents.get(eventToEdit.extendedProps.calendarName).find(
                        event => event.id === eventToEdit.id
                    ).extendedProps.notes = editor.getData();
                }
            },
            // Additional CKEditor plugins can be added here

        })
        .then(editor => {
            const toolbarContainer = document.querySelector('.document-editor__toolbar');
            toolbarContainer.appendChild(editor.ui.view.toolbar.element);
            window.editor = editor;
            addCloseButtonToToolbar(window.editor);
        })
        .catch(err => {
            console.error(err);
        });

    function addCloseButtonToToolbar(editor) {
        // Create the button element
        const closeButton = document.createElement('span');
        closeButton.className = 'material-symbols-outlined';
        closeButton.innerText = 'close';
        closeButton.id = 'close-editor';

        // Set the button click event
        closeButton.addEventListener('click', () => {
            document.querySelector('.document-editor__container').classList.toggle('show');
        });

        // Find the toolbar and append the button
        const toolbar = editor.ui.view.toolbar.element;
        toolbar.appendChild(closeButton);
    }

    var getCurrentEvent = function () {
        console.log(currentEvent);
        let returnval = allEvents.get(currentEvent.extendedProps.calendarName).find(
            event => event.id === currentEvent.id
        );
        console.log(returnval);
        return returnval;
    }
});
