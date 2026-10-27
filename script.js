const PROCESS_STATES = ['NEW', 'READY', 'RUNNING', 'WAITING', 'TERMINATED'];
const STORAGE_KEY = 'processStateSimulator.v1';
const stateMeta = {
  NEW: {
    description: 'A process has been created and is waiting to be admitted by the operating system.',
    example: 'A newly started editor or shell process is placed in NEW until it enters the ready queue.'
  },
  READY: {
    description: 'The process is waiting in the ready queue for CPU time and scheduling decisions.',
    example: 'A process completed its admission and waits for the dispatcher to assign the CPU.'
  },
  RUNNING: {
    description: 'The process is executing on the CPU and may be preempted or request I/O.',
    example: 'The kernel currently runs the process while a CPU quantum is in effect.'
  },
  WAITING: {
    description: 'The process is blocked for an I/O operation or resource and cannot execute until completion.',
    example: 'A file read or network request causes the process to wait until the device responds.'
  },
  TERMINATED: {
    description: 'The process has finished execution and cannot be scheduled again.',
    example: 'A completed job, a crashed task, or a user-terminated process reaches TERMINATED.'
  }
};

const diagramStateConfig = {
  NEW: { x: 130, y: 235, fill: '#22d3ee' },
  READY: { x: 350, y: 235, fill: '#60a5fa' },
  RUNNING: { x: 570, y: 235, fill: '#a78bfa' },
  WAITING: { x: 790, y: 235, fill: '#fbbf24' },
  TERMINATED: { x: 570, y: 410, fill: '#f87171' }
};

let processes = [];
let logs = [];
let selectedProcessId = null;
let selectedStateView = 'READY';
let simulationRunning = false;
let simulationTimer = null;
let activeDemoIndex = 0;
let demoRunning = false;
let activeTransition = null;

function createDefaultProcesses() {
  const baseTime = new Date();
  return [
    {
      id: 'P1',
      name: 'Browser',
      state: 'READY',
      priority: 2,
      remainingBurst: 5,
      createdAt: new Date(baseTime.getTime() - 300000).toISOString(),
      transitions: 0,
      history: [
        { timestamp: new Date(baseTime.getTime() - 300000).toISOString(), from: 'NEW', to: 'READY', reason: 'Admitted to ready queue', eventType: 'state_change' }
      ],
      burstTime: 5
    },
    {
      id: 'P2',
      name: 'Compiler',
      state: 'RUNNING',
      priority: 1,
      remainingBurst: 3,
      createdAt: new Date(baseTime.getTime() - 240000).toISOString(),
      transitions: 1,
      history: [
        { timestamp: new Date(baseTime.getTime() - 240000).toISOString(), from: 'NEW', to: 'READY', reason: 'Admitted to ready queue', eventType: 'state_change' },
        { timestamp: new Date(baseTime.getTime() - 200000).toISOString(), from: 'READY', to: 'RUNNING', reason: 'Dispatched to CPU', eventType: 'cpu_dispatch' }
      ],
      burstTime: 6
    },
    {
      id: 'P3',
      name: 'Database',
      state: 'WAITING',
      priority: 3,
      remainingBurst: 4,
      createdAt: new Date(baseTime.getTime() - 180000).toISOString(),
      transitions: 2,
      history: [
        { timestamp: new Date(baseTime.getTime() - 180000).toISOString(), from: 'NEW', to: 'READY', reason: 'Admitted to ready queue', eventType: 'state_change' },
        { timestamp: new Date(baseTime.getTime() - 120000).toISOString(), from: 'READY', to: 'RUNNING', reason: 'Dispatched to CPU', eventType: 'cpu_dispatch' },
        { timestamp: new Date(baseTime.getTime() - 90000).toISOString(), from: 'RUNNING', to: 'WAITING', reason: 'Disk I/O request', eventType: 'io_event' }
      ],
      burstTime: 4
    },
    {
      id: 'P4',
      name: 'Scheduler',
      state: 'NEW',
      priority: 2,
      remainingBurst: 2,
      createdAt: new Date(baseTime.getTime() - 60000).toISOString(),
      transitions: 0,
      history: [{ timestamp: new Date(baseTime.getTime() - 60000).toISOString(), from: 'NEW', to: 'NEW', reason: 'Process created', eventType: 'process_create' }],
      burstTime: 2
    }
  ];
}

function getStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveState() {
  try {
    const payload = {
      processes,
      logs,
      selectedProcessId,
      selectedStateView,
      simulationRunning,
      timeQuantum: Number(document.getElementById('timeQuantumInput').value) || 3,
      simulationSpeed: Number(document.getElementById('simulationSpeedInput').value) || 1200
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist simulator state.', error);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2400);
}

function formatTime(dateValue) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function addLog(eventType, description, processId = null) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    eventType,
    description,
    processId
  };
  logs.unshift(entry);
  saveState();
}

function getSelectedProcess() {
  return processes.find((process) => process.id === selectedProcessId) || null;
}

function generateNewProcessId() {
  const ids = processes.map((process) => Number.parseInt(process.id.replace('P', ''), 10) || 0);
  const next = (Math.max(0, ...ids) + 1);
  return `P${next}`;
}

function addTransitionHistory(process, from, to, reason, eventType = 'state_change') {
  process.history = process.history || [];
  process.history.push({
    timestamp: new Date().toISOString(),
    from,
    to,
    reason,
    eventType
  });
}

function validateTransition(process, targetState) {
  if (!process) {
    return { ok: false, reason: 'Process was not found.' };
  }

  if (process.state === 'TERMINATED') {
    return { ok: false, reason: 'A terminated process cannot be restarted.' };
  }

  const validTransitions = {
    NEW: ['READY'],
    READY: ['RUNNING'],
    RUNNING: ['READY', 'WAITING', 'TERMINATED'],
    WAITING: ['READY'],
    TERMINATED: []
  };

  const current = process.state;
  const allowed = validTransitions[current] || [];

  if (!allowed.includes(targetState)) {
    return {
      ok: false,
      reason: `Invalid transition: ${current} -> ${targetState}. Allowed transitions are ${allowed.join(' , ') || 'none'}.`
    };
  }

  if (current === 'NEW' && targetState === 'RUNNING') {
    return { ok: false, reason: 'A process in NEW cannot directly move to RUNNING.' };
  }

  if (current === 'WAITING' && targetState === 'RUNNING') {
    return { ok: false, reason: 'A waiting process cannot directly move to RUNNING.' };
  }

  if (current === 'TERMINATED') {
    return { ok: false, reason: 'TERMINATED is a permanent final state.' };
  }

  return { ok: true, reason: 'Transition accepted.' };
}

function transitionProcess(processId, targetState, reason = 'Manual state transition', eventType = 'state_change') {
  const process = processes.find((item) => item.id === processId);
  if (!process) {
    showToast('Process not found.', 'error');
    return false;
  }

  const validation = validateTransition(process, targetState);
  if (!validation.ok) {
    addLog('invalid_transition', `${process.id} attempted ${process.state} -> ${targetState}. Reason: ${validation.reason}`, process.id);
    showToast(`${process.id}: ${validation.reason}`, 'error');
    renderAll();
    return false;
  }

  const previousState = process.state;
  process.state = targetState;
  activeTransition = `${previousState}->${targetState}`;
  process.transitions = (Number(process.transitions) || 0) + 1;

  if (targetState === 'TERMINATED') {
    process.remainingBurst = 0;
  }

  if (targetState === 'RUNNING' && typeof process.burstTime === 'number' && process.remainingBurst <= 0) {
    process.remainingBurst = process.burstTime;
  }

  addTransitionHistory(process, previousState, targetState, reason, eventType);
  addLog(eventType, `${process.id} transitioned ${previousState} -> ${targetState}. ${reason}`, process.id);

  if (selectedProcessId === processId) {
    selectedStateView = targetState;
  }

  saveState();
  renderAll();
  return true;
}

function terminateProcess(processId, reason = 'Terminated by user request') {
  const process = processes.find((item) => item.id === processId);
  if (!process) {
    showToast('Could not terminate an unknown process.', 'error');
    return false;
  }

  if (process.state === 'TERMINATED') {
    showToast(`${process.id} is already terminated.`, 'error');
    return false;
  }

  return transitionProcess(processId, 'TERMINATED', reason, 'state_change');
}

