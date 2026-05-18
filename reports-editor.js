(() => {
  const EDITOR_IDS = ['reportFacts', 'reportActionsTaken', 'reportConclusions', 'reportNotes'];
  const TEXT_COLOR_CLASSES = ['mdt-rich-color-red', 'mdt-rich-color-orange', 'mdt-rich-color-yellow', 'mdt-rich-color-green', 'mdt-rich-color-blue', 'mdt-rich-color-purple'];
  const HIGHLIGHT_CLASSES = ['mdt-rich-highlight-yellow', 'mdt-rich-highlight-green', 'mdt-rich-highlight-blue', 'mdt-rich-highlight-red'];
  const REDACTION_CLASSES = ['mdt-rich-classified', 'mdt-rich-redacted'];
  const ALLOWED_SPAN_CLASSES = new Set([...TEXT_COLOR_CLASSES, ...HIGHLIGHT_CLASSES, ...REDACTION_CLASSES]);
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

  function bbClass(type, value) {
    const normalized = String(value || '').trim().toLowerCase();
    const colorMap = {
      red: 'mdt-rich-color-red', rouge: 'mdt-rich-color-red',
      orange: 'mdt-rich-color-orange',
      yellow: 'mdt-rich-color-yellow', jaune: 'mdt-rich-color-yellow',
      green: 'mdt-rich-color-green', vert: 'mdt-rich-color-green',
      blue: 'mdt-rich-color-blue', bleu: 'mdt-rich-color-blue',
      purple: 'mdt-rich-color-purple', violet: 'mdt-rich-color-purple',
    };
    const highlightMap = {
      yellow: 'mdt-rich-highlight-yellow', jaune: 'mdt-rich-highlight-yellow',
      green: 'mdt-rich-highlight-green', vert: 'mdt-rich-highlight-green',
      blue: 'mdt-rich-highlight-blue', bleu: 'mdt-rich-highlight-blue',
      red: 'mdt-rich-highlight-red', rouge: 'mdt-rich-highlight-red',
    };
    return type === 'highlight' ? highlightMap[normalized] : colorMap[normalized];
  }

  function convertList(content, tag) {
    const items = String(content || '')
      .split(/\[\*\]/gi)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join('');
    return `<${tag}>${items}</${tag}>`;
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
      .replace(/\[(classified|secret|redacted)\]([\s\S]*?)\[\/\1\]/gi, '<span class="mdt-rich-classified">$2</span>')
      .replace(/\[br\s*\/\]/gi, '<br>')
      .replace(/\[br\]/gi, '<br>');

    html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_, color, content) => {
      const className = bbClass('color', color);
      return className ? `<span class="${className}">${content}</span>` : content;
    });

    html = html.replace(/\[(highlight|mark|bg)=([^\]]+)\]([\s\S]*?)\[\/\1\]/gi, (_, type, color, content) => {
      const className = bbClass('highlight', color);
      return className ? `<span class="${className}">${content}</span>` : content;
    });

    html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (_, content) => convertList(content, 'ol'));
    html = html.replace(/\[ol\]([\s\S]*?)\[\/ol\]/gi, (_, content) => convertList(content, 'ol'));
    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => convertList(content, 'ul'));
    html = html.replace(/\[ul\]([\s\S]*?)\[\/ul\]/gi, (_, content) => convertList(content, 'ul'));

    return html;
  }

  function sanitizeSpanClasses(node) {
    const classes = String(node.getAttribute('class') || '')
      .split(/\s+/)
      .filter((className) => ALLOWED_SPAN_CLASSES.has(className))
      .map((className) => className === 'mdt-rich-redacted' ? 'mdt-rich-classified' : className);

    Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));

    if (classes.length) {
      node.setAttribute('class', Array.from(new Set(classes)).join(' '));
      return;
    }

    node.replaceWith(...Array.from(node.childNodes));
  }

  function sanitizeRichHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'P', 'BR', 'UL', 'OL', 'LI', 'SPAN']);

    template.content.querySelectorAll('*').forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }

      if (node.tagName === 'SPAN') {
        sanitizeSpanClasses(node);
        return;
      }

      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
    });

    return template.innerHTML
      .replace(/<div>/gi, '<p>')
      .replace(/<\/div>/gi, '</p>')
      .trim();
  }

  function hasHtml(value) {
    return /<\/?(p|b|strong|i|em|u|s|ul|ol|li|br|span)\b/i.test(String(value || ''));
  }

  function hasBBCode(value) {
    return /\[(b|strong|i|em|u|s|strike|br|list|list=1|ul|ol|\*|color|highlight|mark|bg|classified|secret|redacted)\b/i.test(String(value || ''));
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
    if (setValueIfChanged(textarea, normalized)) textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function exec(command) {
    document.execCommand(command, false, null);
    activeEditor?.focus();
    if (activeTextarea && activeEditor) syncTextarea(activeTextarea, activeEditor);
  }

  function closestRedaction(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest?.('span.mdt-rich-classified, span.mdt-rich-redacted') || null;
  }

  function unwrap(span) {
    if (!span?.parentNode) return;
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
    parent.normalize?.();
  }

  function cleanClassesInFragment(fragment, group) {
    let classes = [];
    if (group === 'highlight') classes = HIGHLIGHT_CLASSES;
    else if (group === 'color') classes = TEXT_COLOR_CLASSES;
    else if (group === 'redaction') classes = REDACTION_CLASSES;
    else classes = [...TEXT_COLOR_CLASSES, ...HIGHLIGHT_CLASSES, ...REDACTION_CLASSES];

    fragment.querySelectorAll?.('span').forEach((span) => {
      classes.forEach((className) => span.classList.remove(className));
      if (!span.getAttribute('class')) unwrap(span);
    });
  }

  function selectionTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
    }
    return nodes;
  }

  function fragmentFullyRedacted(fragment) {
    const holder = document.createElement('div');
    holder.appendChild(fragment.cloneNode(true));
    const nodes = selectionTextNodes(holder);
    if (!nodes.length) return false;
    return nodes.every((node) => Boolean(closestRedaction(node)));
  }

  function touchedRedactionSpans(surface, range) {
    const spans = new Set();
    const start = closestRedaction(range.startContainer);
    const end = closestRedaction(range.endContainer);
    if (start) spans.add(start);
    if (end) spans.add(end);

    surface.querySelectorAll('span.mdt-rich-classified, span.mdt-rich-redacted').forEach((span) => {
      try {
        if (range.intersectsNode(span)) spans.add(span);
      } catch {}
    });
    return spans;
  }

  function applyRichClass(className, group) {
    if (!activeEditor || activeEditor.contentEditable === 'false') return;
    activeEditor.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!activeEditor.contains(range.commonAncestorContainer)) return;

    if (group === 'redaction' && selection.isCollapsed) {
      const span = closestRedaction(range.startContainer);
      if (span) unwrap(span);
      if (activeTextarea) syncTextarea(activeTextarea, activeEditor);
      return;
    }

    if (selection.isCollapsed) return;

    if (group === 'redaction' && fragmentFullyRedacted(range.cloneContents())) {
      touchedRedactionSpans(activeEditor, range).forEach(unwrap);
      if (activeTextarea) syncTextarea(activeTextarea, activeEditor);
      return;
    }

    const fragment = range.extractContents();
    cleanClassesInFragment(fragment, group);

    if (!className) {
      range.insertNode(fragment);
    } else {
      const span = document.createElement('span');
      span.className = className;
      span.appendChild(fragment);
      range.insertNode(span);
      selection.removeAllRanges();
      const afterRange = document.createRange();
      afterRange.selectNodeContents(span);
      afterRange.collapse(false);
      selection.addRange(afterRange);
    }

    if (activeTextarea) syncTextarea(activeTextarea, activeEditor);
  }

  function toolbar(includeExpand = true) {
    const canRedact = Boolean(window.MDT_CAN_REDACT_REPORTS || window.MDT_CAN_EDIT_REPORT_STATUS);
    const bar = document.createElement('div');
    bar.className = 'rich-editor-toolbar';
    bar.innerHTML = `
      <button type="button" data-command="bold" title="Gras">B</button>
      <button type="button" data-command="italic" title="Italique"><i>I</i></button>
      <button type="button" data-command="underline" title="Souligné"><u>U</u></button>
      <button type="button" data-command="strikeThrough" title="Barré"><s>S</s></button>
      <button type="button" data-command="insertUnorderedList" title="Liste">•</button>
      <button type="button" data-command="insertOrderedList" title="Liste numérotée">1.</button>
      <span class="rich-editor-separator"></span>
      <button type="button" class="rich-editor-swatch text-red" data-rich-group="color" data-rich-class="mdt-rich-color-red" title="Texte rouge">A</button>
      <button type="button" class="rich-editor-swatch text-orange" data-rich-group="color" data-rich-class="mdt-rich-color-orange" title="Texte orange">A</button>
      <button type="button" class="rich-editor-swatch text-yellow" data-rich-group="color" data-rich-class="mdt-rich-color-yellow" title="Texte jaune">A</button>
      <button type="button" class="rich-editor-swatch text-green" data-rich-group="color" data-rich-class="mdt-rich-color-green" title="Texte vert">A</button>
      <button type="button" class="rich-editor-swatch text-blue" data-rich-group="color" data-rich-class="mdt-rich-color-blue" title="Texte bleu">A</button>
      <button type="button" class="rich-editor-swatch text-purple" data-rich-group="color" data-rich-class="mdt-rich-color-purple" title="Texte violet">A</button>
      <span class="rich-editor-separator"></span>
      <button type="button" class="rich-editor-swatch mark-yellow" data-rich-group="highlight" data-rich-class="mdt-rich-highlight-yellow" title="Surligner jaune">H</button>
      <button type="button" class="rich-editor-swatch mark-green" data-rich-group="highlight" data-rich-class="mdt-rich-highlight-green" title="Surligner vert">H</button>
      <button type="button" class="rich-editor-swatch mark-blue" data-rich-group="highlight" data-rich-class="mdt-rich-highlight-blue" title="Surligner bleu">H</button>
      <button type="button" class="rich-editor-swatch mark-red" data-rich-group="highlight" data-rich-class="mdt-rich-highlight-red" title="Surligner rouge">H</button>
      ${canRedact ? '<button type="button" class="rich-editor-redact" data-rich-group="redaction" data-rich-class="mdt-rich-classified" title="Classer confidentiel / retirer le caviardage"></button>' : ''}
      <button type="button" class="rich-editor-clear" data-rich-group="all" data-rich-class="" title="Retirer couleur, surlignage ou caviardage">⌫</button>
      <span class="rich-editor-spacer"></span>
      ${includeExpand ? '<button type="button" class="rich-editor-expand" title="Agrandir">⛶</button>' : ''}
    `;
    return bar;
  }

  function bindToolbar(bar, textarea, surface) {
    bar.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) event.preventDefault();
    });

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      event.preventDefault();
      activeTextarea = textarea;
      activeEditor = surface;
      surface.focus();

      if (button.classList.contains('rich-editor-expand')) {
        openModal(textarea, surface);
        return;
      }
      if (button.dataset.richGroup) {
        applyRichClass(button.dataset.richClass || '', button.dataset.richGroup);
        return;
      }
      exec(button.dataset.command);
    });
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

    const bar = toolbar(true);
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
    bindToolbar(bar, textarea, surface);
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
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
    return modal;
  }

  function openModal(textarea, sourceEditor) {
    const modal = ensureModal();
    const body = modal.querySelector('.rich-editor-modal-body');
    const title = modal.querySelector('#richEditorModalTitle');
    const label = textarea.closest('label')?.childNodes?.[0]?.textContent?.trim() || 'Édition du rapport';
    title.textContent = label;
    body.innerHTML = '';

    const bar = toolbar(false);
    const surface = document.createElement('div');
    surface.className = 'rich-editor-surface';
    surface.contentEditable = sourceEditor.contentEditable === 'false' ? 'false' : 'true';
    surface.dataset.placeholder = sourceEditor.dataset.placeholder || 'Écrire le contenu du rapport...';
    surface.innerHTML = sourceEditor.innerHTML;
    body.appendChild(bar);
    body.appendChild(surface);

    activeTextarea = textarea;
    activeEditor = surface;
    modal.hidden = false;
    setTimeout(() => surface.focus(), 0);
    surface.addEventListener('input', () => syncTextarea(textarea, surface));
    bindToolbar(bar, textarea, surface);
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
        if (surface && document.activeElement !== surface && surface !== activeEditor) setHtmlIfChanged(surface, normalized);
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
  document.addEventListener('input', (event) => { if (EDITOR_IDS.includes(event.target?.id)) scheduleRefresh(); });
  document.addEventListener('DOMContentLoaded', scheduleRefresh);
  setTimeout(scheduleRefresh, 0);
})();
