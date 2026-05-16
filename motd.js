const motdEditorStylesheet = document.createElement('style');
motdEditorStylesheet.textContent = `
  .mdt-rich-editor { min-height: 150px; padding: 13px 14px; border: 1px solid rgba(154,168,189,.35); border-radius: 10px; outline: none; color: var(--mdt-text); background: rgba(3,7,18,.75); line-height: 1.6; }
  .mdt-rich-editor:focus { border-color: var(--mdt-accent); box-shadow: 0 0 0 3px rgba(47,128,237,.2); }
  .mdt-rich-editor:empty::before { content: 'Écrire une annonce...'; color: var(--mdt-muted); }
  .mdt-editor-toolbar button.is-active { border-color: rgba(47,128,237,.7); background: rgba(47,128,237,.32); color: #fff; }
  .mdt-editor-toolbar .motd-color-input { width: 34px; min-height: 34px; padding: 2px; border: 1px solid rgba(154,168,189,.22); border-radius: 9px; background: rgba(255,255,255,.065); cursor: pointer; }
  .mdt-editor-toolbar .motd-font-select { min-height: 34px; max-width: 150px; padding: 7px 8px; border: 1px solid rgba(154,168,189,.22); border-radius: 9px; color: var(--mdt-text); background: rgba(255,255,255,.065); font-weight: 800; }
  .mdt-editor-toolbar .motd-apply-style-button { min-height: 34px; padding: 7px 10px; border: 1px solid rgba(47,128,237,.38); border-radius: 9px; color: #fff; background: rgba(47,128,237,.18); font-weight: 900; }
  .mdt-editor-toolbar .motd-apply-style-button:hover { background: rgba(47,128,237,.32); }
  .mdt-motd-card.is-locked { outline: 1px solid rgba(245,197,66,.5); box-shadow: 0 0 0 3px rgba(245,197,66,.08), 0 18px 50px rgba(0,0,0,.22); }
  .motd-lock-badge { padding: 8px 11px; border: 1px solid rgba(245,197,66,.4); border-radius: 999px; color: var(--mdt-warning); background: rgba(245,197,66,.09); font-size: .82rem; font-weight: 800; white-space: nowrap; }
  .bbcode-image.is-draggable { cursor: grab; }
  .bbcode-image.is-dragging { opacity: .45; cursor: grabbing; }
`;
document.head.appendChild(motdEditorStylesheet);

const motdEditButton = document.querySelector('#motdEditButton');
const motdSaveButton = document.querySelector('#motdSaveButton');
const motdCancelButton = document.querySelector('#motdCancelButton');
const motdMessage = document.querySelector('#motdMessage');
const motdView = document.querySelector('#motdView');
const motdTitleView = document.querySelector('#motdTitleView');
const motdTitle = document.querySelector('#motdTitle');
const motdBody = document.querySelector('#motdBody');
const motdEditor = document.querySelector('#motdEditor');
const motdToolbar = document.querySelector('.mdt-editor-toolbar');
const motdCard = document.querySelector('.mdt-motd-card');

const motdRichEditor = document.createElement('div');
motdRichEditor.id = 'motdRichEditor';
motdRichEditor.className = 'mdt-rich-editor bbcode-content';
motdRichEditor.contentEditable = 'true';
motdRichEditor.spellcheck = true;
motdRichEditor.setAttribute('role', 'textbox');
motdRichEditor.setAttribute('aria-label', 'Éditeur visuel de l’annonce');

if (motdBody && motdBody.parentNode) {
  motdBody.hidden = true;
  motdBody.after(motdRichEditor);
}

let originalTitle = motdTitle?.value || '';
let originalBody = motdBody?.value || '';
let originalViewHtml = motdView?.innerHTML || '';
let motdLockHeartbeat = null;
let motdLockedByOther = false;
let currentMotdLockUser = null;
let savedEditorRange = null;

function setMotdMessage(message, type = 'error') {
  if (!motdMessage) return;
  motdMessage.textContent = message;
  motdMessage.dataset.type = type;
}

function isMotdEditing() {
  return Boolean(motdEditor && !motdEditor.hidden);
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  if (!motdRichEditor.contains(selection.anchorNode)) return;
  savedEditorRange = selection.getRangeAt(0).cloneRange();
}