function getProcessStatistics() {
  const counts = { TOTAL: processes.length, NEW: 0, READY: 0, RUNNING: 0, WAITING: 0, TERMINATED: 0 };
  processes.forEach((process) => {
    if (counts[process.state] !== undefined) {
      counts[process.state] += 1;
    }
  });
  return counts;
}

function createProcess(name = '', priority = 3, burst = 6) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    showToast('Process name is required.', 'error');
    return null;
  }

  const process = {
    id: generateNewProcessId(),
    name: trimmedName,
    state: 'NEW',
    priority: Number(priority) || 3,
    remainingBurst: Number(burst) || 6,
    burstTime: Number(burst) || 6,
    createdAt: new Date().toISOString(),
    transitions: 0,
    history: [{
      timestamp: new Date().toISOString(),
      from: 'NEW',
      to: 'NEW',
      reason: 'Process created',
      eventType: 'process_create'
    }]
  };

  processes.unshift(process);
  selectedProcessId = process.id;
  selectedStateView = 'NEW';
  addLog('process_create', `${process.id} created with name ${process.name} in NEW state`, process.id);
  saveState();
  renderAll();
  showToast(`${process.id} created successfully.`, 'success');
  return process;
}

function renderSummaryCards() {
  const cards = document.getElementById('summaryCards');
  const stats = getProcessStatistics();
  const cardConfig = [
    { key: 'TOTAL', label: 'Total Processes', accent: '#60a5fa' },
    { key: 'NEW', label: 'New Processes', accent: '#22d3ee' },
    { key: 'READY', label: 'Ready Processes', accent: '#60a5fa' },
    { key: 'RUNNING', label: 'Running Processes', accent: '#a78bfa' },
    { key: 'WAITING', label: 'Waiting Processes', accent: '#fbbf24' },
    { key: 'TERMINATED', label: 'Terminated Processes', accent: '#f87171' }
  ];

  cards.innerHTML = cardConfig.map(({ key, label, accent }) => `
    <article class="summary-card" aria-label="${label}">
      <div class="title">
        <span>${label}</span>
        <span class="badge" style="color:${accent}; border-color:${accent}22; background:${accent}12;">${key}</span>
      </div>
      <div class="value">${stats[key] ?? 0}</div>
    </article>
  `).join('');
}

function setSimulatorStatusText() {
  const status = document.getElementById('globalStatus');
  status.textContent = simulationRunning ? 'Running' : 'Idle';
}

function renderStateDiagram() {
  const svg = document.getElementById('stateDiagram');
  const stateCounts = PROCESS_STATES.reduce((countMap, state) => {
    countMap[state] = processes.filter((process) => process.state === state).length;
    return countMap;
  }, {});
  const selectedProcess = getSelectedProcess();
  const highlightedState = selectedProcess ? selectedProcess.state : selectedStateView;

  const marker = `
    <defs>
      <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="rgba(148,163,184,0.9)"></path>
      </marker>
      <marker id="activeArrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#22d3ee"></path>
      </marker>
    </defs>
  `;

  const nodeMarkup = PROCESS_STATES.map((state) => {
    const config = diagramStateConfig[state];
    const selected = highlightedState === state ? 'selected' : '';
    const count = stateCounts[state] || 0;
    const fill = config.fill;
    const rectFill = selected ? `${fill}20` : 'rgba(15,23,42,0.96)';
    return `
      <g class="state-node ${selected}" data-state="${state}" transform="translate(${config.x}, ${config.y})" tabindex="0" role="button" aria-label="${state} state">
        <rect class="node-rect" x="-75" y="-34" width="150" height="68" fill="${rectFill}" stroke="${fill}" />
        <text class="node-label" x="0" y="-5">${state}</text>
        <text class="state-count" x="0" y="18">${count} ${count === 1 ? 'process' : 'processes'}</text>
      </g>
    `;
  }).join('');

  const transitions = [
    { from: 'NEW', to: 'READY', label: 'Admit', path: 'M 205 235 H 275', labelX: 240, labelY: 215 },
    { from: 'READY', to: 'RUNNING', label: 'Dispatch', path: 'M 425 235 H 495', labelX: 460, labelY: 215 },
    { from: 'RUNNING', to: 'READY', label: 'Preempt', path: 'M 540 201 C 515 126 405 126 380 201', labelX: 460, labelY: 118 },
    { from: 'RUNNING', to: 'WAITING', label: 'I/O request', path: 'M 645 235 H 715', labelX: 680, labelY: 260 },
    { from: 'WAITING', to: 'READY', label: 'I/O complete', path: 'M 790 269 C 790 520 350 520 350 269', labelX: 570, labelY: 545 },
    { from: 'RUNNING', to: 'TERMINATED', label: 'Exit', path: 'M 570 269 V 376', labelX: 594, labelY: 327 }
  ];

  const pathMarkup = transitions.map(({ from, to, label, path, labelX, labelY }) => {
    const isActive = activeTransition === `${from}->${to}`;
    const classes = isActive ? 'transition-line active' : 'transition-line';
    const markerId = isActive ? 'activeArrowHead' : 'arrowHead';
    return `
      <path class="${classes}" d="${path}" marker-end="url(#${markerId})"></path>
      <text class="transition-label" x="${labelX}" y="${labelY}" text-anchor="middle">${label}</text>
    `;
  }).join('');

  svg.innerHTML = `${marker}${pathMarkup}${nodeMarkup}`;

  svg.querySelectorAll('.state-node').forEach((node) => {
    const selectState = () => {
      const state = node.dataset.state;
      selectedStateView = state;
      renderStateInspector();
      renderStateDiagram();
    };
    node.addEventListener('click', selectState);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectState();
      }
    });
  });
}

