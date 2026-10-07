// Mirrors ADR-0006 §2: only the designated "/source" test route is treated
// as a matched Markdown navigation. Everything else on the origin (like the
// "/before" page used to test Back-button behavior) is left alone, exactly
// as the real content script would leave non-matching pages alone.
if (location.pathname === '/source') {
  (async () => {
    try {
      const text = document.body.innerText;
      const response = await chrome.runtime.sendMessage({
        type: 'handoff/create',
        url: location.href,
        text,
        hints: {},
      });
      if (!response || !response.token) throw new Error('no token in response');
      const urlWithoutHash = location.href.slice(0, location.href.length - location.hash.length);
      const dest =
        chrome.runtime.getURL('viewer.html') +
        '?src=' +
        encodeURIComponent(urlWithoutHash) +
        '&h=' +
        response.token +
        location.hash;
      location.replace(dest);
    } catch (e) {
      console.error('SPIKE5 handoff failed', e);
    }
  })();
}
