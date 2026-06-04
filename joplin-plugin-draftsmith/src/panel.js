(function() {
  function post(message) {
    if (!window.webviewApi || !window.webviewApi.postMessage) {
      console.error('DraftSmith: webviewApi.postMessage is not available');
      return Promise.resolve(null);
    }
    return window.webviewApi.postMessage(message);
  }

  function decodeId(id) {
    try { return decodeURIComponent(id); } catch (e) { return id; }
  }

  document.addEventListener('change', function(event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains('tag-toggle')) return;
    post({ type: 'togglePattern', id: decodeId(target.getAttribute('data-id') || ''), enabled: !!target.checked });
  });

  document.addEventListener('click', function(event) {
    var target = event.target;
    if (!target || !target.getAttribute) return;
    var action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'apply') return post({ type: 'apply' });
    if (action === 'refresh') return post({ type: 'refresh' });
    if (action === 'saveSyncNote') return post({ type: 'saveSyncNote' });
    if (action === 'loadSyncNote') return post({ type: 'loadSyncNote' });
    if (action === 'enableAll') return post({ type: 'bulkEnable', mode: 'all' });
    if (action === 'disableAll') return post({ type: 'bulkEnable', mode: 'none' });
    if (action === 'onlyGaps') return post({ type: 'bulkEnable', mode: 'only', ids: ['GAP'] });
    if (action === 'issues') return post({ type: 'bulkEnable', mode: 'issues' });
    if (action === 'addTag') {
      var input = document.getElementById('newTag');
      var value = input ? input.value : '';
      if (input) input.value = '';
      return post({ type: 'addTag', tag: value });
    }
  });
})();