function renderStateInspector() {
  const badge = document.getElementById('stateInspectorBadge');
  const description = document.getElementById('stateInspectorDescription');
  const list = document.getElementById('stateProcessList');

  const state = selectedStateView || 'READY';
  const stateProcesses = processes.filter((process) => process.state === state);

  badge.textContent = state;
  badge.className = `state-badge ${state.toLowerCase()}`;
  description.textContent = stateMeta[state].description + ' ' + stateMeta[state].example;

  if (!stateProcesses.length) {
    list.innerHTML = `<li class="empty-state">No processes currently in ${state}.</li>`;
    return;
  }

  list.innerHTML = stateProcesses.map((process) => `
    <li data-id="${process.id}">
      <strong>${process.id}</strong>
      <span>${process.name}</span>
    </li>
  `).join('');

  list.querySelectorAll('li[data-id]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedProcessId = item.dataset.id;
      renderProcessTable();
      renderSelectedProcessControls();
      renderStateDiagram();
    });
  });
}

function renderReadyQueue() {
  const readyQueue = processes.filter((process) => process.state === 'READY');
  const queueList = document.getElementById('readyQueueList');
  const queueBadge = document.getElementById('queueCountBadge');
  queueBadge.textContent = String(readyQueue.length);

  if (!readyQueue.length) {
    queueList.innerHTML = '<span class="empty-state">Ready queue is empty.</span>';
    return;
  }

  queueList.innerHTML = readyQueue.map((process) => `
    <span class="queue-chip">
      <span>${process.id}</span>
      <strong>${process.name}</strong>
      <small>${process.remainingBurst}s</small>
    </span>
  `).join('');
}