function restoreEditorSelection() {
  focusRichEditor();
  if (!savedEditorRange) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}

function setMotdLockVisual(lock) {
  const existingBadge = document.querySelector('#motdLockBadge');
  const lockedByOther = Boolean(lock?.is_locked && !lock?.is_locked_by_me);
  motdLockedByOther = lockedByOther;
  currentMotdLockUser = lock?.username || null;
  motdCard?.classList.toggle('is-locked', lockedByOther);

  if (lockedByOther) {
    if (!existingBadge) {
      const badge = document.createElement('span');
      badge.id = 'motdLockBadge';
      badge.className = 'motd-lock-badge';
      document.querySelector('.mdt-motd-actions')?.prepend(badge);
    }
    document.querySelector('#motdLockBadge').textContent = `Modification en cours par ${currentMotdLockUser}`;
    if (motdEditButton) motdEditButton.disabled = true;
  } else {
    existingBadge?.remove();
    if (motdEditButton) motdEditButton.disabled = false;
  }
}

function applyMotdState(motd) {
  if (!motd) return;
  setMotdLockVisual(motd.lock);
  if (isMotdEditing()) return;

  if (motdTitleView) motdTitleView.textContent = motd.title || 'Annonce opérationnelle';
  if (motdTitle) motdTitle.value = motd.title || '';
  if (motdBody) motdBody.value = motd.body_raw || '';
  if (motdView) motdView.innerHTML = motd.body_html || '';
  if (motdRichEditor) motdRichEditor.innerHTML = motd.body_html || '';

  const timecode = document.querySelector('.mdt-motd-actions .mdt-timecode');
  if (timecode) timecode.textContent = motd.updated_label || 'Jamais mis à jour';

  originalTitle = motdTitle?.value || '';
  originalBody = motdBody?.value || '';
  originalViewHtml = motdView?.innerHTML || '';
}

window.applyMotdState = applyMotdState;
window.isMotdEditing = isMotdEditing;

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function focusRichEditor() { motdRichEditor.focus(); }

function selectionInsideEditor() {
  const selection = window.getSelection();
  return Boolean(selection && selection.rangeCount > 0 && motdRichEditor.contains(selection.anchorNode));
}

function selectNodeContents(node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  saveEditorSelection();
}

function wrapSelectionWithElement(tagName, defaultText = 'Texte') {
  focusRichEditor();
  const selection = window.getSelection();
  const element = document.createElement(tagName);

  if (!selection || selection.rangeCount === 0 || !selectionInsideEditor()) {
    element.textContent = defaultText;
    motdRichEditor.appendChild(element);
    selectNodeContents(element);
    return;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) element.textContent = defaultText;
  else element.appendChild(range.extractContents());
  range.insertNode(element);
  selectNodeContents(element);
}

function wrapSelectionWithSpan(style, defaultText = 'Texte') {
  restoreEditorSelection();
  const selection = window.getSelection();
  const span = document.createElement('span');
  Object.assign(span.style, style);

  if (!selection || selection.rangeCount === 0 || !selectionInsideEditor() || selection.getRangeAt(0).collapsed) {
    span.textContent = defaultText;
    motdRichEditor.appendChild(span);
    selectNodeContents(span);
    return;
  }

  const range = selection.getRangeAt(0);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  selectNodeContents(span);
}

function wrapSelectionAsCode() {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.appendChild(code);
  focusRichEditor();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selectionInsideEditor() || selection.getRangeAt(0).collapsed) {
    code.textContent = 'Code';
    motdRichEditor.appendChild(pre);
    selectNodeContents(code);
    return;
  }
  const range = selection.getRangeAt(0);
  code.appendChild(range.extractContents());
  range.insertNode(pre);
  selectNodeContents(code);
}

function insertHtmlAtSelection(html) {
  restoreEditorSelection();
  document.execCommand('insertHTML', false, html);
  makeImagesDraggable();
}

