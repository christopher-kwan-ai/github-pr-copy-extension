// GitHub PR Copy for Slack - Content Script

(function() {
  'use strict';

  let retryCount = 0;
  const MAX_RETRIES = 20;
  const BUTTON_SELECTOR = '.ghpr-copy-button';
  let observer = null;
  let debouncedSync = null;
  let lastUrl = window.location.href;

  // SVGs use 100% width/height to scale with button size
  const COPY_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
  const CHECK_ICON = '<svg aria-hidden="true" viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>';

  function isPullRequestPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.pathname);
  }

  function removeCopyButton() {
    const existingButton = document.querySelector(BUTTON_SELECTOR);
    if (existingButton) {
      existingButton.remove();
    }
  }

  function getPRInfo() {
    const titleElement = findPRTitleElement();
    const pageTitle = document.title;
    const match = pageTitle.match(/^(.+?) by .+? · Pull Request #(\d+)/i) ||
                  pageTitle.match(/^(.+?) · Pull Request #(\d+)/i);

    let title = titleElement ? titleElement.textContent.trim() : '';
    let prNumber = match ? `#${match[2]}` : '';

    if (!title && match) {
      title = match[1].trim();
    }

    if (!prNumber) {
      const prNumberElement = findPRNumberTextElement();
      if (prNumberElement) {
        prNumber = prNumberElement.textContent.trim();
      } else {
        const urlMatch = window.location.pathname.match(/\/pull\/(\d+)/);
        if (urlMatch) prNumber = `#${urlMatch[1]}`;
      }
    }

    const url = window.location.href.split('?')[0].split('#')[0];
    return { title, prNumber, url };
  }

  function showFeedback(btn, success) {
    btn.innerHTML = success ? CHECK_ICON : COPY_ICON;
    btn.style.color = success ? '#1a7f37' : '#cf222e';
    setTimeout(() => {
      btn.innerHTML = COPY_ICON;
      btn.style.color = '#656d76';
      btn.style.backgroundColor = 'transparent';
    }, 1000);
  }

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    const { title, prNumber, url } = getPRInfo();

    if (!title && !prNumber) {
      showFeedback(btn, false);
      return;
    }

    const displayText = prNumber ? `${title} ${prNumber}` : title;

    try {
      // Copy as rich text (HTML) so Slack gets a clickable link
      const html = `<a href="${url}">${displayText}</a>`;
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([displayText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob
        })
      ]);
      showFeedback(btn, true);
    } catch (err) {
      showFeedback(btn, false);
    }
  }

  function findTitleHeading() {
    return document.querySelector(
      'h1[class*="PageHeader-Title"], h1[data-testid="issue-title"], .gh-header-title'
    );
  }

  function findPRTitleElement() {
    const h1 = findTitleHeading();
    if (!h1) return null;

    return h1.querySelector(
      '[data-testid="issue-title"], .js-issue-title, bdi, span[class*="Text"], span:not([class*="fgColor-muted"])'
    ) || h1;
  }

  function findPRNumberTextElement() {
    const h1 = findTitleHeading();
    if (!h1) return null;

    const candidates = h1.querySelectorAll('span, a, bdi, strong');
    for (const candidate of candidates) {
      const text = candidate.textContent.trim();
      if (/^#\d+$/.test(text)) {
        return candidate;
      }
    }
    return null;
  }

  function findInsertPoint() {
    const h1 = findTitleHeading();
    if (!h1) return null;

    const numberElement = findPRNumberTextElement();
    if (numberElement) {
      return { element: numberElement, method: 'afterend' };
    }

    return { element: h1, method: 'beforeend' };
  }

  function createCopyButton() {
    const btn = document.createElement('button');
    btn.className = 'ghpr-copy-button';
    btn.type = 'button';
    btn.title = 'Copy PR link for Slack';
    btn.innerHTML = COPY_ICON;
    btn.addEventListener('mouseenter', function() {
      this.style.color = '#24292f';
      this.style.backgroundColor = 'rgba(208,215,222,0.32)';
    });

    btn.addEventListener('mouseleave', function() {
      if (this.style.color !== 'rgb(26, 127, 55)') {
        this.style.color = '#656d76';
        this.style.backgroundColor = 'transparent';
      }
    });

    btn.addEventListener('click', handleClick);
    return btn;
  }

  function applyButtonStyles(btn) {
    const h1 = findTitleHeading();
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const fontSize = h1Style ? h1Style.fontSize : '20px';
    const lineHeight = h1Style ? h1Style.lineHeight : 'normal';
    const size = Math.min(parseInt(fontSize, 10) || 20, 20);

    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${size}px;
      height: ${size}px;
      padding: 0;
      margin-left: 8px;
      color: #656d76;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      vertical-align: baseline;
      line-height: ${lineHeight};
      flex-shrink: 0;
    `;
  }

  function syncCopyButton() {
    if (!isPullRequestPage()) {
      retryCount = 0;
      removeCopyButton();
      return;
    }

    const insertPoint = findInsertPoint();
    if (!insertPoint) {
      if (++retryCount < MAX_RETRIES) {
        setTimeout(syncCopyButton, Math.min(300 * Math.pow(1.3, retryCount), 3000));
      }
      return;
    }

    retryCount = 0;
    const btn = document.querySelector(BUTTON_SELECTOR) || createCopyButton();
    applyButtonStyles(btn);
    insertPoint.element.insertAdjacentElement(insertPoint.method, btn);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copy-pr-link') {
      syncCopyButton();
      const btn = document.querySelector(BUTTON_SELECTOR);
      if (btn) {
        btn.click();
      }
      sendResponse({ success: true });
    }
  });

  function init() {
    debouncedSync = () => {
      clearTimeout(window.ghprDebounce);
      window.ghprDebounce = setTimeout(syncCopyButton, 100);
    };

    const handleLocationChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) return;

      lastUrl = currentUrl;
      retryCount = 0;
      debouncedSync();
    };

    syncCopyButton();

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      handleLocationChange();
      debouncedSync();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('turbo:load', handleLocationChange);
    window.addEventListener('turbo:render', handleLocationChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
