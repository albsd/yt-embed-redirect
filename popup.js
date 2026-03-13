'use strict';

const options = document.querySelectorAll('.option');

function setActiveOption(mode) {
  options.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.value === mode);
  });
}

// Load current mode and highlight it
chrome.storage.local.get({ mode: 'disabled' }, result => {
  setActiveOption(result.mode);
});

// Handle option clicks
options.forEach(opt => {
  opt.addEventListener('click', () => {
    const mode = opt.dataset.value;
    chrome.storage.local.set({ mode });
    setActiveOption(mode);
  });
});

// Sync if storage changes externally while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mode) {
    setActiveOption(changes.mode.newValue);
  }
});