function promptAndInsert(type) {
  if (type === 'list') return document.execCommand('insertUnorderedList');
  if (type === 'url') {
    const url = window.prompt('URL du lien :');
    if (!url) return;
    const label = window.prompt('Texte affiché :') || url;
    return insertHtmlAtSelection(`<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  }
  if (type === 'image') {
    const url = window.prompt('URL de l’image :');
    if (!url) return;
    return insertHtmlAtSelection(`<img class="bbcode-image is-draggable" src="${escapeAttribute(url)}" alt="Image annonce" loading="lazy" draggable="true">`);
  }
  if (type === 'file') {
    const url = window.prompt('URL du fichier :');
    if (!url) return;
    const label = window.prompt('Nom affiché du fichier :') || 'Fichier joint';
    return insertHtmlAtSelection(`<a class="bbcode-file" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  }
}

function normalizeBbCode(value) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getNodeText(node) { return (node.textContent || '').replace(/\u00a0/g, ' '); }

function nodeToBbCode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\u00a0/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes).map(nodeToBbCode).join('');

  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return `[b]${children}[/b]`;
  if (tag === 'em' || tag === 'i') return `[i]${children}[/i]`;
  if (tag === 'u') return `[u]${children}[/u]`;
  if (tag === 's' || tag === 'strike') return `[s]${children}[/s]`;
  if (tag === 'mark') return `[mark]${children}[/mark]`;
  if (tag === 'blockquote') return `\n[quote]${normalizeBbCode(children)}[/quote]\n`;
  if (tag === 'pre') return `\n[code]${getNodeText(node)}[/code]\n`;
  if (tag === 'code') return `[code]${getNodeText(node)}[/code]`;
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return `\n[h1]${normalizeBbCode(children)}[/h1]\n`;
  if (tag === 'h4') return `\n[h2]${normalizeBbCode(children)}[/h2]\n`;
  if (tag === 'ul' || tag === 'ol') return `\n[list]\n${Array.from(node.children).map(nodeToBbCode).join('')}[/list]\n`;
  if (tag === 'li') return `[*]${normalizeBbCode(children)}\n`;
  if (tag === 'img') return node.getAttribute('src') ? `[img]${node.getAttribute('src')}[/img]` : '';
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    if (!href) return children;
    if (node.classList.contains('bbcode-file')) return `[file=${href}]${normalizeBbCode(children) || 'Fichier joint'}[/file]`;
    return `[url=${href}]${normalizeBbCode(children) || href}[/url]`;
  }
  if (tag === 'font') {
    const face = node.getAttribute('face') || '';
    const color = node.getAttribute('color') || '';
    let value = children;
    if (face) value = `[font=${face}]${value}[/font]`;
    if (color) value = `[color=${color}]${value}[/color]`;
    return value;
  }
  if (tag === 'span') {
    const color = node.style?.color || '';
    const background = node.style?.backgroundColor || '';
    const fontFamily = node.style?.fontFamily || '';
    let value = children;
    if (fontFamily) value = `[font=${fontFamily.replaceAll('"', '')}]${value}[/font]`;
    if (background && background !== 'transparent') value = `[highlight=${background}]${value}[/highlight]`;
    if (color) value = `[color=${color}]${value}[/color]`;
    return value;
  }
  if (tag === 'div' || tag === 'p') return `${children}\n`;
  return children;
}

function richEditorToBbCode() {
  return normalizeBbCode(Array.from(motdRichEditor.childNodes).map(nodeToBbCode).join(''));
}

function makeImagesDraggable() {
  motdRichEditor.querySelectorAll('img').forEach((img) => {
    img.classList.add('is-draggable');
    img.draggable = true;
  });
}

let draggedImage = null;
motdRichEditor.addEventListener('dragstart', (event) => {
  if (event.target?.tagName?.toLowerCase() !== 'img') return;
  draggedImage = event.target;
  draggedImage.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
});

motdRichEditor.addEventListener('dragover', (event) => {
  if (!draggedImage) return;
  event.preventDefault();
  const target = event.target.closest('img, p, div, blockquote, li, span, strong, em, u, s') || motdRichEditor;
  if (target === draggedImage) return;
  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  target.parentNode.insertBefore(draggedImage, before ? target : target.nextSibling);
});

motdRichEditor.addEventListener('dragend', () => {
  draggedImage?.classList.remove('is-dragging');
  draggedImage = null;
});

