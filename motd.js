const motdEditorStylesheet = document.createElement('style');
motdEditorStylesheet.textContent = `
  .mdt-rich-editor {
    min-height: 150px;
    padding: 13px 14px;
    border: 1px solid rgba(154, 168, 189, 0.35);
    border-radius: 10px;
    outline: none;
    color: var(--mdt-text);
    background: rgba(3, 7, 18, 0.75);
    line-height: 1.6;
  }

  .mdt-rich-editor:focus {
    border-color: var(--mdt-accent);
    box-shadow: 0 0 0 3px rgba(47, 128, 237, 0.2);
  }

  .mdt-rich-editor:empty::before {
    content: 'Écrire une annonce...';
    color: var(--mdt-muted);
  }
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
const toolbarButtons = document.querySelectorAll('.mdt-editor-toolbar button');

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

function setMotdMessage(message, type = 'error') {
  if (!motdMessage) return;
  motdMessage.textContent = message;
  motdMessage.dataset.type = type;
}

function isMotdEditing() {
  return Boolean(motdEditor && !motdEditor.hidden);
}

function applyMotdState(motd) {
  if (!motd || isMotdEditing()) return;

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

function focusRichEditor() {
  motdRichEditor.focus();
}

function selectionInsideEditor() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  return motdRichEditor.contains(selection.anchorNode);
}

function selectNodeContents(node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
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

  if (range.collapsed) {
    element.textContent = defaultText;
  } else {
    element.appendChild(range.extractContents());
  }

  range.insertNode(element);
  selectNodeContents(element);
}

function wrapSelectionAsCode() {
  focusRichEditor();
  const selection = window.getSelection();
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.appendChild(code);

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
  focusRichEditor();
  document.execCommand('insertHTML', false, html);
}

function promptAndInsert(type) {
  if (type === 'list') {
    focusRichEditor();
    document.execCommand('insertUnorderedList');
    return;
  }

  if (type === 'url') {
    const url = window.prompt('URL du lien :');
    if (!url) return;
    const label = window.prompt('Texte affiché :') || url;
    insertHtmlAtSelection(`<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
    return;
  }

  if (type === 'image') {
    const url = window.prompt('URL de l’image :');
    if (!url) return;
    insertHtmlAtSelection(`<img class="bbcode-image" src="${escapeAttribute(url)}" alt="Image annonce" loading="lazy">`);
    return;
  }

  if (type === 'file') {
    const url = window.prompt('URL du fichier :');
    if (!url) return;
    const label = window.prompt('Nom affiché du fichier :') || 'Fichier joint';
    insertHtmlAtSelection(`<a class="bbcode-file" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function getNodeText(node) {
  return (node.textContent || '').replace(/\u00a0/g, ' ');
}

function normalizeBbCode(value) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nodeToBbCode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.replace(/\u00a0/g, ' ');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

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
  if (tag === 'ul') return `\n[list]\n${Array.from(node.children).map(nodeToBbCode).join('')}[/list]\n`;
  if (tag === 'ol') return `\n[list]\n${Array.from(node.children).map(nodeToBbCode).join('')}[/list]\n`;
  if (tag === 'li') return `[*]${normalizeBbCode(children)}\n`;

  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    return src ? `[img]${src}[/img]` : '';
  }

  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    if (!href) return children;
    if (node.classList.contains('bbcode-file')) {
      return `[file=${href}]${normalizeBbCode(children) || 'Fichier joint'}[/file]`;
    }
    return `[url=${href}]${normalizeBbCode(children) || href}[/url]`;
  }

  if (tag === 'span') {
    const color = node.style?.color || '';
    const background = node.style?.backgroundColor || '';

    if (background && background !== 'transparent') {
      return `[mark]${children}[/mark]`;
    }

    if (color) {
      return `[color=${color}]${children}[/color]`;
    }
  }

  if (tag === 'div' || tag === 'p') return `${children}\n`;

  return children;
}

function richEditorToBbCode() {
  return normalizeBbCode(Array.from(motdRichEditor.childNodes).map(nodeToBbCode).join(''));
}

function openMotdEditor() {
  if (motdView) motdView.hidden = true;
  if (motdTitleView) motdTitleView.hidden = true;
  if (motdTitle) motdTitle.hidden = false;
  if (motdEditor) motdEditor.hidden = false;
  if (motdEditButton) motdEditButton.hidden = true;
  if (motdSaveButton) motdSaveButton.hidden = false;
  if (motdCancelButton) motdCancelButton.hidden = false;
  if (motdRichEditor) motdRichEditor.innerHTML = motdView?.innerHTML || '';
  setMotdMessage('');
  focusRichEditor();
}

function closeMotdEditor() {
  if (motdView) motdView.hidden = false;
  if (motdTitleView) motdTitleView.hidden = false;
  if (motdTitle) motdTitle.hidden = true;
  if (motdEditor) motdEditor.hidden = true;
  if (motdEditButton) motdEditButton.hidden = false;
  if (motdSaveButton) motdSaveButton.hidden = true;
  if (motdCancelButton) motdCancelButton.hidden = true;
}

if (motdEditButton) {
  motdEditButton.addEventListener('click', openMotdEditor);
}

if (motdCancelButton) {
  motdCancelButton.addEventListener('click', () => {
    if (motdTitle) motdTitle.value = originalTitle;
    if (motdBody) motdBody.value = originalBody;
    if (motdRichEditor) motdRichEditor.innerHTML = originalViewHtml;
    closeMotdEditor();
    setMotdMessage('');
  });
}

toolbarButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const wrap = button.dataset.wrap;
    const insert = button.dataset.insert;

    if (wrap === '[b]|[/b]') return document.execCommand('bold');
    if (wrap === '[i]|[/i]') return document.execCommand('italic');
    if (wrap === '[u]|[/u]') return document.execCommand('underline');
    if (wrap === '[s]|[/s]') return document.execCommand('strikeThrough');
    if (wrap === '[mark]|[/mark]') return wrapSelectionWithElement('mark', 'Texte surligné');
    if (wrap === '[quote]|[/quote]') return wrapSelectionWithElement('blockquote', 'Citation');
    if (wrap === '[code]|[/code]') return wrapSelectionAsCode();

    if (insert) {
      promptAndInsert(insert);
    }
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
      closeMotdEditor();
      setMotdMessage('');
      motdSaveButton.disabled = false;

      if (window.syncDashboardState) {
        window.syncDashboardState(true);
      }
    } catch (error) {
      setMotdMessage('Erreur serveur ou réponse invalide.');
      motdSaveButton.disabled = false;
    }
  });
}