function renderProcessDetails() {
  const container = document.getElementById('processDetailsCard');
  const selected = getSelectedProcess();

  if (!selected) {
    container.innerHTML = '<div class="empty-state">Select a process to view details and its transition history.</div>';
    return;
  }

  const history = Array.isArray(selected.history) && selected.history.length ? selected.history : [{ timestamp: selected.createdAt || new Date().toISOString(), from: 'NEW', to: selected.state, reason: 'Process created', eventType: 'process_create' }];

  container.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="label">Process ID</span>
        <strong>${selected.id}</strong>
      </div>
      <div class="detail-item">
        <span class="label">Name</span>
        <strong>${selected.name}</strong>
      </div>
      <div class="detail-item">
        <span class="label">Current State</span>
        <strong class="state-pill ${selected.state.toLowerCase()}">${selected.state}</strong>
      </div>
      <div class="detail-item">
        <span class="label">Created</span>
        <strong>${formatTime(selected.createdAt)}</strong>
      </div>
      <div class="detail-item">
        <span class="label">Priority</span>
        <strong>${selected.priority}</strong>
      </div>
      <div class="detail-item">
        <span class="label">CPU Burst</span>
        <strong>${selected.remainingBurst}s</strong>
      </div>
      <div class="detail-item">
        <span class="label">Transitions</span>
        <strong>${selected.transitions}</strong>
      </div>
      <div class="detail-item">
        <span class="label">Status</span>
        <strong>${selected.state === 'TERMINATED' ? 'Final' : 'Active'}</strong>
      </div>
    </div>
    <div>
      <h4>Transition History</h4>
      <ul class="history-list">
        ${history.map((entry) => `
          <li>
            <strong>${formatTime(entry.timestamp)}</strong> — ${entry.from || 'NEW'} → ${entry.to || selected.state} · ${entry.reason || 'No reason provided'}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderRuntimeMetrics() {
  const runningProcess = processes.find((process) => process.state === 'RUNNING');
  const runningLabel = document.getElementById('runningProcessLabel');
  const cpuLabel = document.getElementById('cpuStatusLabel');

  runningLabel.textContent = runningProcess ? `${runningProcess.id} (${runningProcess.name})` : 'None';
  cpuLabel.textContent = runningProcess ? 'Busy' : 'Idle';
}

function renderGanttChart() {
  const chart = document.getElementById('ganttChart');
  const items = processes.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (!items.length) {
    chart.innerHTML = '<div class="empty-state">No process timeline available.</div>';
    return;
  }

  chart.innerHTML = items.map((process) => `
    <div class="gantt-block ${process.state.toLowerCase()}">
      ${process.id}<br />${process.state}
    </div>
  `).join('');
}

function renderProcessTable() {
  const tbody = document.getElementById('processTableBody');
  const searchValue = document.getElementById('processSearchInput').value.trim().toLowerCase();
  const selectedState = document.getElementById('processStateFilter').value;

  const filteredProcesses = processes.filter((process) => {
    const matchesSearch = !searchValue || process.id.toLowerCase().includes(searchValue) || process.name.toLowerCase().includes(searchValue);
    const matchesState = selectedState === 'ALL' || process.state === selectedState;
    return matchesSearch && matchesState;
  });

  if (!filteredProcesses.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No matching processes found.</td></tr>';
    return;
  }

  tbody.innerHTML = filteredProcesses.map((process) => {
    const isSelected = process.id === selectedProcessId;
    return `
      <tr data-process-id="${process.id}" class="${isSelected ? 'selected' : ''}">
        <td><strong>${process.id}</strong></td>
        <td>${process.name}</td>
        <td><span class="state-pill ${process.state.toLowerCase()}">${process.state}</span></td>
        <td>${process.priority}</td>
        <td>${process.remainingBurst}s</td>
        <td>${process.transitions}</td>
        <td>${formatTime(process.createdAt)}</td>
        <td><button class="log-action" type="button">Inspect</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-process-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (target) {
        selectedProcessId = row.dataset.processId;
        renderSelectedProcessControls();
        renderStateDiagram();
        renderStateInspector();
        return;
      }
      selectedProcessId = row.dataset.processId;
      renderSelectedProcessControls();
      renderStateDiagram();
      renderStateInspector();
      renderProcessTable();
    });
  });
}

function renderLogFilter() {
  const select = document.getElementById('logProcessFilter');
  const uniqueProcessIds = [...new Set(logs.map((log) => log.processId).filter(Boolean))];
  const currentValue = select.value || 'ALL';
  select.innerHTML = ['<option value="ALL">All processes</option>']
    .concat(uniqueProcessIds.map((processId) => `<option value="${processId}">${processId}</option>`))
    .join('');
  select.value = uniqueProcessIds.includes(currentValue) ? currentValue : 'ALL';
}