function updateToolbarActiveStates() {
  if (!isMotdEditing()) return;
  const states = {
    '[b]|[/b]': document.queryCommandState('bold'),
    '[i]|[/i]': document.queryCommandState('italic'),
    '[u]|[/u]': document.queryCommandState('underline'),
    '[s]|[/s]': document.queryCommandState('strikeThrough'),
  };

  document.querySelectorAll('.mdt-editor-toolbar button[data-wrap]').forEach((button) => {
    button.classList.toggle('is-active', Boolean(states[button.dataset.wrap]));
  });
}

document.addEventListener('selectionchange', () => {
  saveEditorSelection();
  updateToolbarActiveStates();
});
motdRichEditor.addEventListener('keyup', () => {
  saveEditorSelection();
  updateToolbarActiveStates();
});
motdRichEditor.addEventListener('mouseup', () => {
  saveEditorSelection();
  updateToolbarActiveStates();
});

function addAdvancedToolbarControls() {
  if (!motdToolbar || motdToolbar.dataset.advanced === '1') return;
  motdToolbar.dataset.advanced = '1';

  const textColor = document.createElement('input');
  textColor.type = 'color';
  textColor.value = '#ffffff';
  textColor.title = 'Choisir la couleur du texte';
  textColor.className = 'motd-color-input';
  textColor.addEventListener('mousedown', saveEditorSelection);
  textColor.addEventListener('focus', saveEditorSelection);

  const applyTextColor = document.createElement('button');
  applyTextColor.type = 'button';
  applyTextColor.className = 'motd-apply-style-button';
  applyTextColor.textContent = 'Texte ✓';
  applyTextColor.title = 'Appliquer la couleur du texte sélectionnée';
  applyTextColor.addEventListener('mousedown', (event) => event.preventDefault());
  applyTextColor.addEventListener('click', () => wrapSelectionWithSpan({ color: textColor.value }, 'Texte coloré'));

  const highlightColor = document.createElement('input');
  highlightColor.type = 'color';
  highlightColor.value = '#f5c542';
  highlightColor.title = 'Choisir la couleur de surlignement';
  highlightColor.className = 'motd-color-input';
  highlightColor.addEventListener('mousedown', saveEditorSelection);
  highlightColor.addEventListener('focus', saveEditorSelection);

  const applyHighlightColor = document.createElement('button');
  applyHighlightColor.type = 'button';
  applyHighlightColor.className = 'motd-apply-style-button';
  applyHighlightColor.textContent = 'Surligner ✓';
  applyHighlightColor.title = 'Appliquer la couleur de surlignement sélectionnée';
  applyHighlightColor.addEventListener('mousedown', (event) => event.preventDefault());
  applyHighlightColor.addEventListener('click', () => wrapSelectionWithSpan({ backgroundColor: highlightColor.value, color: '#111827', padding: '1px 4px', borderRadius: '4px' }, 'Texte surligné'));

  const fontSelect = document.createElement('select');
  fontSelect.className = 'motd-font-select';
  fontSelect.title = 'Choisir la police du texte';
  ['Inter', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS'].forEach((font) => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    fontSelect.appendChild(option);
  });
  fontSelect.addEventListener('mousedown', saveEditorSelection);
  fontSelect.addEventListener('focus', saveEditorSelection);

  const applyFont = document.createElement('button');
  applyFont.type = 'button';
  applyFont.className = 'motd-apply-style-button';
  applyFont.textContent = 'Police ✓';
  applyFont.title = 'Appliquer la police sélectionnée';
  applyFont.addEventListener('mousedown', (event) => event.preventDefault());
  applyFont.addEventListener('click', () => wrapSelectionWithSpan({ fontFamily: fontSelect.value }, 'Texte'));

  motdToolbar.append(textColor, applyTextColor, highlightColor, applyHighlightColor, fontSelect, applyFont);
}

addAdvancedToolbarControls();

async function requestMotdLock(action) {
  const response = await fetch('/api/motd-lock.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action }),
  });
  const result = await response.json();
  if (response.ok && result.success) setMotdLockVisual(result.lock);
  return result;
}

function startMotdHeartbeat() {
  stopMotdHeartbeat();
  motdLockHeartbeat = window.setInterval(() => requestMotdLock('heartbeat'), 15000);
}

