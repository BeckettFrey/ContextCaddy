// Background service worker for ContextCaddy Chrome Extension

// Initialize extension on startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('ContextCaddy extension installed');
  
  // Set default settings
  chrome.storage.local.set({
    minTextLength: 10,
    maxTextLength: 5000,
    serverUrl: 'http://localhost:8000'
  });
  
  // Create context menu
  createContextMenu();
});

// Create context menu for adding selected text
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'add-to-cabinet',
      title: 'Add to ContextCaddy Cabinet',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-cabinet') {
    // Get selected cabinet from storage
    const result = await chrome.storage.local.get(['selectedCabinet']);
    const selectedCabinet = result.selectedCabinet;
    
    if (!selectedCabinet) {
      // Open side panel if no cabinet selected
      await chrome.sidePanel.open({ tabId: tab.id });
      // Send message to side panel to show cabinet selection prompt
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'SHOW_CABINET_PROMPT',
          text: info.selectionText,
          sourceUrl: tab.url
        });
      }, 500);
      return;
    }
    
    // Validate text length
    const settings = await chrome.storage.local.get(['minTextLength', 'maxTextLength']);
    const minLength = settings.minTextLength || 10;
    const maxLength = settings.maxTextLength || 5000;
    
    if (info.selectionText.length < minLength) {
      chrome.runtime.sendMessage({
        type: 'SHOW_ERROR',
        message: `Selected text is too short (minimum ${minLength} characters)`
      });
      return;
    }
    
    if (info.selectionText.length > maxLength) {
      chrome.runtime.sendMessage({
        type: 'SHOW_ERROR',
        message: `Selected text is too long (maximum ${maxLength} characters)`
      });
      return;
    }
    
    // Send to side panel for processing
    chrome.runtime.sendMessage({
      type: 'ADD_TEXT_TO_CABINET',
      cabinet: selectedCabinet,
      text: info.selectionText,
      sourceUrl: tab.url
    });
    
    // Open side panel to show progress
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DRAG_DROP_TEXT') {
    // Forward drag and drop messages to side panel
    chrome.runtime.sendMessage({
      type: 'PROCESS_DRAGGED_TEXT',
      text: message.text,
      sourceUrl: sender.tab?.url || 'unknown'
    });
  }
  
  return true; // Keep message channel open for async response
});