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
    .motd-file-input { display: none; }

    .motd-style-picker { position: relative; display: inline-flex; }
    .motd-style-trigger { min-height: 34px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid rgba(154,168,189,.22); border-radius: 10px; color: #fff; background: rgba(255,255,255,.065); font-weight: 900; cursor: pointer; }
    .motd-style-trigger:hover,
    .motd-style-trigger.is-open { border-color: rgba(47,128,237,.6); background: rgba(47,128,237,.18); }
    .motd-style-swatch { width: 18px; height: 18px; border-radius: 5px; border: 1px solid rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(0,0,0,.2); }

    .motd-color-panel { position: absolute; top: calc(100% + 8px); left: 0; z-index: 100; width: 246px; padding: 12px; border: 1px solid rgba(154,168,189,.26); border-radius: 14px; background: rgba(10,16,28,.98); box-shadow: 0 18px 55px rgba(0,0,0,.45); }
    .motd-color-panel[hidden] { display: none !important; }
    .motd-color-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .motd-color-panel-title { color: var(--mdt-text); font-size: .78rem; font-weight: 900; letter-spacing: .8px; text-transform: uppercase; }
    .motd-color-panel-preview { width: 28px; height: 28px; border: 1px solid rgba(255,255,255,.45); border-radius: 8px; }
    .motd-color-native { width: 100%; height: 52px; padding: 0; border: 1px solid rgba(154,168,189,.24); border-radius: 10px; background: transparent; cursor: pointer; }
    .motd-color-presets { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin: 10px 0; }
    .motd-color-preset { width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.32); border-radius: 7px; cursor: pointer; }
    .motd-color-preset:hover { transform: translateY(-1px); border-color: #fff; }
    .motd-color-fields { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
    .motd-color-hex { min-height: 34px; padding: 7px 9px; border: 1px solid rgba(154,168,189,.24); border-radius: 9px; color: #fff; background: rgba(3,7,18,.72); font-weight: 800; }
    .motd-color-apply { min-height: 34px; padding: 7px 11px; border: 1px solid rgba(47,128,237,.55); border-radius: 9px; color: #fff; background: rgba(47,128,237,.32); font-weight: 900; cursor: pointer; }
    .motd-color-apply:hover { background: rgba(47,128,237,.48); }

    .motd-font-library { min-height: 34px; min-width: 205px; max-width: 245px; padding: 7px 8px; border: 1px solid rgba(154,168,189,.22); border-radius: 10px; color: #f8fafc; background: #111827; font-weight: 800; }
    .motd-font-library option { color: #111827; background: #ffffff; font-weight: 700; }
    .motd-apply-style-button { min-height: 34px; padding: 7px 10px; border: 1px solid rgba(47,128,237,.38); border-radius: 10px; color: #fff; background: rgba(47,128,237,.18); font-weight: 900; cursor: pointer; }
    .motd-apply-style-button:hover { background: rgba(47,128,237,.32); }
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

  function closeOtherColorPanels(exceptPanel = null) {
    document.querySelectorAll('.motd-color-panel').forEach((panel) => {
      if (panel !== exceptPanel) panel.hidden = true;
    });
    document.querySelectorAll('.motd-style-trigger').forEach((button) => {
      if (!exceptPanel || !button.closest('.motd-style-picker')?.contains(exceptPanel)) {
        button.classList.remove('is-open');
      }
    });
  }

  function normalizeHex(value, fallback) {
    const cleaned = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned;
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned}`;
    return fallback;
  }

  function createColorPicker({ label, value, title, onApply }) {
    const picker = document.createElement('span');
    picker.className = 'motd-style-picker';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'motd-style-trigger';
    trigger.title = title;

    const swatch = document.createElement('span');
    swatch.className = 'motd-style-swatch';
    swatch.style.backgroundColor = value;

    const text = document.createElement('span');
    text.textContent = label;
    trigger.append(swatch, text);

    const panel = document.createElement('div');
    panel.className = 'motd-color-panel';
    panel.hidden = true;

    const header = document.createElement('div');
    header.className = 'motd-color-panel-header';
    const titleElement = document.createElement('span');
    titleElement.className = 'motd-color-panel-title';
    titleElement.textContent = title;
    const preview = document.createElement('span');
    preview.className = 'motd-color-panel-preview';
    preview.style.backgroundColor = value;
    header.append(titleElement, preview);

    const nativePicker = document.createElement('input');
    nativePicker.type = 'color';
    nativePicker.className = 'motd-color-native';
    nativePicker.value = value;

    const presets = document.createElement('div');
    presets.className = 'motd-color-presets';
    ['#ffffff', '#94a3b8', '#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f5c542', '#38bdf8', '#10b981', '#f87171'].forEach((color) => {
      const preset = document.createElement('button');
      preset.type = 'button';
      preset.className = 'motd-color-preset';
      preset.style.backgroundColor = color;
      preset.title = color;
      preset.addEventListener('click', () => setColor(color));
      presets.appendChild(preset);
    });

    const fields = document.createElement('div');
    fields.className = 'motd-color-fields';
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'motd-color-hex';
    hexInput.value = value;
    hexInput.maxLength = 7;
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'motd-color-apply';
    applyButton.textContent = 'Appliquer ✓';
    fields.append(hexInput, applyButton);

    function setColor(color) {
      const normalized = normalizeHex(color, nativePicker.value);
      nativePicker.value = normalized;
      hexInput.value = normalized;
      preview.style.backgroundColor = normalized;
      swatch.style.backgroundColor = normalized;
    }

    nativePicker.addEventListener('input', () => setColor(nativePicker.value));
    hexInput.addEventListener('input', () => setColor(hexInput.value));
    applyButton.addEventListener('mousedown', (event) => event.preventDefault());
    applyButton.addEventListener('click', () => {
      const color = normalizeHex(hexInput.value, nativePicker.value);
      setColor(color);
      onApply(color);
      panel.hidden = true;
      trigger.classList.remove('is-open');
    });

    trigger.addEventListener('mousedown', saveSelection);
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      saveSelection();
      const willOpen = panel.hidden;
      closeOtherColorPanels(panel);
      panel.hidden = !willOpen;
      trigger.classList.toggle('is-open', willOpen);
    });

    panel.addEventListener('mousedown', saveSelection);
    panel.append(header, nativePicker, presets, fields);
    picker.append(trigger, panel);
    return picker;
  }

  const textColorPicker = createColorPicker({
    label: 'Texte',
    value: '#ffffff',
    title: 'Couleur texte',
    onApply: (color) => wrapSelectionWithSpan({ color }, 'Texte coloré'),
  });

  const highlightColorPicker = createColorPicker({
    label: 'Surlignage',
    value: '#f5c542',
    title: 'Surlignage',
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

  toolbar.append(textColorPicker, highlightColorPicker, fontSelect, applyFont);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.motd-style-picker')) {
      closeOtherColorPanels();
    }
  });

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
