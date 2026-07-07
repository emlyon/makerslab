(async () => {
  const pathName = window.location.pathname;
  const isHomepage =
    pathName === '/' || pathName === '/index.html' || pathName === '/fr' || pathName === '/fr/' || pathName === '/fr/index.html';
  if (!isHomepage) {
    return;
  }

  const isFrench = pathName.startsWith('/fr/');

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

  function modalMarkup(title, content) {
    return `
      <div id="noticeModal" class="modal">
        <div class="modal-content">
          <h4 class="red-text">${escapeHtml(title)}</h4>
          <p>${withLineBreaks(content)}</p>
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

    const instance = M.Modal.init(modalElement, {});
    instance.open();
  } catch (_error) {
    // Keep homepage functional even if popup data is unavailable.
  }
})();
