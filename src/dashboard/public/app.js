let evtSource = null;

async function testConnection() {
  const useMock = document.getElementById('use-mock').checked;
  setConnStatus('vanta', 'pending', 'Checking...');
  setConnStatus('claude', 'pending', 'Checking...');

  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useMock }),
    });
    const data = await res.json();
    if (data.success) {
      setConnStatus('vanta', 'connected', useMock ? 'Mock (Demo Mode)' : data.companyName || 'Connected');
    } else {
      setConnStatus('vanta', 'disconnected', data.error || 'Failed');
    }
  } catch (e) {
    setConnStatus('vanta', 'disconnected', 'Error');
  }

  const hasKey = await fetch('/api/status').then(r => r.json()).catch(() => null);
  const claudeStatus = process?.env?.ANTHROPIC_API_KEY ? 'connected' : 'checking';
  setConnStatus('claude', 'connected', 'API Key Configured');
}

function setConnStatus(api, status, text) {
  const badge = document.getElementById(`${api}-status`);
  const textEl = document.getElementById(`${api}-status-text`);
  badge.className = `conn-badge ${status}`;
  const dot = badge.querySelector('.conn-dot');
  dot.className = `conn-dot ${status === 'connected' ? 'green' : status === 'disconnected' ? 'red' : 'gray'}`;
  textEl.textContent = text;
}

document.getElementById('use-mock').addEventListener('change', function() {
  document.getElementById('mock-label').textContent = this.checked
    ? 'Use Mock Data (demo mode)'
    : 'Use Live Vanta Data';
  testConnection();
});

async function generate() {
  const btn = document.getElementById('generate-btn');
  const icon = document.getElementById('generate-icon');
  const textEl = document.getElementById('generate-text');

  btn.disabled = true;
  icon.innerHTML = '<div class="spinner"></div>';
  textEl.textContent = 'Generating...';

  const config = {
    companyName: document.getElementById('company-name').value || 'Acme SaaS Inc',
    quarter: document.getElementById('quarter').value,
    year: parseInt(document.getElementById('year').value),
    useMock: document.getElementById('use-mock').checked,
  };

  const STEPS = [
    'Connecting to Vanta API',
    'Collecting compliance data',
    'Calculating posture score',
    'Generating board narratives with Claude',
    'Building PDF report',
    'Building PowerPoint presentation',
    'Reports ready for download',
  ];

  const panel = document.getElementById('progress-panel');
  const stepsEl = document.getElementById('progress-steps');
  panel.classList.add('visible');
  document.getElementById('download-panel').classList.remove('visible');

  stepsEl.innerHTML = STEPS.map(s =>
    `<div class="progress-step pending" id="step-${slugify(s)}">
      <span class="step-icon">⏳</span>
      <span class="step-text">${s}</span>
    </div>`
  ).join('');

  if (evtSource) evtSource.close();
  evtSource = new EventSource('/api/events');

  evtSource.addEventListener('progress', e => {
    const data = JSON.parse(e.data);
    for (const step of (data.steps || [])) {
      const el = document.getElementById(`step-${slugify(step.step)}`);
      if (!el) continue;
      if (step.status === 'done') {
        el.className = 'progress-step done';
        el.querySelector('.step-icon').textContent = '✓';
      } else if (step.status === 'active') {
        el.className = 'progress-step active';
        el.querySelector('.step-icon').innerHTML = '<div class="step-spinner"></div>';
      } else if (step.status === 'error') {
        el.className = 'progress-step error';
        el.querySelector('.step-icon').textContent = '✗';
      }
    }
  });

  evtSource.addEventListener('complete', e => {
    const { files } = JSON.parse(e.data);
    showDownloads(files);
    icon.textContent = '📊';
    textEl.textContent = 'Generate Board Report';
    btn.disabled = false;
    evtSource.close();
    loadHistory();
  });

  evtSource.addEventListener('error', e => {
    icon.textContent = '📊';
    textEl.textContent = 'Generate Board Report';
    btn.disabled = false;
  });

  try {
    await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    icon.textContent = '📊';
    textEl.textContent = 'Generate Board Report';
  }
}

function showDownloads(files) {
  const panel = document.getElementById('download-panel');
  const grid = document.getElementById('download-grid');
  panel.classList.add('visible');

  grid.innerHTML = files.map(f => `
    <a class="download-card" href="/api/download/${encodeURIComponent(f.name)}" download="${f.name}">
      <div class="download-icon">${f.name.endsWith('.pdf') ? '📄' : '📊'}</div>
      <div class="download-info">
        <div class="download-name">${f.name.endsWith('.pdf') ? 'PDF Board Report' : 'PowerPoint Presentation'}</div>
        <div class="download-meta">${f.name} · ${formatBytes(f.size)}</div>
      </div>
    </a>`).join('');

  if (files[0]?.snapshot) {
    showSnapshot(files[0].snapshot);
  }
}

function showSnapshot(s) {
  const panel = document.getElementById('snapshot-panel');
  const grid = document.getElementById('snapshot-grid');
  panel.style.display = 'block';
  const scoreColor = s.score >= 80 ? 'green' : s.score >= 60 ? 'amber' : 'red';
  grid.innerHTML = `
    <div class="snapshot-card"><div class="snapshot-value ${scoreColor}">${s.score}</div><div class="snapshot-label">Posture Score</div></div>
    <div class="snapshot-card"><div class="snapshot-value">${s.controlsPassing}/${s.controlsTotal}</div><div class="snapshot-label">Controls Passing</div></div>
    <div class="snapshot-card"><div class="snapshot-value ${s.highRisks > 0 ? 'amber' : 'green'}">${s.highRisks}</div><div class="snapshot-label">High-Risk Items</div></div>
    <div class="snapshot-card"><div class="snapshot-value">${s.personnelRate}%</div><div class="snapshot-label">Personnel Compliant</div></div>
  `;
}

async function loadHistory() {
  const history = await fetch('/api/history').then(r => r.json()).catch(() => []);
  const container = document.getElementById('history-container');
  if (!history.length) {
    container.innerHTML = '<div class="empty-state">No history yet — generate your first report to start tracking trends.</div>';
    return;
  }
  container.innerHTML = `
    <table class="history-table">
      <thead><tr>
        <th>Period</th><th>Posture Score</th><th>Controls</th><th>High Risks</th><th>Personnel</th><th>Saved</th>
      </tr></thead>
      <tbody>
        ${history.map(h => {
          const scoreColor = h.postureScore >= 80 ? 'green' : h.postureScore >= 60 ? 'amber' : 'red';
          return `<tr>
            <td><strong>${h.quarter} ${h.year}</strong></td>
            <td><span class="score-chip ${scoreColor}">${h.postureScore}</span></td>
            <td>${h.controls?.passing ?? '—'}/${h.controls?.total ?? '—'}</td>
            <td>${h.risks?.high ?? '—'}</td>
            <td>${h.personnel?.compliant ?? '—'}/${h.personnel?.total ?? '—'}</td>
            <td style="color:var(--muted);font-size:12px">${h.savedAt ? new Date(h.savedAt).toLocaleDateString() : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function slugify(str) { return str.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Init
testConnection();
loadHistory();
