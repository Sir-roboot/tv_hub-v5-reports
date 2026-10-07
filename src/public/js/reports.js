const reportsList = document.querySelector('#reports-list');
const reportsStatus = document.querySelector('#reports-status');
const reportFormSection = document.querySelector('#report-form-section');
const reportForm = document.querySelector('#report-form');
const reportFormStatus = document.querySelector('#report-form-status');
const channelId = new URLSearchParams(location.search).get('channelId');

async function loadUser() {
  const response = await fetch('/api/users/me');
  if (!response.ok) { location.href = '/login'; return false; }
  const user = await response.json();
  document.querySelector('#welcome').textContent = `Welcome, ${user.email}`;
  return true;
}

function formatReason(reason) {
  return reason.toLowerCase().split('_').map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

function createReportItem(report) {
  const item = document.createElement('article');
  item.className = 'report-item';
  const channel = document.createElement('h3');
  channel.textContent = report.channelId?.name || 'Channel unavailable';
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${formatReason(report.reason)}`;
  const description = document.createElement('p');
  description.textContent = report.description;
  const status = document.createElement('p');
  status.className = 'report-status';
  status.textContent = report.status;
  const created = document.createElement('p');
  created.className = 'report-date';
  created.textContent = new Date(report.createdAt).toLocaleString();
  item.append(channel, reason, description, status, created);
  const evidenceUrls = report.evidenceUrls || (report.evidenceUrl ? [report.evidenceUrl] : []);
  let evidenceIndex = 1;
  for (const evidenceUrl of evidenceUrls) {
    const evidence = document.createElement('a');
    evidence.href = evidenceUrl;
    evidence.target = '_blank';
    evidence.rel = 'noopener';
    evidence.textContent = `View evidence image ${evidenceIndex++}`;
    item.append(evidence);
  }

  const actions = document.createElement('div');
  actions.className = 'report-actions';
  const editButton = document.createElement('button');
  editButton.className = 'report-button';
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => editReport(report));
  const deleteButton = document.createElement('button');
  deleteButton.className = 'report-button';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteReport(report._id));
  actions.append(editButton, deleteButton);
  item.append(actions);
  return item;
}

async function editReport(report) {
  const reason = window.prompt(
    'Reason (STREAM_DOES_NOT_LOAD, WRONG_CHANNEL, AUDIO_PROBLEM, VIDEO_PROBLEM, OTHER):',
    report.reason
  );
  if (reason === null) return;
  const description = window.prompt('Description:', report.description);
  if (description === null) return;
  const status = window.prompt('Status (OPEN, IN_PROGRESS, RESOLVED):', report.status);
  if (status === null) return;

  const response = await fetch(`/api/reports/${report._id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, description, status })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportsStatus.textContent = payload.error?.message || 'Could not update report.';
    return;
  }
  await loadReports();
}

async function deleteReport(reportId) {
  if (!window.confirm('Delete this report?')) return;
  const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportsStatus.textContent = payload.error?.message || 'Could not delete report.';
    return;
  }
  await loadReports();
}

async function loadReports() {
  const response = await fetch('/api/reports');
  if (!response.ok) { reportsStatus.textContent = 'Could not load reports.'; return; }
  const { reports } = await response.json();
  reportsStatus.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}`;
  if (reports.length === 0) {
    reportsList.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'You have not reported a channel yet.' }));
    return;
  }
  reportsList.replaceChildren(...reports.map(createReportItem));
}

async function submitReport(event) {
  event.preventDefault();
  const formData = new FormData();
  formData.append('channelId', channelId);
  formData.append('reason', document.querySelector('#report-reason').value);
  formData.append('description', document.querySelector('#report-description').value);
  const evidenceFiles = document.querySelector('#report-evidence').files;
  for (const file of evidenceFiles) {
    formData.append('evidence', file);
  }

  reportFormStatus.textContent = 'Submitting report…';
  const response = await fetch('/api/reports', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportFormStatus.textContent = payload.error?.message || 'Could not submit the report.';
    return;
  }

  reportForm.reset();
  reportFormStatus.textContent = 'Report saved.';
  await loadReports();
}

function configureReportForm() {
  if (!channelId) return;
  reportFormSection.hidden = false;
  document.querySelector('#report-channel-id').value = channelId;
  document.querySelector('#report-channel').textContent = 'Report the selected channel.';
  reportForm.addEventListener('submit', submitReport);
}

document.querySelector('#logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login'; });
async function start() { if (await loadUser()) { configureReportForm(); await loadReports(); } }
start();