function stopMotdHeartbeat() {
  if (motdLockHeartbeat) window.clearInterval(motdLockHeartbeat);
  motdLockHeartbeat = null;
}

function openMotdEditor() {
  if (motdLockedByOther) {
    setMotdMessage(`Annonce déjà en modification par ${currentMotdLockUser}.`, 'error');
    return;
  }
  if (motdView) motdView.hidden = true;
  if (motdTitleView) motdTitleView.hidden = true;
  if (motdTitle) motdTitle.hidden = false;
  if (motdEditor) motdEditor.hidden = false;
  if (motdEditButton) motdEditButton.hidden = true;
  if (motdSaveButton) motdSaveButton.hidden = false;
  if (motdCancelButton) motdCancelButton.hidden = false;
  motdRichEditor.innerHTML = motdView?.innerHTML || '';
  makeImagesDraggable();
  setMotdMessage('');
  focusRichEditor();
  saveEditorSelection();
}

async function closeMotdEditor(releaseLock = true) {
  if (motdView) motdView.hidden = false;
  if (motdTitleView) motdTitleView.hidden = false;
  if (motdTitle) motdTitle.hidden = true;
  if (motdEditor) motdEditor.hidden = true;
  if (motdEditButton) motdEditButton.hidden = false;
  if (motdSaveButton) motdSaveButton.hidden = true;
  if (motdCancelButton) motdCancelButton.hidden = true;
  savedEditorRange = null;
  stopMotdHeartbeat();
  if (releaseLock) await requestMotdLock('release');
}

if (motdEditButton) {
  motdEditButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = await requestMotdLock('acquire');
    if (!result.success || result.lock?.is_locked_by_me === false) {
      setMotdMessage(result.lock?.username ? `Annonce déjà en modification par ${result.lock.username}.` : 'Édition impossible pour le moment.');
      return;
    }
    startMotdHeartbeat();
    openMotdEditor();
  }, true);
}

if (motdCancelButton) {
  motdCancelButton.addEventListener('click', async () => {
    if (motdTitle) motdTitle.value = originalTitle;
    if (motdBody) motdBody.value = originalBody;
    motdRichEditor.innerHTML = originalViewHtml;
    await closeMotdEditor(true);
    setMotdMessage('');
  });
}

motdToolbar?.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => {
    const wrap = button.dataset.wrap;
    const insert = button.dataset.insert;
    if (wrap === '[b]|[/b]') document.execCommand('bold');
    else if (wrap === '[i]|[/i]') document.execCommand('italic');
    else if (wrap === '[u]|[/u]') document.execCommand('underline');
    else if (wrap === '[s]|[/s]') document.execCommand('strikeThrough');
    else if (wrap === '[mark]|[/mark]') wrapSelectionWithElement('mark', 'Texte surligné');
    else if (wrap === '[quote]|[/quote]') wrapSelectionWithElement('blockquote', 'Citation');
    else if (wrap === '[code]|[/code]') wrapSelectionAsCode();
    else if (insert) promptAndInsert(insert);
    updateToolbarActiveStates();
    saveEditorSelection();
  });
});

if (motdSaveButton) {
  motdSaveButton.addEventListener('click', async () => {
    const title = motdTitle?.value.trim() || '';
    const body = richEditorToBbCode();
    if (motdBody) motdBody.value = body;

    setMotdMessage('Mise à jour de l’annonce...', 'info');
    motdSaveButton.disabled = true;

    try {
      const response = await fetch('/api/update-motd.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, body })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setMotdMessage(result.message || 'Mise à jour refusée.');
        motdSaveButton.disabled = false;
        return;
      }

      originalTitle = title;
      originalBody = body;
      originalViewHtml = motdRichEditor.innerHTML;
      await closeMotdEditor(true);
      setMotdMessage('');
      motdSaveButton.disabled = false;
      if (window.syncDashboardState) window.syncDashboardState(true);
    } catch (error) {
      setMotdMessage('Erreur serveur ou réponse invalide.');
      motdSaveButton.disabled = false;
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (isMotdEditing()) {
    navigator.sendBeacon?.('/api/motd-lock.php', JSON.stringify({ action: 'release' }));
  }
});
