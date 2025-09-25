
(function () {
  const qs = new URLSearchParams(location.search);
  const src = qs.get('src');
  const $content = document.getElementById('content');
  const $fileName = document.getElementById('fileName');
  const $sourceLink = document.getElementById('sourceLink');
  const $toggleTheme = document.getElementById('toggleTheme');
  const $copyMD = document.getElementById('copyMD');
  const $exportHTML = document.getElementById('exportHTML');
  const $menuTOC = document.getElementById('menuTOC');
  const $toc = document.getElementById('toc');
  const $searchBox = document.getElementById('searchBox');
  const $prevHit = document.getElementById('prevHit');
  const $nextHit = document.getElementById('nextHit');
  const $clearSearch = document.getElementById('clearSearch');

  let rawMD = '';
  let searchHits = [];
  let currentHit = -1;

  const escapeHTML = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getNameFromURL = (u) => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop() || u); } catch { return u; } };

  const setSourceUI = () => {
    $fileName.textContent = getNameFromURL(src || '');
    if (src) {
      const a = document.createElement('a');
      a.href = src; a.textContent = src; a.target = "_blank"; a.rel = "noopener noreferrer";
      $sourceLink.innerHTML = ' — <span>Source: </span>';
      $sourceLink.appendChild(a);
    }
  };

  function slugify(t){ return (t||'').toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').slice(0,80); }
  function colAlign(s){
    if (!s) return '';
    const left = /^:-+$/.test(s), right = /^-+:$/.test(s), center = /^:-+:$/.test(s);
    if (center) return ' style="text-align:center"';
    if (right)  return ' style="text-align:right"';
    if (left)   return ' style="text-align:left"';
    return '';
  }

  function mdToHtml(md) {
    md = md.replace(/\r\n?/g, '\n');

    const mermaidStarters = [
      'sequenceDiagram',
      'classDiagram',
      'stateDiagram-v2',
      'stateDiagram',
      'erDiagram',
      'journey',
      'gantt',
      'pie',
      'gitGraph',
      'mindmap',
      'timeline',
      'graph'
    ];
    const mermaidBodyPattern = /--|->|participant|autonumber|alt\b|else\b|end\b|loop\b|rect\b|opt\b|par\b|and\b|critical\b|break\b|note\b|activate\b|deactivate\b|box\b|subgraph\b|state\b|class\b|click\b|linkStyle\b|style\b|section\b|title\b|accTitle\b|accDescr\b|accDescription\b|interpolate\b|direction\b|journey\b|timeline\b|pie\b|gitGraph\b|mindmap\b|gantt\b|erDiagram\b|stateDiagram\b|classDiagram\b|sequenceDiagram\b|graph\b|%%/i;
    const isMermaidStart = (line) => {
      const trimmed = line.trimStart();
      if (!trimmed) return false;
      if (trimmed.startsWith('graph ')) return true;
      return mermaidStarters.some((kw) => kw !== 'graph' && trimmed.startsWith(kw));
    };
    const mermaidBlocks = [];
    const placeholderFor = (idx) => `__MDR_MERMAID_BLOCK_${idx}__`;
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = md.split('\n');
    const rebuilt = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isMermaidStart(line)) {
        const indent = line.match(/^\s*/)[0] || '';
        const block = [];
        let j = i;
        while (j < lines.length) {
          const current = lines[j];
          if (current.trim() === '' && j !== i) {
            let k = j + 1;
            while (k < lines.length && lines[k].trim() === '') k++;
            if (k < lines.length && (isMermaidStart(lines[k]) || mermaidBodyPattern.test(lines[k].trim()))) {
              block.push('');
              j++;
              continue;
            }
            break;
          }
          if (indent && current.startsWith(indent)) block.push(current.slice(indent.length));
          else block.push(current);
          j++;
        }
        const hasContent = block.length > 1 && block.slice(1).some((row) => mermaidBodyPattern.test(row));
        if (hasContent) {
          const idx = mermaidBlocks.length;
          mermaidBlocks.push(block.join('\n').trim());
          if (rebuilt.length && rebuilt[rebuilt.length - 1] !== '') rebuilt.push('');
          rebuilt.push(placeholderFor(idx));
          i = j - 1;
          continue;
        }
      }
      rebuilt.push(line);
    }
    md = rebuilt.join('\n');
    mermaidBlocks.forEach((diagram, idx) => {
      const html = `<div class="mermaid">${escapeHTML(diagram)}</div>`;
      const placeholder = placeholderFor(idx);
      const re = new RegExp(escapeRegExp(placeholder), 'g');
      md = md.replace(re, () => html);
    });

    // Mermaid blocks
    md = md.replace(/```mermaid\n([\s\S]*?)```/g, (m, code) => {
      return `<div class="mermaid">${escapeHTML(code)}</div>`;
    });

    // Fenced code blocks
    md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
      const cls = lang ? ` class="lang-${lang.toLowerCase()}"` : '';
      const encoded = escapeHTML(code);
      return `<pre class="code-block"><div class="code-tools"><button class="copy">Copy</button><button class="dl">Save</button></div><code${cls}>${encoded}</code></pre>`;
    });

    // Inline code
    md = md.replace(/`([^`\n]+)`/g, (m, code) => `<code class="inline-code">${escapeHTML(code)}</code>`);

    // Headings
    md = md.replace(/^######\s?(.*)$/gm, (m, t) => `<h6 id="${slugify(t)}">${t}</h6>`);
    md = md.replace(/^#####\s?(.*)$/gm, (m, t) => `<h5 id="${slugify(t)}">${t}</h5>`);
    md = md.replace(/^####\s?(.*)$/gm, (m, t) => `<h4 id="${slugify(t)}">${t}</h4>`);
    md = md.replace(/^###\s?(.*)$/gm, (m, t) => `<h3 id="${slugify(t)}">${t}</h3>`);
    md = md.replace(/^##\s?(.*)$/gm, (m, t) => `<h2 id="${slugify(t)}">${t}</h2>`);
    md = md.replace(/^#\s?(.*)$/gm,  (m, t) => `<h1 id="${slugify(t)}">${t}</h1>`);

    // Bold/Italic
    md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    md = md.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    md = md.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // Images
    md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => `<img alt="${escapeHTML(alt)}" src="${escapeHTML(url)}" />`);

    // Links
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(text)}</a>`);

    // HR
    md = md.replace(/^\s*(\-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr />');

    // Blockquote
    md = md.replace(/^>(.*)$/gm, (m, line) => `<blockquote>${line.trim()}</blockquote>`);

    // Lists
    md = md.replace(/(?:^|\n)((?:\s*[-*+]\s+.*\n)+)/g, (m, block) => {
      const items = block.trim().split('\n').map(line => line.replace(/^\s*[-*+]\s+/, '').trim())
        .map(li => `<li>${li}</li>`).join('');
      return `\n<ul>${items}</ul>\n`;
    });
    md = md.replace(/(?:^|\n)((?:\s*\d+\.\s+.*\n)+)/g, (m, block) => {
      const items = block.trim().split('\n').map(line => line.replace(/^\s*\d+\.\s+/, '').trim())
        .map(li => `<li>${li}</li>`).join('');
      return `\n<ol>${items}</ol>\n`;
    });

    // Tables (simple GFM)
    md = md.replace(/^\|(.+)\|\n\|([ -:|]+)\|\n([\s\S]*?)(?:\n\n|\n$)/gm, (m, header, align, body) => {
      const headers = header.split('|').map(h=>h.trim());
      const aligns = align.split('|').map(a=>a.trim());
      const rows = body.trim().split('\n').map(r=>r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c=>c.trim()));
      const ths = headers.map((h,i)=>`<th${colAlign(aligns[i])}>${h}</th>`).join('');
      const trs = rows.map(r=>`<tr>${r.map((c,i)=>`<td${colAlign(aligns[i])}>${c}</td>`).join('')}</tr>`).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>\n`;
    });

    // Paragraphs
    md = md.split(/\n{2,}/).map(chunk => {
      if (/^\s*<(h\d|ul|ol|li|pre|blockquote|hr|img|table|div)/i.test(chunk.trim())) return chunk;
      const lines = chunk.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length) return '';
      return `<p>${lines.join('<br/>')}</p>`;
    }).join('\n');

    return md;
  }

  function enhanceCodeBlocks(root) {
    root.querySelectorAll('pre.code-block').forEach(pre => {
      const code = pre.querySelector('code');
      const tools = pre.querySelector('.code-tools');
      const btnCopy = tools.querySelector('.copy');
      const btnDL = tools.querySelector('.dl');
      btnCopy.onclick = async () => {
        await navigator.clipboard.writeText(code.innerText);
        btnCopy.textContent = 'Copied!';
        setTimeout(()=>btnCopy.textContent='Copy',1200);
      };
      btnDL.onclick = () => {
        const blob = new Blob([code.innerText], {type:'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const lang = (code.className.match(/lang-(\w+)/)||[])[1] || 'code';
        a.download = `${(getNameFromURL(src)||'snippet').replace(/\W+/g,'_')}.${lang}`;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      };
    });
  }

  function buildTOC() {
    const headings = $content.querySelectorAll('h1,h2,h3,h4,h5,h6');
    if (!headings.length) return;
    const frag = document.createDocumentFragment();
    const title = document.createElement('h2'); title.textContent = 'Mục lục';
    frag.appendChild(title);
    headings.forEach(h => {
      const d = parseInt(h.tagName[1], 10);
      const a = document.createElement('a');
      a.href = `#${h.id || slugify(h.textContent)}`;
      a.textContent = h.textContent;
      a.className = 'd'+d;
      frag.appendChild(a);
    });
    $toc.innerHTML = ''; $toc.appendChild(frag);
  }

  function clearHighlights() {
    $content.querySelectorAll('mark.mdr-hit').forEach(m=>{
      const text = document.createTextNode(m.textContent);
      m.replaceWith(text);
    });
    searchHits = []; currentHit = -1;
  }

  function doSearch(q) {
    clearHighlights();
    if (!q) return;
    const walker = document.createTreeWalker($content, NodeFilter.SHOW_TEXT, null);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let node;
    while (node = walker.nextNode()) {
      const m = node.nodeValue.match(re);
      if (m) {
        const parent = node.parentNode;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        node.nodeValue.replace(re, (match, offset) => {
          if (offset > lastIndex) frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, offset)));
          const mark = document.createElement('mark');
          mark.className = 'mdr-hit';
          mark.textContent = node.nodeValue.slice(offset, offset + match.length);
          frag.appendChild(mark);
          lastIndex = offset + match.length;
        });
        if (lastIndex < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
        parent.replaceChild(frag, node);
      }
    }
    searchHits = Array.from($content.querySelectorAll('mark.mdr-hit'));
    if (searchHits.length){ currentHit = 0; gotoHit(currentHit); }
  }

  function gotoHit(i) {
    if (!Number.isInteger(i)) return;
    if (!searchHits || !searchHits.length) return;
    if (i < 0) i = 0;
    if (i >= searchHits.length) i = searchHits.length - 1;
    $content.querySelectorAll('mark.mdr-hit.mdr-active').forEach(m => m.classList.remove('mdr-active'));
    currentHit = i;
    const el = searchHits[i];
    if (!el) return;
    el.classList.add('mdr-active');
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }

  function initTheme() {
    const key = 'mdr-theme';
    const current = localStorage.getItem(key) || 'dark';
    document.body.dataset.theme = current;
    $toggleTheme.textContent = current === 'dark' ? 'Light' : 'Dark';
    $toggleTheme.addEventListener('click', () => {
      const next = (document.body.dataset.theme === 'dark') ? 'light' : 'dark';
      document.body.dataset.theme = next;
      localStorage.setItem(key, next);
      $toggleTheme.textContent = next === 'dark' ? 'Light' : 'Dark';
      // re-run mermaid with new theme
      renderMermaid();
    });
    window.addEventListener('keydown', (e) => { if (e.altKey && e.key.toLowerCase() === 'd') $toggleTheme.click(); });
  }

  function renderMermaid() {
    if (!window.mermaid) return;
    mermaid.initialize({ startOnLoad: false, theme: document.body.dataset.theme === 'dark' ? 'dark' : 'default' });
    mermaid.run();
  }

  function exportStandalone() {
    const cssHref = 'styles.css';
    const xhr = new XMLHttpRequest();
    xhr.open('GET', cssHref, true);
    xhr.onload = () => {
      const css = xhr.responseText || '';
      const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(getNameFromURL(src)||'Document')}</title><style>${css}</style></head><body data-theme="${document.body.dataset.theme}"><main class="mdr-container"><article class="markdown-body">${$content.innerHTML}</article></main><script>${(window.mermaid? 'mermaid.initialize({startOnLoad:true});' : '')}<\/script></body></html>`;
      const blob = new Blob([doc], {type:'text/html'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (getNameFromURL(src) || 'document').replace(/\.[^/.]+$/,'') + '.html';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    };
    xhr.send();
  }

  async function load() {
    setSourceUI();
    initTheme();

    if (!src) { $content.textContent = 'Không tìm thấy tham số ?src='; return; }
    try {
      const res = await fetch(src, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawMD = await res.text();
      const html = mdToHtml(rawMD);
      $content.innerHTML = html;
      enhanceCodeBlocks($content);
      buildTOC();
      renderMermaid();
    } catch (err) {
      console.error(err);
      $content.innerHTML = `<p style="color:var(--danger)">Không thể tải Markdown từ: <code>${escapeHTML(src)}</code><br/>Lỗi: ${escapeHTML(String(err))}</p>`;
    }

    $copyMD.onclick = async () => {
      await navigator.clipboard.writeText(rawMD || '');
      $copyMD.textContent = 'Copied!';
      setTimeout(()=> $copyMD.textContent = 'Copy MD', 1200);
    };

    $exportHTML.onclick = exportStandalone;

    $menuTOC.onclick = () => $toc.classList.toggle('open');
    window.addEventListener('keydown', (e) => { if (e.altKey && e.key.toLowerCase() === 't') $menuTOC.click(); });

    function searchSubmit() { const q = $searchBox.value.trim(); if (q) doSearch(q); if (searchHits.length) gotoHit(0); }
    $searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = $searchBox.value.trim();
        if (!q) return;
        if (!searchHits.length) doSearch(q);
        if (!searchHits.length) return;
        if (e.shiftKey) currentHit = (currentHit - 1 + searchHits.length) % searchHits.length;
        else currentHit = (currentHit + 1) % searchHits.length;
        gotoHit(currentHit);
      }
      e.stopPropagation();
    });
    window.addEventListener('keydown', (e) => { if (e.altKey && e.key === '/') { e.preventDefault(); $searchBox.focus(); }});
    $prevHit.onclick = () => { if (!$searchBox.value.trim()) return; if (!searchHits.length) searchSubmit(); if (!searchHits.length) return; currentHit = (currentHit - 1 + searchHits.length) % searchHits.length; gotoHit(currentHit); };
    $nextHit.onclick = () => { if (!$searchBox.value.trim()) return; if (!searchHits.length) searchSubmit(); if (!searchHits.length) return; currentHit = (currentHit + 1) % searchHits.length; gotoHit(currentHit); };
    $clearSearch.onclick = () => { $searchBox.value=''; clearHighlights(); $searchBox.focus(); };
  }

  load();
})();
