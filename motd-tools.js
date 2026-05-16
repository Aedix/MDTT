(() => {
  const googleFonts = document.createElement('link');
  googleFonts.rel = 'stylesheet';
  googleFonts.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@400;600;700&family=Bebas+Neue&family=Exo+2:wght@400;600;700&family=Fira+Code:wght@400;600&family=Inter:wght@400;600;800&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700;800&family=Nunito:wght@400;700;800&family=Orbitron:wght@400;700&family=Oswald:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;800&family=Rajdhani:wght@400;600;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Source+Code+Pro:wght@400;600&family=Teko:wght@400;600;700&display=swap';
  document.head.appendChild(googleFonts);

  const style = document.createElement('style');
  style.textContent = `
    .motd-color-input.is-hidden,
    .motd-font-select.is-hidden,
    .motd-apply-style-button.is-hidden { display: none !important; }
    .motd-style-group { display: inline-flex; align-items: stretch; gap: 0; border: 1px solid rgba(154,168,189,.22); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.065); }
    .motd-style-group input[type="color"] { width: 38px; min-height: 34px; padding: 2px; border: 0; border-radius: 0; background: transparent; cursor: pointer; }
    .motd-style-group button { min-height: 34px; padding: 0 10px; border: 0; border-left: 1px solid rgba(154,168,189,.18); color: #fff; background: rgba(47,128,237,.22); font-weight: 900; cursor: pointer; }
    .motd-style-group button:hover { background: rgba(47,128,237,.38); }
    .motd-font-library { min-height: 34px; min-width: 190px; max-width: 230px; padding: 7px 8px; border: 1px solid rgba(154,168,189,.22); border-radius: 10px; color: var(--mdt-text); background: rgba(255,255,255,.065); font-weight: 800; }
    .motd-file-input { display: none; }
  `;
  document.head.appendChild(style);

  const toolbar = document.querySelector('.mdt-editor-toolbar');
  const editor = document.querySelector('#motdRichEditor');

  if (!toolbar || !editor || toolbar.dataset.toolsEnhanced === '1') return;
  toolbar.dataset.toolsEnhanced = '1';

  let savedRange = null;

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;
    savedRange = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editor.focus();
    if (!savedRange) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function wrapSelectionWithSpan(styleObject, fallbackText) {
    restoreSelection();
    const selection = window.getSelection();
    const span = document.createElement('span');
    Object.assign(span.style, styleObject);

    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode) || selection.getRangeAt(0).collapsed) {
      span.textContent = fallbackText;
      editor.appendChild(span);
      return;
    }

    const range = selection.getRangeAt(0);
    span.appendChild(range.extractContents());
    range.insertNode(span);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    saveSelection();
  }

  function insertHtml(html) {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    editor.querySelectorAll('img').forEach((img) => {
      img.classList.add('is-draggable');
      img.draggable = true;
    });
    saveSelection();
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

  document.addEventListener('selectionchange', saveSelection);
  editor.addEventListener('keyup', saveSelection);
  editor.addEventListener('mouseup', saveSelection);

  toolbar.querySelectorAll('.motd-color-input, .motd-font-select, .motd-apply-style-button').forEach((element) => {
    element.classList.add('is-hidden');
  });

  function createColorGroup({ label, value, title, onApply }) {
    const group = document.createElement('span');
    group.className = 'motd-style-group';
    group.title = title;

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.setAttribute('aria-label', title);
    input.addEventListener('mousedown', saveSelection);
    input.addEventListener('focus', saveSelection);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => onApply(input.value));

    group.append(input, button);
    return group;
  }

  const textColorGroup = createColorGroup({
    label: '✓',
    value: '#ffffff',
    title: 'Choisir puis appliquer la couleur du texte',
    onApply: (color) => wrapSelectionWithSpan({ color }, 'Texte coloré'),
  });

  const highlightColorGroup = createColorGroup({
    label: '✓',
    value: '#f5c542',
    title: 'Choisir puis appliquer la couleur de surlignement',
    onApply: (color) => wrapSelectionWithSpan({ backgroundColor: color, color: '#111827', padding: '1px 4px', borderRadius: '4px' }, 'Texte surligné'),
  });

  const fontSelect = document.createElement('select');
  fontSelect.className = 'motd-font-library';
  fontSelect.title = 'Bibliothèque de polices';
  const fonts = [
    'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato', 'Nunito', 'Raleway',
    'Oswald', 'Bebas Neue', 'Anton', 'Teko', 'Barlow Condensed',
    'Rajdhani', 'Orbitron', 'Exo 2', 'Merriweather', 'Playfair Display',
    'Source Code Pro', 'Fira Code', 'Arial', 'Verdana', 'Georgia',
    'Times New Roman', 'Courier New', 'Trebuchet MS'
  ];
  fonts.forEach((font) => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    option.style.fontFamily = font;
    fontSelect.appendChild(option);
  });
  fontSelect.addEventListener('mousedown', saveSelection);
  fontSelect.addEventListener('focus', saveSelection);

  const applyFont = document.createElement('button');
  applyFont.type = 'button';
  applyFont.className = 'motd-apply-style-button';
  applyFont.textContent = 'Police ✓';
  applyFont.addEventListener('mousedown', (event) => event.preventDefault());
  applyFont.addEventListener('click', () => wrapSelectionWithSpan({ fontFamily: fontSelect.value }, 'Texte'));

  toolbar.append(textColorGroup, highlightColorGroup, fontSelect, applyFont);

  async function uploadSelectedFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-motd-file.php', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Upload impossible.');
    }

    return result;
  }

  function openUploadPicker({ imageOnly }) {
    saveSelection();
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'motd-file-input';
    input.accept = imageOnly ? 'image/png,image/jpeg,image/webp,image/gif' : '.pdf,.txt,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp,image/gif';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await uploadSelectedFile(file);
        if (result.is_image) {
          insertHtml(`<img class="bbcode-image is-draggable" src="${escapeAttribute(result.url)}" alt="${escapeAttribute(result.name)}" loading="lazy" draggable="true">`);
        } else {
          insertHtml(`<a class="bbcode-file" href="${escapeAttribute(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.name)}</a>`);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        input.remove();
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  function handleExternalInsert(type) {
    saveSelection();
    const choice = window.prompt(type === 'image'
      ? 'Image : tape 1 pour URL, 2 pour fichier local'
      : 'Fichier : tape 1 pour URL, 2 pour fichier local');

    if (choice === '2') {
      openUploadPicker({ imageOnly: type === 'image' });
      return;
    }

    if (choice !== '1') return;

    const url = window.prompt(type === 'image' ? 'URL de l’image :' : 'URL du fichier :');
    if (!url) return;

    if (type === 'image') {
      insertHtml(`<img class="bbcode-image is-draggable" src="${escapeAttribute(url)}" alt="Image annonce" loading="lazy" draggable="true">`);
      return;
    }

    const label = window.prompt('Nom affiché du fichier :') || 'Fichier joint';
    insertHtml(`<a class="bbcode-file" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  }

  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-insert]');
    if (!button) return;
    const insertType = button.dataset.insert;
    if (insertType !== 'image' && insertType !== 'file') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleExternalInsert(insertType);
  }, true);
})();
