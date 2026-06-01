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

  document.addEventListener('keydown', onEscapeKey);
}


const CARD_SELECTORS = [
  // new layout
  'yt-lockup-view-model',
  // old layout
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
];

function injectIntoCard(card) {
  if (card.dataset.yteBtn) return;

  // new layout: yt-thumbnail-view-model |   old layout: ytd-thumbnail
  const thumbEl = card.querySelector('yt-thumbnail-view-model') ||
                  card.querySelector('ytd-thumbnail');
  if (!thumbEl) return;

  // Support both new layout link and old a#thumbnail
  const a = card.querySelector('a[href*="/watch"]') ||
            card.querySelector('ytd-thumbnail a#thumbnail[href]');
  if (!a) return;

  const href = a.getAttribute('href');
  if (!getEmbedUrl(href)) return;

  card.dataset.yteBtn = '1';
  thumbEl.style.setProperty('position', 'relative', 'important');

  const btn = document.createElement('button');
  btn.className = 'yte-card-btn';
  btn.textContent = 'Embed';
  btn.title = 'Open as embed';

  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    window.open(getEmbedUrl(a.getAttribute('href')), '_blank');
  }, { capture: true });

  thumbEl.appendChild(btn);
}

// inject into ytd-video-preview (hover clip card) and re-inject each time it activates.
function handlePreviewCard(preview) {
  if (preview.hasAttribute('hidden')) {
    const old = preview.querySelector('.yte-preview-btn');
    if (old) old.remove();
    delete preview.dataset.ytePreviewBtn;
    return;
  }
  if (preview.dataset.ytePreviewBtn) return;

  let href = null;
  const ancestorCard = preview.closest(CARD_SELECTORS.join(','));
  if (ancestorCard) {
    const a = ancestorCard.querySelector('a[href*="/watch"]') ||
              ancestorCard.querySelector('ytd-thumbnail a#thumbnail[href]');
    if (a) href = a.getAttribute('href');
  }

  // fallback
  if (!href) {
    const directLink = preview.querySelector('a[href*="/watch"]');
    if (directLink) href = directLink.getAttribute('href');
  }

  if (!href) {
    for (const sel of CARD_SELECTORS) {
      const hoveredCard = document.querySelector(`${sel}:hover`);
      if (hoveredCard) {
        const a = hoveredCard.querySelector('a[href*="/watch"]') ||
                  hoveredCard.querySelector('ytd-thumbnail a#thumbnail[href]');
        if (a) { href = a.getAttribute('href'); break; }
      }
    }
  }

  if (!href || !getEmbedUrl(href)) return;

  preview.dataset.ytePreviewBtn = '1';
  preview.style.setProperty('position', 'relative', 'important');

  const btn = document.createElement('button');
  btn.className = 'yte-card-btn yte-preview-btn';
  btn.textContent = 'Embed';
  btn.title = 'Open as embed';

  const captured = href;
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    window.open(getEmbedUrl(captured), '_blank');
  }, { capture: true });

  preview.appendChild(btn);
}

function processAll() {
  CARD_SELECTORS.forEach(sel => {
    const found = document.querySelectorAll(sel);
    if (found.length) console.log(`[yte] ${sel}: ${found.length} found`);
    found.forEach(injectIntoCard);
  });
  document.querySelectorAll('ytd-video-preview:not([hidden])').forEach(handlePreviewCard);

  const btns = document.querySelectorAll('.yte-card-btn').length;
  const marked = document.querySelectorAll('[data-yte-btn]').length;
  console.log(`[yte] buttons injected: ${btns}, cards marked: ${marked}`);

  // detect new-layout thumbnail elements
  const newLayout = document.querySelectorAll('yt-lockup-view-model, yt-thumbnail-view-model');
  if (newLayout.length) console.log(`[yte] NEW LAYOUT detected: yt-lockup-view-model/yt-thumbnail-view-model x${newLayout.length}`);
}

let _processTimer = null;
const _cardObserver = new MutationObserver(mutations => {
  let needsProcess = false;
  for (const m of mutations) {
    if (m.type === 'childList') { needsProcess = true; break; }
    if (m.type === 'attributes' && m.target.tagName === 'YTD-VIDEO-PREVIEW') {
      handlePreviewCard(m.target);
    }
  }
  if (needsProcess) {
    clearTimeout(_processTimer);
    _processTimer = setTimeout(processAll, 150);
  }
});

_cardObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden'],
});

processAll();

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

