(async () => {
  const target = document.getElementById('diagram');
  try {
    mermaid.default.initialize({ startOnLoad: false, securityLevel: 'strict' });
    const { svg } = await mermaid.default.render('spike2-graph', 'graph TD; A-->B; B-->C;');
    target.innerHTML = svg;
    document.title = target.querySelector('svg') ? 'mermaid-ok' : 'mermaid-no-svg';
  } catch (e) {
    target.textContent = `mermaid-fail:${e.message}`;
    document.title = 'mermaid-fail';
  }
})();
