(() => {
  const REDACTION_CLASS = 'mdt-rich-redacted';
  const LEGACY_REDACTION_CLASS = 'mdt-rich-classified';

  function closestRedaction(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest?.(`span.${REDACTION_CLASS}, span.${LEGACY_REDACTION_CLASS}`) || null;
  }

  function unwrap(span) {
    if (!span?.parentNode) return;
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
    parent.normalize?.();
  }

  function getSurface(button) {
    const toolbar = button.closest('.rich-editor-toolbar');
    const surface = toolbar?.nextElementSibling;
    return surface?.classList?.contains('rich-editor-surface') ? surface : null;
  }

  function getTextarea(button) {
    const shell = button.closest('.rich-editor-shell');
    const modal = button.closest('.rich-editor-modal');
    const sourceId = shell?.dataset?.for || modal?.dataset?.sourceId || '';
    return sourceId ? document.querySelector(`#${sourceId}`) : null;
  }

  function sync(textarea, surface) {
    if (!textarea || !surface) return;
    const value = window.MDTRichText?.toHtml ? window.MDTRichText.toHtml(surface.innerHTML) : surface.innerHTML;
    if (textarea.value !== value) {
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
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

    surface.querySelectorAll(`span.${REDACTION_CLASS}, span.${LEGACY_REDACTION_CLASS}`).forEach((span) => {
      try {
        if (range.intersectsNode(span)) spans.add(span);
      } catch {
        // Ignore detached / invalid nodes.
      }
    });

    return spans;
  }

  function cleanRedaction(fragment) {
    fragment.querySelectorAll?.(`span.${REDACTION_CLASS}, span.${LEGACY_REDACTION_CLASS}`).forEach(unwrap);
  }

  function applyRedaction(range) {
    const fragment = range.extractContents();
    cleanRedaction(fragment);

    const span = document.createElement('span');
    span.className = REDACTION_CLASS;
    span.appendChild(fragment);
    range.insertNode(span);

    const selection = window.getSelection();
    selection.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(span);
    after.collapse(false);
    selection.addRange(after);
  }

  function toggleRedaction(button) {
    const surface = getSurface(button);
    if (!surface || surface.contentEditable === 'false') return;

    const textarea = getTextarea(button);
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) return;

    if (selection.isCollapsed) {
      const span = closestRedaction(range.startContainer);
      if (span) {
        unwrap(span);
        sync(textarea, surface);
      }
      return;
    }

    const shouldRemove = fragmentFullyRedacted(range.cloneContents());
    if (shouldRemove) {
      touchedRedactionSpans(surface, range).forEach(unwrap);
    } else {
      applyRedaction(range);
    }

    sync(textarea, surface);
  }

  window.addEventListener('click', (event) => {
    const button = event.target.closest('.rich-editor-redact, [data-rich-group="redaction"]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    toggleRedaction(button);
  }, true);
})();
