(() => {
  const EDITOR_IDS = ['reportFacts', 'reportActionsTaken', 'reportConclusions', 'reportNotes'];
  let activeTextarea = null;
  let activeEditor = null;
  let refreshQueued = false;
  let isRefreshing = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function bbCodeToHtml(value) {
    let html = escapeHtml(value || '');

    html = html
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
      .replace(/\[strong\]([\s\S]*?)\[\/strong\]/gi, '<strong>$1</strong>')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
      .replace(/\[em\]([\s\S]*?)\[\/em\]/gi, '<em>$1</em>')
      .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
      .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
      .replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, '<s>$1</s>')
      .replace(/\[br\s*\/\]/gi, '<br>')
      .replace(/\[br\]/gi, '<br>');

    html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
      const items = content.split(/\[\*\]/g).map((item) => item.trim()).filter(Boolean).map((item) => `<li>${item}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    html = html.replace(/\[ol\]([\s\S]*?)\[\/ol\]/gi, (_, content) => {
      const items = content.split(/\[\*\]/g).map((item) => item.trim()).filter(Boolean).map((item) => `<li>${item}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
      const items = content.split(/\[\*\]/g).map((item) => item.trim()).filter(Boolean).map((item) => `<li>${item}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    html = html.replace(/\[ul\]([\s\S]*?)\[\/ul\]/gi, (_, content) => {
      const items = content.split(/\[\*\]/g).map((item) => item.trim()).filter(Boolean).map((item) => `<li>${item}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    return html;
  }

  function sanitizeRichHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'P', 'BR', 'UL', 'OL', 'LI']);

    template.content.querySelectorAll('*').forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
    });

    return template.innerHTML
      .replace(/<div>/gi, '<p>')
      .replace(/<\/div>/gi, '</p>')
      .replace(/<span>/gi, '')
      .replace(/<\/span>/gi, '')
      .trim();
  }

  function hasHtml(value) {
    return /<\/?(p|b|strong|i|em|u|s|ul|ol|li|br)\b/i.test(String(value || ''));
  }

  function hasBBCode(value) {
    return /\[(b|strong|i|em|u|s|strike|br|list|list=1|ul|ol|\*)\b/i.test(String(value || ''));
  }

  function plainTextToHtml(value) {
    return String(value || '')
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function textToRichHtml(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (hasHtml(raw)) return sanitizeRichHtml(raw);
    if (hasBBCode(raw)) return sanitizeRichHtml(bbCodeToHtml(raw));
    return sanitizeRichHtml(plainTextToHtml(raw));
  }

  function richToPlainText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeRichHtml(html);
    return tmp.textContent.trim();
  }

  function setValueIfChanged(element, value) {
    if (!element || element.value === value) return false;
    element.value = value;
    return true;
  }

  function setHtmlIfChanged(element, value) {
    if (!element || element.innerHTML === value) return false;
    element.innerHTML = value;
    return true;
  }

  function syncTextarea(textarea, editor) {
    const normalized = textToRichHtml(editor.innerHTML);
    if (setValueIfChanged(textarea, normalized)) {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function exec(command) {
    document.execCommand(command, false, null);
    activeEditor?.focus();
    if (activeTextarea && activeEditor) syncTextarea(activeTextarea, activeEditor);
  }

  function toolbar() {
    const bar = document.createElement('div');
    bar.className = 'rich-editor-toolbar';
    bar.innerHTML = `
      <button type="button" data-command="bold" title="Gras">B</button>
      <button type="button" data-command="italic" title="Italique"><i>I</i></button>
      <button type="button" data-command="underline" title="Souligné"><u>U</u></button>
      <button type="button" data-command="strikeThrough" title="Barré"><s>S</s></button>
      <button type="button" data-command="insertUnorderedList" title="Liste">•</button>
      <button type="button" data-command="insertOrderedList" title="Liste numérotée">1.</button>
      <span class="rich-editor-spacer"></span>
      <button type="button" class="rich-editor-expand" title="Agrandir">⛶</button>
    `;
    return bar;
  }

  function buildEditor(textarea) {
    if (!textarea || textarea.dataset.richEditor === '1') return;
    textarea.dataset.richEditor = '1';
    textarea.classList.add('rich-editor-source');

    const normalized = textToRichHtml(textarea.value);
    setValueIfChanged(textarea, normalized);

    const shell = document.createElement('div');
    shell.className = 'rich-editor-shell';
    shell.dataset.for = textarea.id;

    const bar = toolbar();
    const surface = document.createElement('div');
    surface.className = 'rich-editor-surface';
    surface.contentEditable = 'true';
    surface.dataset.placeholder = textarea.getAttribute('placeholder') || 'Écrire le contenu du rapport...';
    surface.innerHTML = normalized;

    shell.appendChild(bar);
    shell.appendChild(surface);
    textarea.insertAdjacentElement('afterend', shell);

    surface.addEventListener('focus', () => {
      activeTextarea = textarea;
      activeEditor = surface;
    });

    surface.addEventListener('input', () => syncTextarea(textarea, surface));
    surface.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertHTML', false, textToRichHtml(text));
      syncTextarea(textarea, surface);
    });

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      event.preventDefault();

      activeTextarea = textarea;
      activeEditor = surface;
      surface.focus();

      if (button.classList.contains('rich-editor-expand')) {
        openModal(textarea, surface);
        return;
      }

      exec(button.dataset.command);
    });
  }

  function ensureModal() {
    let modal = document.querySelector('#richEditorModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'richEditorModal';
    modal.className = 'rich-editor-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="rich-editor-modal-card">
        <div class="rich-editor-modal-header">
          <strong id="richEditorModalTitle">Édition du rapport</strong>
          <button type="button" class="rich-editor-modal-close">Fermer</button>
        </div>
        <div class="rich-editor-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.rich-editor-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });

    return modal;
  }

  function openModal(textarea, sourceEditor) {
    const modal = ensureModal();
    const body = modal.querySelector('.rich-editor-modal-body');
    const title = modal.querySelector('#richEditorModalTitle');
    const label = textarea.closest('label')?.childNodes?.[0]?.textContent?.trim() || 'Édition du rapport';

    title.textContent = label;
    body.innerHTML = '';

    const bar = toolbar();
    const surface = document.createElement('div');
    surface.className = 'rich-editor-surface';
    surface.contentEditable = 'true';
    surface.dataset.placeholder = sourceEditor.dataset.placeholder || 'Écrire le contenu du rapport...';
    surface.innerHTML = sourceEditor.innerHTML;

    bar.querySelector('.rich-editor-expand')?.remove();
    body.appendChild(bar);
    body.appendChild(surface);

    activeTextarea = textarea;
    activeEditor = surface;
    modal.hidden = false;
    setTimeout(() => surface.focus(), 0);

    surface.addEventListener('input', () => syncTextarea(textarea, surface));
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) return;
      event.preventDefault();
      activeTextarea = textarea;
      activeEditor = surface;
      surface.focus();
      exec(button.dataset.command);
    });

    modal.dataset.sourceId = textarea.id;
  }

  function closeModal() {
    const modal = document.querySelector('#richEditorModal');
    if (!modal || modal.hidden) return;

    const sourceId = modal.dataset.sourceId;
    const textarea = sourceId ? document.querySelector(`#${sourceId}`) : null;
    const sourceSurface = textarea?.nextElementSibling?.querySelector('.rich-editor-surface');
    const modalSurface = modal.querySelector('.rich-editor-modal-body .rich-editor-surface');

    if (textarea && sourceSurface && modalSurface) {
      const normalized = textToRichHtml(modalSurface.innerHTML);
      setHtmlIfChanged(sourceSurface, normalized);
      syncTextarea(textarea, sourceSurface);
    }

    modal.hidden = true;
    modal.querySelector('.rich-editor-modal-body').innerHTML = '';
  }

  function refreshEditors() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
      EDITOR_IDS.forEach((id) => {
        const textarea = document.querySelector(`#${id}`);
        if (!textarea) return;

        buildEditor(textarea);

        const surface = textarea.nextElementSibling?.querySelector('.rich-editor-surface');
        const normalized = textToRichHtml(textarea.value);

        setValueIfChanged(textarea, normalized);

        if (surface && document.activeElement !== surface && surface !== activeEditor) {
          setHtmlIfChanged(surface, normalized);
        }
      });
    } finally {
      isRefreshing = false;
    }
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      refreshEditors();
    });
  }

  window.MDTRichText = {
    sanitize: sanitizeRichHtml,
    bbCodeToHtml,
    toHtml: textToRichHtml,
    toText: richToPlainText,
    refresh: scheduleRefresh,
  };

  const observer = new MutationObserver((mutations) => {
    if (isRefreshing) return;

    const shouldRefresh = mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return EDITOR_IDS.some((id) => node.id === id || Boolean(node.querySelector?.(`#${id}`)));
    }));

    if (shouldRefresh) scheduleRefresh();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', (event) => {
    if (EDITOR_IDS.includes(event.target?.id)) scheduleRefresh();
  });
  document.addEventListener('DOMContentLoaded', scheduleRefresh);
  setTimeout(scheduleRefresh, 0);
})();
