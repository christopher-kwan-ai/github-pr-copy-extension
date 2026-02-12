// GitHub PR Copy for Slack - Background Service Worker

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'copy-pr-link') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && tab.url.includes('github.com') && tab.url.includes('/pull/')) {
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'copy-pr-link' });
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-pr-info') {
    // Forward to content script and return response
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'copy-pr-link' });
      }
    });
  }
});
