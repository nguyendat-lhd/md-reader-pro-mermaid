
(() => {
  const isProbablyMarkdownURL = () => {
    const href = location.href.split('#')[0].split('?')[0].toLowerCase();
    return href.endsWith('.md') || href.endsWith('.markdown') || href.endsWith('.md.txt');
  };
  const looksLikeRawTextPage = () => {
    const preOnly = document.body && document.body.children.length === 1 && document.body.firstElementChild?.tagName === 'PRE';
    const plainish = document.contentType === 'text/plain';
    const fewElements = document.body && document.body.querySelectorAll('*').length < 30;
    return preOnly || plainish || (fewElements && (document.body?.innerText || '').split('\n').length > 30);
  };
  const alreadyInjected = () => document.documentElement.hasAttribute('data-md-reader-injected');
  const redirectToReader = () => {
    try {
      document.documentElement.setAttribute('data-md-reader-injected','true');
      const readerURL = chrome.runtime.getURL('reader.html');
      location.replace(`${readerURL}?src=${encodeURIComponent(location.href)}`);
    } catch(e){ console.warn('MD Reader redirect failed:', e); }
  };
  if (!alreadyInjected() && (isProbablyMarkdownURL() || looksLikeRawTextPage())) redirectToReader();
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'm' && !alreadyInjected()) redirectToReader();
  });
})();
