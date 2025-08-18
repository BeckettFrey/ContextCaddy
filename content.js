// Content script for ContextCaddy - handles text selection and drag events

let isDragging = false;
let selectedText = '';

// Track text selection
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
});

// Handle drag start on selected text
document.addEventListener('dragstart', (e) => {
  if (selectedText) {
    isDragging = true;
    e.dataTransfer.setData('text/plain', selectedText);
    e.dataTransfer.effectAllowed = 'copy';
  }
});

// Handle drag end
document.addEventListener('dragend', () => {
  if (isDragging && selectedText) {
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'DRAG_DROP_TEXT',
      text: selectedText
    });
    isDragging = false;
  }
});

// Prevent default drag behavior on some elements to enable text dragging
document.addEventListener('dragover', (e) => {
  if (selectedText) {
    e.preventDefault();
  }
});

// Make selected text draggable
document.addEventListener('selectstart', () => {
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        // Add draggable attribute to selection container
        try {
          const container = range.commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) {
            container.parentElement.draggable = true;
          } else if (container.nodeType === Node.ELEMENT_NODE) {
            container.draggable = true;
          }
        } catch (e) {
          // Ignore errors - some elements can't be made draggable
        }
      }
    }
  }, 10);
});