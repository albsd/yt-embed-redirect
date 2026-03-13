'use strict';

let currentMode = 'disabled';
let askPopup = null;
let outsideClickHandler = null;

// Load mode from storage
chrome.storage.local.get({ mode: 'disabled' }, result => {
  currentMode = result.mode;
});

// Keep mode in sync if changed while on the page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mode) {
    currentMode = changes.mode.newValue;
  }
});

/**
 * Resolves href to a full URL and checks if it's a YouTube /watch link.
 * Returns the transformed yout-ube.com URL, or null if not applicable.
 */
function getEmbedUrl(href) {
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (!url.hostname.includes('youtube.com')) return null;
  if (!url.pathname.startsWith('/watch')) return null;
  url.hostname = url.hostname.replace('youtube.com', 'yout-ube.com');
  return url.toString();
}

/**
 * Walks up the DOM from target to find the closest anchor with an href.
 */
function getAnchorHref(target) {
  const anchor = target.closest('a[href]');
  return anchor ? anchor.getAttribute('href') : null;
}

// ── Ask popup ────────────────────────────────────────────────────────────────

function removeAskPopup() {
  if (askPopup) {
    askPopup.remove();
    askPopup = null;
  }
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler, { capture: true });
    outsideClickHandler = null;
  }
  document.removeEventListener('keydown', onEscapeKey);
}

function onEscapeKey(e) {
  if (e.key === 'Escape') removeAskPopup();
}

function showAskPopup(cursorX, cursorY, embedUrl, originalHref) {
  removeAskPopup();

  const popup = document.createElement('div');
  popup.id = 'yte-ask-popup';
  popup.innerHTML = `
    <div class="yte-popup-text">Open as embed?</div>
    <div class="yte-popup-buttons">
      <button class="yte-btn yte-btn-yes">Yes</button>
      <button class="yte-btn yte-btn-no">No</button>
    </div>
  `;

  popup.style.left = `${cursorX}px`;
  popup.style.top = `${cursorY}px`;

  document.body.appendChild(popup);
  askPopup = popup;

  // Adjust position if popup overflows viewport
  requestAnimationFrame(() => {
    const rect = popup.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      popup.style.left = `${cursorX - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight - 8) {
      popup.style.top = `${cursorY - rect.height - 10}px`;
    }
  });

  // Yes — open embed in new tab
  popup.querySelector('.yte-btn-yes').addEventListener('click', e => {
    e.stopPropagation();
    removeAskPopup();
    window.open(embedUrl, '_blank');
  });

  // No — navigate to the original YouTube video
  popup.querySelector('.yte-btn-no').addEventListener('click', e => {
    e.stopPropagation();
    removeAskPopup();
    window.location.href = new URL(originalHref, location.href).toString();
  });

  // Dismiss on outside click
  outsideClickHandler = e => {
    if (askPopup && !askPopup.contains(e.target)) {
      removeAskPopup();
    }
  };
  // Defer so the current click event doesn't immediately dismiss it
  setTimeout(() => {
    document.addEventListener('click', outsideClickHandler, { capture: true });
  }, 0);

  // Dismiss on Escape
  document.addEventListener('keydown', onEscapeKey);
}

// ── Main click interceptor ────────────────────────────────────────────────────

document.addEventListener('click', e => {
  if (currentMode === 'disabled') return;

  // Ignore clicks inside our own popup
  if (askPopup && askPopup.contains(e.target)) return;

  const href = getAnchorHref(e.target);
  if (!href) return;

  const embedUrl = getEmbedUrl(href);
  if (!embedUrl) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (currentMode === 'enabled') {
    window.open(embedUrl, '_blank');
  } else if (currentMode === 'ask') {
    showAskPopup(e.clientX + 12, e.clientY + 12, embedUrl, href);
  }
}, { capture: true });

