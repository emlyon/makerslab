(async () => {
  const pathName = window.location.pathname;
  const isHomepage =
    pathName === '/' || pathName === '/index.html' || pathName === '/fr' || pathName === '/fr/' || pathName === '/fr/index.html';
  if (!isHomepage) {
    return;
  }

  const isFrench = pathName.startsWith('/fr/');
  const DISMISSED_POPUP_HASH_KEY = 'makerslab.dismissedPopupHash.v1';

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function withLineBreaks(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  function closeLabel() {
    return isFrench ? 'Fermer' : 'Close';
  }

  function hashString(value) {
    // djb2 variant, deterministic and fast for short strings.
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 33) ^ value.charCodeAt(index);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function popupIdentityHash(popup) {
    const identity = [
      popup.id || '',
      popup.startsOn || '',
      popup.endsOn || '',
      popup.titleFr || '',
      popup.contentFr || '',
      popup.titleEn || '',
      popup.contentEn || ''
    ].join('|');

    return hashString(identity);
  }

  function readDismissedPopupHash() {
    try {
      return window.localStorage.getItem(DISMISSED_POPUP_HASH_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  function writeDismissedPopupHash(hash) {
    try {
      window.localStorage.setItem(DISMISSED_POPUP_HASH_KEY, hash);
    } catch (_error) {
      // Ignore storage failures (private mode / disabled storage).
    }
  }

  function modalMarkup(title, content) {
    return `
      <div id="noticeModal" class="modal">
        <div class="modal-content">
          <h4 class="red-text">${escapeHtml(title)}</h4>
          <div class="popup-content">${content}</div>
        </div>
        <div class="modal-footer">
          <a href="#\!" class="modal-action modal-close btn-flat">${closeLabel()}</a>
        </div>
      </div>
    `;
  }

  try {
    const response = await fetch('/data/popup.json');
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (!data || !data.active || !data.popup) {
      return;
    }

    const popupHash = popupIdentityHash(data.popup);
    if (readDismissedPopupHash() === popupHash) {
      return;
    }

    const title = isFrench ? data.popup.titleFr : data.popup.titleEn;
    const content = isFrench ? data.popup.contentFr : data.popup.contentEn;
    if (!title || !content) {
      return;
    }

    const existingModal = document.getElementById('noticeModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('afterbegin', modalMarkup(title, content));

    const modalElement = document.getElementById('noticeModal');
    if (!modalElement || typeof M === 'undefined' || !M.Modal) {
      return;
    }

    const instance = M.Modal.init(modalElement, {
      onCloseEnd: () => {
        writeDismissedPopupHash(popupHash);
      }
    });
    instance.open();
  } catch (_error) {
    // Keep homepage functional even if popup data is unavailable.
  }
})();