function renderLogs() {
  const filterValue = document.getElementById('logProcessFilter').value || 'ALL';
  const rows = logs.filter((log) => filterValue === 'ALL' || log.processId === filterValue);

  const tbody = document.getElementById('logTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No log entries available.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((log) => `
    <tr>
      <td>${formatTime(log.timestamp)}</td>
      <td>${log.processId || 'System'}</td>
      <td><span class="event-pill ${log.eventType}">${log.eventType.replace('_', ' ')}</span></td>
      <td>${log.description}</td>
    </tr>
  `).join('');
}

function clearLogs() {
  if (!logs.length) {
    showToast('The event log is already empty.', 'info');
    return;
  }

  const shouldClear = window.confirm('Clear the event log?');
  if (!shouldClear) {
    return;
  }

  logs = [];
  saveState();
  renderLogs();
  renderLogFilter();
  showToast('Event log cleared.', 'success');
}

function exportCSV(filename, rows) {
  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 0);
  URL.revokeObjectURL(url);
}

function exportProcesses() {
  const rows = [
    ['ID', 'Name', 'State', 'Priority', 'Remaining Burst', 'Transitions', 'Created At'],
    ...processes.map((process) => [process.id, process.name, process.state, process.priority, process.remainingBurst, process.transitions, process.createdAt])
  ];
  exportCSV('processes.csv', rows);
  showToast('Process export created.', 'success');
}

function exportLogs() {
  const rows = [
    ['Timestamp', 'Process ID', 'Event Type', 'Description'],
    ...logs.map((log) => [log.timestamp, log.processId || 'System', log.eventType, log.description])
  ];
  exportCSV('process_logs.csv', rows);
  showToast('Log export created.', 'success');
}

function renderSelectedProcessControls() {
  const selected = getSelectedProcess();
  const buttons = {
    admit: document.getElementById('admitBtn'),
    dispatch: document.getElementById('dispatchBtn'),
    preempt: document.getElementById('preemptBtn'),
    ioRequest: document.getElementById('ioRequestBtn'),
    ioComplete: document.getElementById('ioCompleteBtn'),
    terminate: document.getElementById('terminateBtn')
  };

  if (!selected) {
    Object.values(buttons).forEach((button) => { button.disabled = true; });
    return;
  }

  const state = selected.state;
  buttons.admit.disabled = state !== 'NEW';
  buttons.dispatch.disabled = state !== 'READY';
  buttons.preempt.disabled = state !== 'RUNNING';
  buttons.ioRequest.disabled = state !== 'RUNNING';
  buttons.ioComplete.disabled = state !== 'WAITING';
  buttons.terminate.disabled = state === 'TERMINATED';
}

function hydrateLearningCards() {
  const container = document.getElementById('learningStateCards');
  const states = PROCESS_STATES.map((state) => `
    <article class="learning-card">
      <h4><span class="state-pill ${state.toLowerCase()}">${state}</span></h4>
      <p><strong>Meaning:</strong> ${stateMeta[state].description}</p>
      <p><strong>Example:</strong> ${stateMeta[state].example}</p>
      <ul>
        <li>Allowed transitions: ${getAllowedTransitions(state).join(', ') || 'None'}</li>
      </ul>
    </article>
  `).join('');
  container.innerHTML = states;
}

function getAllowedTransitions(state) {
  const transitionsMap = {
    NEW: ['READY'],
    READY: ['RUNNING'],
    RUNNING: ['READY', 'WAITING', 'TERMINATED'],
    WAITING: ['READY'],
    TERMINATED: []
  };
  return transitionsMap[state] || [];
}

function renderAll() {
  renderSummaryCards();
  renderStateDiagram();
  renderStateInspector();
  renderReadyQueue();
  renderProcessDetails();
  renderRuntimeMetrics();
  renderProcessTable();
  renderLogFilter();
  renderLogs();
  renderSelectedProcessControls();
  renderGanttChart();
  setSimulatorStatusText();
  hydrateLearningCards();
}

function bindActions() {
  document.getElementById('processForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('processNameInput').value;
    const priority = document.getElementById('processPriorityInput').value;
    const burst = document.getElementById('processBurstInput').value;
    createProcess(name, priority, burst);
    document.getElementById('processForm').reset();
    document.getElementById('processPriorityInput').value = 3;
    document.getElementById('processBurstInput').value = 6;
  });

  document.getElementById('admitBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    transitionProcess(selected.id, 'READY', 'Admitted to the ready queue');
  });

  document.getElementById('dispatchBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    transitionProcess(selected.id, 'RUNNING', 'Dispatched to CPU by scheduler');
  });

  document.getElementById('preemptBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    transitionProcess(selected.id, 'READY', 'CPU preempted by scheduler', 'cpu_preemption');
  });

  document.getElementById('ioRequestBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    transitionProcess(selected.id, 'WAITING', 'Requested I/O operation', 'io_event');
  });

  document.getElementById('ioCompleteBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    transitionProcess(selected.id, 'READY', 'I/O operation completed', 'io_event');
  });

  document.getElementById('terminateBtn').addEventListener('click', () => {
    const selected = getSelectedProcess();
    if (!selected) {
      showToast('Select a process first.', 'error');
      return;
    }
    terminateProcess(selected.id, 'Manual termination by user');
  });

  document.getElementById('sampleDataBtn').addEventListener('click', () => {
    processes = createDefaultProcesses();
    selectedProcessId = processes[0]?.id || null;
    selectedStateView = 'READY';
    logs = [
      { timestamp: new Date().toISOString(), processId: null, eventType: 'simulation', description: 'Default sample dataset loaded.' }
    ];
    saveState();
    renderAll();
    showToast('Sample OS dataset loaded.', 'success');
  });

  document.getElementById('processSearchInput').addEventListener('input', () => renderProcessTable());

  document.getElementById('processStateFilter').addEventListener('change', () => renderProcessTable());

  document.getElementById('logProcessFilter').addEventListener('change', () => renderLogs());

  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
  document.getElementById('exportLogsBtn').addEventListener('click', exportLogs);
  document.getElementById('exportProcessesBtn').addEventListener('click', exportProcesses);

  document.getElementById('resetSimulationBtn').addEventListener('click', () => {
    document.getElementById('resetModal').classList.remove('hidden');
  });

  document.getElementById('cancelResetBtn').addEventListener('click', () => {
    document.getElementById('resetModal').classList.add('hidden');
  });

  document.getElementById('confirmResetBtn').addEventListener('click', () => {
    stopSimulation();
    processes = createDefaultProcesses();
    selectedProcessId = processes[0]?.id || null;
    selectedStateView = 'READY';
    logs = [{ timestamp: new Date().toISOString(), processId: null, eventType: 'simulation', description: 'Simulation reset and default state restored.' }];
    document.getElementById('resetModal').classList.add('hidden');
    saveState();
    renderAll();
    showToast('Simulation reset successfully.', 'success');
  });

  document.getElementById('startSimulationBtn').addEventListener('click', startSimulation);
  document.getElementById('pauseSimulationBtn').addEventListener('click', pauseSimulation);
  document.getElementById('resumeSimulationBtn').addEventListener('click', resumeSimulation);
  document.getElementById('stepSimulationBtn').addEventListener('click', () => schedulerTick());

  document.getElementById('timeQuantumInput').addEventListener('change', () => {
    const value = Number(document.getElementById('timeQuantumInput').value) || 3;
    document.getElementById('timeQuantumInput').value = value;
    saveState();
  });

  document.getElementById('simulationSpeedInput').addEventListener('change', () => {
    const speed = Number(document.getElementById('simulationSpeedInput').value) || 1200;
    document.getElementById('simulationSpeedInput').value = speed;
    if (simulationRunning) {
      restartSimulationTimer();
    }
    saveState();
  });

  document.getElementById('guidedDemoBtn').addEventListener('click', runGuidedDemo);
}

function stopSimulation() {
  simulationRunning = false;
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  setSimulatorStatusText();
}

function startSimulation() {
  if (simulationRunning) {
    return;
  }

  const readyProcesses = processes.filter((process) => process.state === 'READY');
  if (!readyProcesses.length && !processes.some((process) => process.state === 'RUNNING')) {
    showToast('No ready or running process available to schedule.', 'info');
    return;
  }

  simulationRunning = true;
  addLog('simulation', 'Simulation started.', null);
  restartSimulationTimer();
  renderAll();
  showToast('Simulation started.', 'success');
}

function pauseSimulation() {
  if (!simulationRunning) {
    return;
  }
  simulationRunning = false;
  addLog('simulation', 'Simulation paused.', null);
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  renderAll();
  showToast('Simulation paused.', 'info');
}

function resumeSimulation() {
  if (simulationRunning) {
    return;
  }
  simulationRunning = true;
  addLog('simulation', 'Simulation resumed.', null);
  restartSimulationTimer();
  renderAll();
  showToast('Simulation resumed.', 'info');
}

function restartSimulationTimer() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
  }
  const intervalMs = Number(document.getElementById('simulationSpeedInput').value) || 1200;
  simulationTimer = setInterval(() => {
    if (simulationRunning) {
      schedulerTick();
    }
  }, intervalMs);
  setSimulatorStatusText();
}

function schedulerTick() {
  if (!simulationRunning) {
    return;
  }

  const runningProcess = processes.find((process) => process.state === 'RUNNING');
  if (!runningProcess) {
    const ready = processes.filter((process) => process.state === 'READY').sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    if (ready.length) {
      const next = ready[0];
      transitionProcess(next.id, 'RUNNING', 'Dispatched to CPU by round robin scheduler', 'cpu_dispatch');
    }
    return;
  }

  runningProcess.remainingBurst = Math.max(0, Number(runningProcess.remainingBurst) - 1);
  const quantum = Number(document.getElementById('timeQuantumInput').value) || 3;

  if (runningProcess.remainingBurst <= 0) {
    terminateProcess(runningProcess.id, 'CPU burst completed');
    const ready = processes.filter((process) => process.state === 'READY');
    if (ready.length) {
      const next = ready.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))[0];
      transitionProcess(next.id, 'RUNNING', 'Next ready process dispatched by round robin', 'cpu_dispatch');
    }
    return;
  }

  if (quantum <= 0 || (runningProcess.remainingBurst % quantum === 0 && runningProcess.remainingBurst !== runningProcess.burstTime)) {
    transitionProcess(runningProcess.id, 'READY', 'Time quantum expired; process returned to the ready queue', 'cpu_preemption');
    return;
  }

  if (processes.every((process) => process.state === 'TERMINATED')) {
    pauseSimulation();
    showToast('All processes terminated.', 'success');
  }

  renderAll();
}

function runGuidedDemo() {
  if (demoRunning) {
    return;
  }

  demoRunning = true;
  const demoSteps = [
    'Step 1: A new process is created in the NEW state.',
    'Step 2: The OS admits the process to the READY queue.',
    'Step 3: The scheduler dispatches the ready process to the CPU in RUNNING.',
    'Step 4: The process makes an I/O request and moves to WAITING.',
    'Step 5: When I/O completes, the process returns to READY.',
    'Step 6: The CPU completes the final burst and the process reaches TERMINATED.'
  ];

  const demoText = document.getElementById('demoStepText');
  let index = 0;

  const stepLoop = setInterval(() => {
    if (index >= demoSteps.length) {
      clearInterval(stepLoop);
      demoRunning = false;
      demoText.textContent = 'Guided demo complete. The process lifecycle has been explained step by step.';
      return;
    }
    demoText.textContent = demoSteps[index];
    index += 1;
  }, 1200);
}

function initializeFromStorage() {
  const stored = getStoredState();
  if (stored && stored.processes && stored.processes.length) {
    processes = stored.processes;
    logs = stored.logs || [];
    selectedProcessId = stored.selectedProcessId || processes[0]?.id || null;
    selectedStateView = stored.selectedStateView || 'READY';
    document.getElementById('timeQuantumInput').value = stored.timeQuantum || 3;
    document.getElementById('simulationSpeedInput').value = stored.simulationSpeed || 1200;
    return;
  }

  processes = createDefaultProcesses();
  logs = [{ timestamp: new Date().toISOString(), processId: null, eventType: 'simulation', description: 'Simulator initialized with sample processes.' }];
  selectedProcessId = processes[0]?.id || null;
  selectedStateView = 'READY';
}

function init() {
  initializeFromStorage();
  bindActions();
  renderAll();
}

window.processSimulator = {
  createProcess,
  transitionProcess,
  validateTransition,
  terminateProcess,
  getProcessStatistics,
  renderProcessTable,
  renderStateDiagram,
  addTransitionHistory,
  processes,
  logs,
  getSelectedProcess
};

document.addEventListener('DOMContentLoaded', init);
