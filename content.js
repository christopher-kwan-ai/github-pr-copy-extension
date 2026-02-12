// GitHub PR Copy for Slack - Content Script

(function() {
  'use strict';

  let retryCount = 0;
  const MAX_RETRIES = 20;

  // SVGs use 100% width/height to scale with button size
  const COPY_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
  const CHECK_ICON = '<svg aria-hidden="true" viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>';

  function getPRInfo() {
    const pageTitle = document.title;
    const match = pageTitle.match(/^(.+?) by .+? · Pull Request #(\d+)/i) ||
                  pageTitle.match(/^(.+?) · Pull Request #(\d+)/i);

    let title = match ? match[1].trim() : '';
    let prNumber = match ? `#${match[2]}` : '';

    if (!prNumber) {
      const urlMatch = window.location.pathname.match(/\/pull\/(\d+)/);
      if (urlMatch) prNumber = `#${urlMatch[1]}`;
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

  function findPRNumberElement() {
    const h1 = document.querySelector('h1[class*="PageHeader-Title"]');
    if (h1) {
      const span = h1.querySelector('span.f1-light') ||
                   h1.querySelector('span[class*="fgColor-muted"]') ||
                   h1.querySelector('span:last-child');
      if (span) return { element: span, method: 'afterend' };
    }

    const oldH1 = document.querySelector('.gh-header-title');
    if (oldH1) {
      const span = oldH1.querySelector('span.f1-light');
      if (span) return { element: span, method: 'afterend' };
      return { element: oldH1, method: 'beforeend' };
    }
    return null;
  }

  function createCopyButton() {
    if (document.querySelector('.ghpr-copy-button')) return;

    const insertPoint = findPRNumberElement();
    if (!insertPoint) {
      if (++retryCount < MAX_RETRIES) {
        setTimeout(createCopyButton, Math.min(300 * Math.pow(1.3, retryCount), 3000));
      }
      return;
    }

    retryCount = 0;
    const btn = document.createElement('button');
    btn.className = 'ghpr-copy-button';
    btn.type = 'button';
    btn.title = 'Copy PR link for Slack';
    btn.innerHTML = COPY_ICON;
    // Get title styles dynamically to match formatting.
    const h1 = document.querySelector('h1[class*="PageHeader-Title"]') || document.querySelector('.gh-header-title');
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const fontSize = h1Style ? h1Style.fontSize : '20px';
    const lineHeight = h1Style ? h1Style.lineHeight : 'normal';
    const size = Math.min(parseInt(fontSize) || 20, 20); // Cap at 20px max

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
    `;

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

    insertPoint.element.insertAdjacentElement(insertPoint.method, btn);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copy-pr-link') {
      const btn = document.querySelector('.ghpr-copy-button');
      if (btn) {
        btn.click();
      }
      sendResponse({ success: true });
    }
  });

  function init() {
    createCopyButton();
    new MutationObserver(() => {
      if (!document.querySelector('.ghpr-copy-button')) {
        clearTimeout(window.ghprDebounce);
        window.ghprDebounce = setTimeout(createCopyButton, 100);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
