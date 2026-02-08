(function () {
  'use strict';

  const STORAGE_KEY = 'airdrop-tracker-data';
  const STORAGE_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
  let CUSTOM_OPTIONS = {};
  let LAST_UPDATED_AT = 0; // Track when data was last updated

  function byId(id) {
    return document.getElementById(id);
  }

  function on(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return [value];
  }

  function ensureArrayOr(value, fallback) {
    const arr = ensureArray(value);
    if (arr.length) return arr;
    return Array.isArray(fallback) ? fallback.slice() : [];
  }

  function setModalState(modal, open) {
    if (!modal) return;
    modal.classList.toggle('open', open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (data && data.customOptions) {
        try { CUSTOM_OPTIONS = data.customOptions || {}; } catch (e) { CUSTOM_OPTIONS = {}; }
      }
      if (data && data.lastUpdatedAt) {
        LAST_UPDATED_AT = data.lastUpdatedAt;
      }
      const list = Array.isArray(data) ? data : (data.projects || []);
      const savedAt = data.savedAt || 0;
      if (savedAt && Date.now() - savedAt > STORAGE_EXPIRY_MS) return [];
      return normalizeProjects(list);
    } catch (e) {
      return [];
    }
  }

  function normalizeProjects(list) {
    return list.map(function (p) {
      const taskTypeSource = (p.taskType != null && p.taskType !== '') ? p.taskType : p.task;
      return {
        id: p.id,
        name: p.name || '',
        code: p.code || '',
        link: p.link || '',
        logo: p.logo || '',
        initial: (p.name && p.name.charAt(0)) ? p.name.charAt(0).toUpperCase() : '?',
        favorite: !!p.favorite,
        taskType: ensureArray(taskTypeSource),
        connectType: ensureArray(p.connectType),
        taskCost: p.taskCost != null ? p.taskCost : '0',
        taskTime: p.taskTime != null ? p.taskTime : '3',
        noActiveTasks: !!p.noActiveTasks,
        isNew: !!p.isNew,
        status: p.status || 'potential',
        statusDate: p.statusDate || '',
        rewardType: ensureArrayOr(p.rewardType, ['Airdrop']),
        raise: p.raise || null,
        raiseCount: p.raiseCount != null ? p.raiseCount : 0,
        logos: Array.isArray(p.logos) ? p.logos : [],
        lastEdited: p.lastEdited || p.createdAt || Date.now(),
      };
    });
  }

  function saveToLocalStorage() {
    try {
      const payload = { projects: PROJECTS, customOptions: CUSTOM_OPTIONS, lastUpdatedAt: LAST_UPDATED_AT, savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  let PROJECTS = loadFromLocalStorage();

  const STATUS_CONFIG = {
    reward: { label: 'Reward Available', class: 'reward' },
    potential: { label: 'Potential', class: 'potential' },
    confirmed: { label: 'Confirmed', class: 'confirmed' },
  };

  let filteredProjects = [];
  let sortKey = 'name';
  let sortDir = 'asc';
  let deleteConfirmId = null;
  let viewMode = 'all';

  const $tableBody = byId('tableBody');
  const $searchInput = byId('searchInput');
  const $taskFilter = byId('taskFilter');
  const $taskTypeFilter = byId('taskTypeFilter');
  const $statusFilter = byId('statusFilter');
  const $addAirdropBtn = byId('addAirdropBtn');
  const $airdropFormModal = byId('airdropFormModal');
  const $airdropForm = byId('airdropForm');
  const $airdropFormClose = byId('airdropFormClose');
  const $airdropFormCancel = byId('airdropFormCancel');
  const $airdropFormTitle = byId('airdropFormTitle');
  const $deleteConfirmModal = byId('deleteConfirmModal');
  const $deleteConfirmClose = byId('deleteConfirmClose');
  const $deleteConfirmCancel = byId('deleteConfirmCancel');
  const $deleteConfirmOk = byId('deleteConfirmOk');
  const $deleteConfirmMessage = byId('deleteConfirmMessage');
  const $removeFiltersBtn = byId('removeFiltersBtn');
  const $deleteAllBtn = byId('deleteAllBtn');
  const $manageOptionsBtn = byId('manageOptionsBtn');
  const $manageOptionsModal = byId('manageOptionsModal');
  const $manageOptionsForm = byId('manageOptionsForm');
  const $manageOptionsClose = byId('manageOptionsClose');
  const $manageOptionsCancel = byId('manageOptionsCancel');
  const $selectToManage = byId('selectToManage');
  const $optionsList = byId('optionsList');
  const $newOptionValue = byId('newOptionValue');
  const $newOptionText = byId('newOptionText');
  const $addOptionBtn = byId('addOptionBtn');
  const $manageOptionsSave = byId('manageOptionsSave');
  const $editOptionModal = byId('editOptionModal');
  const $editOptionForm = byId('editOptionForm');
  const $editOptionValue = byId('editOptionValue');
  const $editOptionText = byId('editOptionText');
  const $editOptionClose = byId('editOptionClose');
  const $editOptionCancel = byId('editOptionCancel');
  const $editOptionSave = byId('editOptionSave');
  const $deleteAllConfirmModal = byId('deleteAllConfirmModal');
  const $deleteAllConfirmClose = byId('deleteAllConfirmClose');
  const $deleteAllConfirmCancel = byId('deleteAllConfirmCancel');
  const $deleteAllConfirmOk = byId('deleteAllConfirmOk');
  const $exportBtn = byId('exportBtn');
  const $importBtn = byId('importBtn');
  const $importFileInput = byId('importFileInput');
  const $notificationModal = byId('notificationModal');
  const $notificationTitle = byId('notificationTitle');
  const $notificationMessage = byId('notificationMessage');
  const $notificationClose = byId('notificationClose');
  const $notificationOk = byId('notificationOk');
  const $lastUpdatedTime = byId('lastUpdatedTime');

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : minutes + ' minutes ago';
    if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';
    if (days < 7) return days === 1 ? '1 day ago' : days + ' days ago';
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  }

  function updateLastUpdatedTime() {
    LAST_UPDATED_AT = Date.now();
    if ($lastUpdatedTime) {
      $lastUpdatedTime.textContent = formatRelativeTime(LAST_UPDATED_AT);
    }
    saveToLocalStorage();
  }

  function updateLastUpdatedDisplay() {
    if ($lastUpdatedTime) {
      $lastUpdatedTime.textContent = formatRelativeTime(LAST_UPDATED_AT);
    }
  }


  function getNextId() {
    return PROJECTS.length ? Math.max.apply(null, PROJECTS.map(function (p) { return p.id; })) + 1 : 1;
  }

  function projectToFormData(p) {
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      link: p.link || '',
      taskType: ensureArray(p.taskType).slice(),
      noActiveTasks: p.noActiveTasks,
      isNew: p.isNew,
      connectType: ensureArray(p.connectType).slice(),
      taskCost: p.taskCost != null ? p.taskCost : '',
      taskTime: p.taskTime != null ? p.taskTime : '',
      status: p.status || 'potential',
      statusDate: p.statusDate || '',
      rewardType: ensureArrayOr(p.rewardType, ['Airdrop']).slice(),
      raise: p.raise || '',
      raiseCount: p.raiseCount != null ? p.raiseCount : 0,
    };
  }

  function formDataToProject(data, existingId) {
    const id = existingId || getNextId();
    const name = (data.name || '').trim();
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    const noActive = !!data.noActiveTasks;
    const now = Date.now();
    return {
      id: id,
      name: name,
      code: (data.code || '').trim(),
      link: (data.link || '').trim() || null,
      logo: null,
      initial: initial,
      favorite: existingId ? (PROJECTS.find(function (p) { return p.id === existingId; }) || {}).favorite : false,
      taskType: ensureArray(data.taskType),
      connectType: ensureArray(data.connectType),
      taskCost: data.taskCost !== '' && data.taskCost != null ? Number(data.taskCost) : 0,
      taskTime: data.taskTime !== '' && data.taskTime != null ? Number(data.taskTime) : 3,
      noActiveTasks: noActive,
      isNew: !!data.isNew,
      status: data.status || 'potential',
      statusDate: (data.statusDate || '').trim() || '',
      rewardType: ensureArrayOr(data.rewardType, ['Airdrop']),
      raise: (data.raise || '').trim() || null,
      raiseCount: data.raiseCount != null ? Number(data.raiseCount) : 0,
      logos: existingId ? (PROJECTS.find(function (p) { return p.id === existingId; }) || {}).logos : [],
      lastEdited: now,
    };
  }

  function addProject(data) {
    const p = formDataToProject(data, null);
    PROJECTS.push(p);
    updateLastUpdatedTime();
    applyFiltersFromState();
  }

  function updateProject(id, data) {
    const idx = PROJECTS.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    const existing = PROJECTS[idx];
    const p = formDataToProject(data, id);
    p.favorite = existing.favorite;
    p.logos = existing.logos;
    PROJECTS[idx] = p;
    updateLastUpdatedTime();
    applyFiltersFromState();
  }

  function deleteProject(id) {
    const idx = PROJECTS.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    PROJECTS.splice(idx, 1);
    updateLastUpdatedTime();
    applyFiltersFromState();
  }

  function deleteAllProjects() {
    setModalState($deleteAllConfirmModal, true);
  }

  function closeDeleteAllConfirmModal() {
    setModalState($deleteAllConfirmModal, false);
  }

  function handleDeleteAllConfirm() {
    PROJECTS = [];
    updateLastUpdatedTime();
    applyFiltersFromState();
    closeDeleteAllConfirmModal();
  }

  function renderProjectRow(p) {
    const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.potential;
    function getOptionText(selectId, val) {
      try {
        const sel = byId(selectId);
        if (!sel) return val || '';
        const opt = Array.from(sel.options).find(function(o){ return o.value === val; });
        return opt ? opt.text : (val != null ? String(val) : '');
      } catch (e) { return val || ''; }
    }

    const taskTypeDisplay = (p.taskType && p.taskType.length) ? p.taskType.map(function(t){ return String(t).charAt(0).toUpperCase() + String(t).slice(1); }).join(', ') : '—';
    const connectTypeDisplay = (p.connectType && p.connectType.length) ? p.connectType.map(function(c){
      // Use the display text from the form select if available to preserve casing
      const txt = getOptionText('airdropConnectType', c);
      return txt || String(c).toUpperCase();
    }).join(', ') : '—';
    
    // Get status label from select options (respects custom edits)
    const statusLabel = getOptionText('airdropStatus', p.status) || statusCfg.label;
    
    // Get reward type labels from select options (respects custom edits)
    const rewardTypeDisplay = (p.rewardType && p.rewardType.length) ? p.rewardType.map(function(r){
      const txt = getOptionText('airdropRewardType', r);
      return txt || r;
    }).join(', ') : '—';
    
    const taskCellContent = p.noActiveTasks
      ? `<span class="no-tasks">No active tasks</span>`
      : `
        <span class="task-meta">
          <span class="cost">Cost: $${p.taskCost}</span>
          <span class="time">Time: ${p.taskTime} min</span>
        </span>
        <span class="task-desc">${connectTypeDisplay}</span>
      `;
    const raiseCell = p.raise
      ? `
        <span class="raise-amount">$ ${p.raise}</span>
        ${p.logos && p.logos.length ? `<div class="raise-avatars">${p.logos.map((_, i) => `<span class="placeholder-logo" style="width:24px;height:24px;font-size:0.7rem;margin-left:${i === 0 ? 0 : -8}px">${String.fromCharCode(65 + i)}</span>`).join('')}</div>` : ''}
        <span class="raise-count">+${p.raiseCount}</span>
      `
      : p.raiseCount > 0
        ? `
          <div class="raise-avatars">${(p.logos || []).map((_, i) => `<span class="placeholder-logo" style="width:24px;height:24px;font-size:0.7rem;margin-left:${i === 0 ? 0 : -8}px">${String.fromCharCode(65 + i)}</span>`).join('')}</div>
          <span class="raise-count">+${p.raiseCount}</span>
        `
        : '—';

    return `
      <tr data-id="${p.id}">
        <td class="col-name">
          <div class="cell-name">
            <button type="button" class="star-btn ${p.favorite ? 'favorited' : ''}" aria-label="Toggle favorite" data-id="${p.id}">
              <i class="${p.favorite ? 'fas' : 'far'} fa-star"></i>
            </button>
            <div class="project-info">
              <a href="${p.link || '#'}" target="_blank" rel="noopener noreferrer" class="project-link" ${!p.link ? 'onclick="return false"' : ''}>
                <div class="name">${p.name} <span class="code">${p.code}</span></div>
              </a>
              
            </div>
          </div>
        </td>
        <td class="col-task">
          <div class="cell-task">
            <span class="task-badge">${taskTypeDisplay}</span>
          </div>
        </td>
        <td class="col-tasktype">
          <div class="cell-tasktype">${taskCellContent}</div>
        </td>
        <td class="col-status">
          <div class="status-cell">
            <span class="status-label ${statusCfg.class}">${statusLabel}</span>
            <span class="status-date">${p.statusDate}</span>
          </div>
        </td>
        <td class="col-reward"><span class="reward-type">${rewardTypeDisplay}</span></td>
        <td class="col-raise"><div class="raise-cell">${raiseCell}</div></td>
        <td class="col-actions">
          <div class="cell-actions">
            <button type="button" class="btn-action edit" aria-label="Edit" data-id="${p.id}" data-action="edit"><i class="fas fa-pen"></i></button>
            <button type="button" class="btn-action delete" aria-label="Delete" data-id="${p.id}" data-action="delete"><i class="fas fa-trash-alt"></i></button>
          </div>
        </td>
      </tr>
    `;
  }

  function applyFiltersFromState() {
    const search = ($searchInput && $searchInput.value || '').trim().toLowerCase();
    const taskType = $taskFilter && $taskFilter.value || '';
    const connectType = $taskTypeFilter && $taskTypeFilter.value || '';
    const status = $statusFilter && $statusFilter.value || '';
    filteredProjects = PROJECTS.filter(function (p) {
      if (search) {
        const match = (p.name + ' ' + p.code).toLowerCase().includes(search);
        if (!match) return false;
      }
      if (taskType) {
        if (!p.taskType || !Array.isArray(p.taskType) || !p.taskType.includes(taskType)) return false;
      }
      if (connectType) {
        if (p.noActiveTasks) return false;
        if (!p.connectType || !Array.isArray(p.connectType) || !p.connectType.includes(connectType)) return false;
      }
      if (status && p.status !== status) return false;

      return true;
    });

    if (viewMode === 'newTasks') {
      filteredProjects.sort(function (a, b) {
        const ta = a.lastEdited || 0;
        const tb = b.lastEdited || 0;
        return tb - ta;
      });
    } else {
      sortProjects();
    }
    renderTable();
  }

  function sortProjects() {
    filteredProjects.sort(function (a, b) {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'name' || sortKey === 'code') {
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
        return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      }
      if (sortKey === 'raise') {
        va = parseFloat(String(a.raise || '0').replace(/[^0-9.]/g, '')) || 0;
        vb = parseFloat(String(b.raise || '0').replace(/[^0-9.]/g, '')) || 0;
        return sortDir === 'asc' ? (va - vb) : (vb - va);
      }
      if (sortKey === 'status' || sortKey === 'reward') {
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
        return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      }
      return 0;
    });
  }

  function renderTable() {
    if (!$tableBody) return;
    $tableBody.innerHTML = filteredProjects.map(renderProjectRow).join('');
  }

  function handleTableClick(e) {
    if (!$tableBody || !e.target || typeof e.target.closest !== 'function') return;
    const starBtn = e.target.closest('.star-btn');
    if (starBtn && $tableBody.contains(starBtn)) {
      const id = parseInt(starBtn.getAttribute('data-id'), 10);
      const p = PROJECTS.find(function (x) { return x.id === id; });
      if (p) {
        p.favorite = !p.favorite;
        applyFiltersFromState();
      }
      return;
    }

    const actionBtn = e.target.closest('.btn-action');
    if (actionBtn && $tableBody.contains(actionBtn)) {
      const id = parseInt(actionBtn.getAttribute('data-id'), 10);
      const action = actionBtn.getAttribute('data-action');
      if (action === 'edit') openAirdropFormForEdit(id);
      if (action === 'delete') openDeleteConfirmModal(id);
    }
  }

  function syncFilterOptionsWithForm() {
    // Sync Task Type options from airdropTaskType to taskFilter
    const $airdropTaskType = byId('airdropTaskType');
    if ($airdropTaskType && $taskFilter) {
      const formOptions = Array.from($airdropTaskType.options).map(function(opt) {
        return { value: opt.value, text: opt.text };
      });
      const currentFilterValue = $taskFilter.value;
      
      // Clear existing options (keep the empty option)
      while ($taskFilter.options.length > 1) {
        $taskFilter.remove(1);
      }
      
      // Add options from form
      formOptions.forEach(function(opt) {
        if (opt.value) { // Skip empty option
          const option = document.createElement('option');
          option.value = opt.value;
          option.text = opt.text;
          $taskFilter.appendChild(option);
        }
      });
      
      // Restore previous selection if it still exists
      $taskFilter.value = currentFilterValue;
      // ensure header filter is alphabetically ordered
      sortSelectElement('taskFilter');
    }

    // Sync Connect Type options from airdropConnectType to taskTypeFilter
    const $airdropConnectType = byId('airdropConnectType');
    if ($airdropConnectType && $taskTypeFilter) {
      const formOptions = Array.from($airdropConnectType.options).map(function(opt) {
        return { value: opt.value, text: opt.text };
      });
      const currentFilterValue = $taskTypeFilter.value;
      
      while ($taskTypeFilter.options.length > 1) {
        $taskTypeFilter.remove(1);
      }
      
      formOptions.forEach(function(opt) {
        if (opt.value) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.text = opt.text;
          $taskTypeFilter.appendChild(option);
        }
      });
      
      $taskTypeFilter.value = currentFilterValue;
      sortSelectElement('taskTypeFilter');
    }

    // Sync Status options from airdropStatus to statusFilter
    const $airdropStatus = byId('airdropStatus');
    if ($airdropStatus && $statusFilter) {
      const formOptions = Array.from($airdropStatus.options).map(function(opt) {
        return { value: opt.value, text: opt.text };
      });
      const currentFilterValue = $statusFilter.value;
      
      while ($statusFilter.options.length > 1) {
        $statusFilter.remove(1);
      }
      
      formOptions.forEach(function(opt) {
        if (opt.value) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.text = opt.text;
          $statusFilter.appendChild(option);
        }
      });
      
      $statusFilter.value = currentFilterValue;
      sortSelectElement('statusFilter');
    }

    // Sync Reward Type options from airdropRewardType (collect from actual data)
    const $airdropRewardType = byId('airdropRewardType');
    if ($airdropRewardType) {
      const rewardTypeOptions = Array.from($airdropRewardType.options).map(function(opt) {
        return { value: opt.value, text: opt.text };
      });
      // Note: Reward Type is used in data but not exposed as a filter dropdown in header currently
      // This function sets up the infrastructure for it if added later
    }
  }

  function applyCustomOptionsToSelect(id) {
    if (!CUSTOM_OPTIONS || !CUSTOM_OPTIONS[id]) return;
    const selectEl = byId(id);
    if (!selectEl) return;
    // keep the first empty option if present
    const keepEmpty = selectEl.options.length && selectEl.options[0].value === '';
    selectEl.innerHTML = '';
    if (keepEmpty) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.text = selectEl.getAttribute('data-empty-text') || '';
      selectEl.appendChild(empty);
    }
    // sort custom options alphabetically by display text
    var sorted = (CUSTOM_OPTIONS[id] || []).slice().sort(function(a,b){
      return String(a.text).localeCompare(String(b.text), 'en', { sensitivity: 'base' });
    });
    sorted.forEach(function(o) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.text = o.text;
      selectEl.appendChild(opt);
    });
    // rebuild custom widget if present
    try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
  }

  // Sort DOM select element options alphabetically (preserve empty first option if present)
  function sortSelectElement(selectId) {
    var sel = byId(selectId);
    if (!sel) return;
    var empty = null;
    var items = [];
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (i === 0 && o.value === '') { empty = { value: o.value, text: o.text }; }
      else items.push({ value: o.value, text: o.text });
    }
    items.sort(function(a, b) { return String(a.text).localeCompare(String(b.text), 'en', { sensitivity: 'base' }); });
    var cur = sel.value;
    var curMulti = sel.multiple ? Array.from(sel.selectedOptions).map(function(opt) { return opt.value; }) : null;
    sel.innerHTML = '';
    if (empty) {
      var e = document.createElement('option'); e.value = empty.value; e.text = empty.text; sel.appendChild(e);
    }
    items.forEach(function(it) { var opt = document.createElement('option'); opt.value = it.value; opt.text = it.text; sel.appendChild(opt); });
    // restore selection if still present
    try {
      if (sel.multiple && curMulti) {
        Array.from(sel.options).forEach(function(opt) { opt.selected = curMulti.indexOf(opt.value) >= 0; });
      } else {
        sel.value = cur;
      }
    } catch (e) {}
  }

  function sortAllSelects() {
    var ids = ['airdropTaskType','airdropConnectType','airdropStatus','taskFilter','taskTypeFilter','statusFilter','selectToManage'];
    ids.forEach(function(id){ sortSelectElement(id); });
  }

  function initCustomOptions() {
    var ids = ['airdropTaskType','airdropConnectType','airdropStatus','airdropRewardType'];
    ids.forEach(function(id) {
      if (CUSTOM_OPTIONS && CUSTOM_OPTIONS[id]) {
        applyCustomOptionsToSelect(id);
      }
    });
    // ensure selects are sorted after applying custom options
    sortAllSelects();
  }

  let manageOptionsCurrentSelect = null;
  let editOptionCurrentValue = null; // Track which option is being edited

  function openManageOptionsModal() {
    if (!$manageOptionsModal) return;
    manageOptionsCurrentSelect = null;
    $selectToManage.value = '';
    $optionsList.innerHTML = '';
    $newOptionValue.value = '';
    $newOptionText.value = '';
    setModalState($manageOptionsModal, true);
  }

  function closeManageOptionsModal() {
    setModalState($manageOptionsModal, false);
  }

  function renderOptionsList() {
    if (!$selectToManage.value) {
      $optionsList.innerHTML = '<p style="color: #999; font-size: 0.9rem;">Select a field to manage its options</p>';
      return;
    }

    const selectEl = byId($selectToManage.value);
    if (!selectEl) return;

    manageOptionsCurrentSelect = selectEl;
    const options = Array.from(selectEl.options).filter(function(opt) { 
      return opt.value !== ''; // Skip empty option
    });

    $optionsList.innerHTML = options.map(function(opt, idx) {
      return '<div class="option-item" data-opt-index="' + idx + '">' +
        '<span><strong>' + escapeHtml(opt.text) + '</strong> <span style="color: #999; font-size: 0.85rem;">(' + escapeHtml(opt.value) + ')</span></span>' +
        '<div class="option-actions">' +
        '<button type="button" class="btn-edit-option" data-value="' + escapeHtml(opt.value) + '" title="Edit">' +
        '<i class="fas fa-pen"></i>' +
        '</button>' +
        '<button type="button" class="btn-remove-option" data-value="' + escapeHtml(opt.value) + '" title="Delete">' +
        '<i class="fas fa-trash-alt"></i>' +
        '</button>' +
        '</div>' +
        '</div>';
    }).join('');

    // Attach edit handlers
    $optionsList.querySelectorAll('.btn-edit-option').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var val = btn.getAttribute('data-value');
        var opt = Array.from(manageOptionsCurrentSelect.options).find(function(o) { return o.value === val; });
        if (opt) openEditOptionModal(opt.value, opt.text);
      });
    });

    // Attach remove handlers (remove by value to avoid index mismatch)
    $optionsList.querySelectorAll('.btn-remove-option').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var val = btn.getAttribute('data-value');
        if (manageOptionsCurrentSelect && val) {
          // find option index by value
          var opts = Array.from(manageOptionsCurrentSelect.options);
          var foundIndex = opts.findIndex(function(o) { return o.value === val; });
          if (foundIndex >= 0) {
            manageOptionsCurrentSelect.remove(foundIndex);
            renderOptionsList();
          }
        }
      });
    });
  }

  function openEditOptionModal(oldValue, oldText) {
    editOptionCurrentValue = oldValue;
    if ($editOptionValue) $editOptionValue.value = oldValue;
    if ($editOptionText) $editOptionText.value = oldText;
    setModalState($editOptionModal, true);
    if ($editOptionValue) $editOptionValue.focus();
  }

  function closeEditOptionModal() {
    setModalState($editOptionModal, false);
    editOptionCurrentValue = null;
  }

  function handleEditOptionSave() {
    var newValue = ($editOptionValue && $editOptionValue.value || '').trim();
    var newText = ($editOptionText && $editOptionText.value || '').trim();

    if (!newValue || !newText) {
      showNotification('Error', 'Value and text cannot be empty.');
      return;
    }

    // Update the option in the select element
    if (manageOptionsCurrentSelect && editOptionCurrentValue) {
      var opt = Array.from(manageOptionsCurrentSelect.options).find(function(o) { return o.value === editOptionCurrentValue; });
      if (opt) {
        opt.value = newValue;
        opt.text = newText;
        
        // Update CUSTOM_OPTIONS immediately to sync with storage
        var id = manageOptionsCurrentSelect.id;
        if (CUSTOM_OPTIONS && CUSTOM_OPTIONS[id]) {
          var idx = CUSTOM_OPTIONS[id].findIndex(function(o) { return o.value === editOptionCurrentValue; });
          if (idx >= 0) {
            CUSTOM_OPTIONS[id][idx].value = newValue;
            CUSTOM_OPTIONS[id][idx].text = newText;
          }
        }
        
        // Refresh custom widgets and re-render table
        try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch(e) {}
        applyFiltersFromState(); // Re-render table to show updated option names
        
        renderOptionsList(); // Re-render options list to show changes
        closeEditOptionModal();
      }
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function openAirdropFormModal() {
    if (!$airdropFormModal) return;
    syncFilterOptionsWithForm();
    // Refresh custom multi-select widgets to ensure proper isolation
    try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
    setModalState($airdropFormModal, true);
  }

  function closeAirdropFormModal() {
    setModalState($airdropFormModal, false);
    hideAirdropFormError();
  }

  function getAirdropFormData() {
    const idEl = byId('airdropId');
    const nameEl = byId('airdropName');
    const codeEl = byId('airdropCode');
    const linkEl = byId('airdropLink');
    const taskTypeEl = byId('airdropTaskType');
    const noTasksEl = byId('airdropNoTasks');
    const isNewEl = byId('airdropIsNew');
    const connectTypeEl = byId('airdropConnectType');
    const taskCostEl = byId('airdropTaskCost');
    const taskTimeEl = byId('airdropTaskTime');
    const statusEl = byId('airdropStatus');
    const statusDateEl = byId('airdropStatusDate');
    const rewardTypeEl = byId('airdropRewardType');
    const raiseEl = byId('airdropRaise');
    const raiseCountEl = byId('airdropRaiseCount');
    const idVal = idEl && idEl.value ? parseInt(idEl.value, 10) : null;
    return {
      id: idVal,
      name: nameEl ? nameEl.value : '',
      code: codeEl ? codeEl.value.toUpperCase() : '',
      link: linkEl ? linkEl.value : '',
      taskType: taskTypeEl ? (taskTypeEl.multiple ? Array.from(taskTypeEl.selectedOptions).map(function(o){ return o.value; }) : taskTypeEl.value) : [],
      noActiveTasks: noTasksEl ? noTasksEl.checked : false,
      isNew: isNewEl ? isNewEl.checked : false,
      connectType: connectTypeEl ? (connectTypeEl.multiple ? Array.from(connectTypeEl.selectedOptions).map(function(o){ return o.value; }) : connectTypeEl.value) : [],
      taskCost: taskCostEl ? taskCostEl.value : '0',
      taskTime: taskTimeEl ? taskTimeEl.value : '3',
      status: statusEl ? statusEl.value : 'potential',
      statusDate: statusDateEl ? statusDateEl.value : '',
      rewardType: rewardTypeEl ? (rewardTypeEl.multiple ? Array.from(rewardTypeEl.selectedOptions).map(function(o){ return o.value; }) : rewardTypeEl.value) : ['Airdrop'],
      raise: raiseEl ? raiseEl.value : '',
      raiseCount: raiseCountEl ? (raiseCountEl.value !== '' ? Number(raiseCountEl.value) : 0) : 0,
    };
  }

  function setAirdropFormData(data) {
    const set = function (id, value) {
      const el = byId(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!value;
      else if (el.multiple) {
        // value expected to be an array
        var vals = Array.isArray(value) ? value : (value != null && value !== '' ? [String(value)] : []);
        Array.from(el.options).forEach(function(o){ o.selected = vals.indexOf(o.value) >= 0; });
      } else el.value = value != null ? value : '';
    };
    set('airdropId', data.id);
    set('airdropName', data.name);
    set('airdropCode', data.code);
    set('airdropLink', data.link);
    set('airdropTaskType', data.taskType);
    set('airdropNoTasks', data.noActiveTasks);
    set('airdropIsNew', data.isNew);
    set('airdropConnectType', data.connectType);
    set('airdropTaskCost', data.taskCost);
    set('airdropTaskTime', data.taskTime);
    set('airdropStatus', data.status);
    set('airdropStatusDate', data.statusDate);
    set('airdropRewardType', data.rewardType && Array.isArray(data.rewardType) ? data.rewardType : (data.rewardType ? [data.rewardType] : ['Airdrop']));
    set('airdropRaise', data.raise);
    set('airdropRaiseCount', data.raiseCount);
  }

  function resetAirdropForm() {
    setAirdropFormData({
      id: '',
      name: '',
      code: '',
      link: '',
      taskType: '',
      noActiveTasks: false,
      isNew: false,
      connectType: '',
      taskCost: '',
      taskTime: '',
      status: 'potential',
      statusDate: '',
      rewardType: ['Airdrop'],
      raise: '',
      raiseCount: 0,
    });
  }

  function openAirdropFormForEdit(id) {
    const p = PROJECTS.find(function (x) { return x.id === id; });
    if (!p) return;
    if ($airdropFormTitle) $airdropFormTitle.textContent = 'Edit Airdrop';
    setAirdropFormData(projectToFormData(p));
    hideAirdropFormError();
    openAirdropFormModal();
  }

  function handleAirdropFormSubmit(e) {
    e.preventDefault();
    const data = getAirdropFormData();
    // Validate duplicate name (case-insensitive) for new entries
    var nameVal = (data.name || '').trim();
    if (!nameVal) {
      showAirdropFormError('Name is required');
      return;
    }
    var exists = PROJECTS.some(function (p) {
      return p.name && p.name.toLowerCase() === nameVal.toLowerCase() && p.id !== data.id;
    });
    if (exists) {
      showAirdropFormError('Already added');
      return;
    }

    if (data.id) {
      updateProject(data.id, data);
    } else {
      addProject(data);
    }
    hideAirdropFormError();
    syncFilterOptionsWithForm();
    closeAirdropFormModal();
  }

  function showAirdropFormError(msg) {
    try {
      const el = byId('airdropFormError');
      if (!el) {
        showNotification('Error', msg);
        return;
      }
      el.textContent = msg;
      el.classList.remove('is-hidden');
      el.style.display = 'block';
    } catch (e) {
      console.error(e);
    }
  }

  function hideAirdropFormError() {
    try {
      const el = byId('airdropFormError');
      if (!el) return;
      el.textContent = '';
      el.classList.add('is-hidden');
      el.style.display = 'none';
    } catch (e) {}
  }

  function showNotification(title, message) {
    if (!$notificationModal) return;
    if ($notificationTitle) $notificationTitle.textContent = title;
    if ($notificationMessage) $notificationMessage.textContent = message;
    setModalState($notificationModal, true);
  }

  function closeNotificationModal() {
    setModalState($notificationModal, false);
  }

  function openDeleteConfirmModal(id) {
    const p = PROJECTS.find(function (x) { return x.id === id; });
    if (!p) return;
    deleteConfirmId = id;
    if ($deleteConfirmMessage) {
      $deleteConfirmMessage.textContent = 'Remove "' + p.name + '" from the list? This cannot be undone.';
    }
    setModalState($deleteConfirmModal, true);
  }

  function closeDeleteConfirmModal() {
    deleteConfirmId = null;
    setModalState($deleteConfirmModal, false);
  }

  function handleDeleteConfirm() {
    if (deleteConfirmId != null) {
      deleteProject(deleteConfirmId);
      closeDeleteConfirmModal();
    }
  }

  function removeFilters() {
    if ($taskFilter) {
      $taskFilter.value = '';
      $taskFilter.dispatchEvent(new Event('change'));
    }
    if ($taskTypeFilter) {
      $taskTypeFilter.value = '';
      $taskTypeFilter.dispatchEvent(new Event('change'));
    }
    if ($statusFilter) {
      $statusFilter.value = '';
      $statusFilter.dispatchEvent(new Event('change'));
    }
    if ($searchInput) {
      $searchInput.value = '';
      $searchInput.dispatchEvent(new Event('input'));
    }
    applyFiltersFromState();
  }

  function exportData() {
    const payload = { projects: PROJECTS, customOptions: CUSTOM_OPTIONS || {}, lastUpdatedAt: LAST_UPDATED_AT, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airdrop-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(parsed) {
    const list = Array.isArray(parsed) ? parsed : (parsed && parsed.projects) ? parsed.projects : [];
    // import custom options if present
    if (parsed && parsed.customOptions) {
      try { CUSTOM_OPTIONS = parsed.customOptions || {}; } catch (e) { CUSTOM_OPTIONS = {}; }
    }
    // import lastUpdatedAt if present
    if (parsed && parsed.lastUpdatedAt) {
      LAST_UPDATED_AT = parsed.lastUpdatedAt;
    }
    if (!list.length) return;
    PROJECTS = normalizeProjects(list);
    // apply custom options to selects then persist
    initCustomOptions();
    syncFilterOptionsWithForm();
    updateLastUpdatedDisplay();
    saveToLocalStorage();
    applyFiltersFromState();
  }

  function handleImportFile(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const parsed = JSON.parse(ev.target.result);
        importData(parsed);
      } catch (err) {
        showNotification('Import Error', 'Invalid JSON file. Please check the file format.');
      }
      if ($importFileInput) $importFileInput.value = '';
    };
    reader.readAsText(file);
  }

  // --- Custom multi-select UI (checkbox-style) ---
  function createOrUpdateCustomMultiSelect(id) {
    var sel = byId(id);
    if (!sel || !sel.multiple) return; // Only for multiple selects
    
    // remove previous widget if present
    var existing = sel.parentNode.querySelector('.custom-multiselect[data-select-id="' + id + '"]');
    if (existing) existing.remove();

    // hide native select visually but keep it in DOM for form data
    sel.style.display = 'none';

    var wrapper = document.createElement('div');
    wrapper.className = 'custom-multiselect';
    wrapper.setAttribute('data-select-id', id); // Mark which select this widget belongs to

    var display = document.createElement('button');
    display.type = 'button';
    display.className = 'cms-display';
    display.setAttribute('aria-haspopup', 'listbox');

    var valuesSpan = document.createElement('div');
    valuesSpan.className = 'cms-values';
    display.appendChild(valuesSpan);

    var caret = document.createElement('span');
    caret.className = 'cms-caret';
    caret.innerHTML = '&#x25BE;';
    display.appendChild(caret);

    var dropdown = document.createElement('div');
    dropdown.className = 'cms-dropdown';
    dropdown.style.display = 'none'; // Hidden by default

    wrapper.appendChild(display);
    wrapper.appendChild(dropdown);

    // build items
    function rebuild() {
      dropdown.innerHTML = '';
      var opts = Array.from(sel.options || []);
      var emptyText = '';
      opts.forEach(function(o, i) {
        if (i === 0 && o.value === '') emptyText = o.text;
      });
      var nonEmpty = opts.filter(function(o){ return o.value !== ''; });
      if (!nonEmpty.length) {
        var pe = document.createElement('div');
        pe.className = 'cms-empty';
        pe.textContent = emptyText || 'No options';
        dropdown.appendChild(pe);
      } else {
        nonEmpty.forEach(function(o){
          var item = document.createElement('div');
          item.className = 'cms-item';
          item.setAttribute('data-value', o.value);
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!o.selected;
          cb.tabIndex = -1;
          var lbl = document.createElement('span');
          lbl.className = 'cms-label';
          lbl.textContent = o.text;
          item.appendChild(cb);
          item.appendChild(lbl);
          // click toggles
          item.addEventListener('click', function(e){
            e.stopPropagation();
            var val = item.getAttribute('data-value');
            var matching = Array.from(sel.options).find(function(x){ return x.value === val; });
            if (!matching) return;
            matching.selected = !matching.selected;
            cb.checked = matching.selected;
            // trigger native change
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            updateDisplay();
          });
          dropdown.appendChild(item);
        });
      }
    }

    function updateDisplay() {
      var selected = Array.from(sel.selectedOptions || []).filter(function(o){ return o.value !== ''; });
      if (selected.length) {
        valuesSpan.textContent = selected.map(function(o){ return o.text; }).join(', ');
      } else {
        // show placeholder from first empty option
        var placeholder = (sel.options && sel.options[0] && sel.options[0].value === '') ? sel.options[0].text : '—';
        valuesSpan.textContent = placeholder;
      }
      // update checkboxes in dropdown to reflect current selection
      Array.from(dropdown.querySelectorAll('.cms-item')).forEach(function(it){
        var v = it.getAttribute('data-value');
        var opt = Array.from(sel.options).find(function(o){ return o.value === v; });
        var cb = it.querySelector('input[type="checkbox"]');
        if (opt && cb) cb.checked = !!opt.selected;
      });
    }

    // toggle dropdown
    display.addEventListener('click', function(e){
      e.stopPropagation();
      var open = wrapper.classList.toggle('open');
      dropdown.style.display = open ? 'block' : 'none';
    });

    // when underlying select changes (external updates), rebuild and update
    sel.addEventListener('change', function(){ rebuild(); updateDisplay(); });

    // close on outside click
    document.addEventListener('click', function closeHandler(){
      if (wrapper.classList.contains('open')) {
        wrapper.classList.remove('open');
        dropdown.style.display = 'none';
      }
    });

    // insert after select
    sel.parentNode.insertBefore(wrapper, sel.nextSibling);
    rebuild();
    updateDisplay();
  }

  function refreshCustomMultiSelects() {
    ['airdropTaskType','airdropConnectType','airdropRewardType'].forEach(function(id){ createOrUpdateCustomMultiSelect(id); });
  }


  function initSort() {
    document.querySelectorAll('.data-table th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        const key = th.getAttribute('data-sort');
        if (!key) return;
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else {
          sortKey = key;
          sortDir = key === 'name' ? 'asc' : 'desc';
        }
        sortProjects();
        renderTable();
      });
    });
  }

  on($searchInput, 'input', applyFiltersFromState);
  on($taskFilter, 'change', applyFiltersFromState);
  on($taskTypeFilter, 'change', applyFiltersFromState);
  on($statusFilter, 'change', applyFiltersFromState);
  on($tableBody, 'click', handleTableClick);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($airdropFormModal && $airdropFormModal.classList.contains('open')) closeAirdropFormModal();
    else if ($deleteConfirmModal && $deleteConfirmModal.classList.contains('open')) closeDeleteConfirmModal();
  });

  on($addAirdropBtn, 'click', function () {
    resetAirdropForm();
    if ($airdropFormTitle) $airdropFormTitle.textContent = 'Add Airdrop';
    hideAirdropFormError();
    openAirdropFormModal();
  });
  on($airdropForm, 'submit', handleAirdropFormSubmit);
  on($airdropFormClose, 'click', closeAirdropFormModal);
  on($airdropFormCancel, 'click', closeAirdropFormModal);
  $airdropFormModal && $airdropFormModal.addEventListener('click', function (e) {
    if (e.target === $airdropFormModal) closeAirdropFormModal();
  });
  on($deleteConfirmClose, 'click', closeDeleteConfirmModal);
  on($deleteConfirmCancel, 'click', closeDeleteConfirmModal);
  on($deleteConfirmOk, 'click', handleDeleteConfirm);
  $deleteConfirmModal && $deleteConfirmModal.addEventListener('click', function (e) {
    if (e.target === $deleteConfirmModal) closeDeleteConfirmModal();
  });

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('tab-active'); });
      tab.classList.add('tab-active');
      viewMode = tab.getAttribute('data-tab') === 'newTasks' ? 'newTasks' : 'all';
      applyFiltersFromState();
    });
  });

  on($removeFiltersBtn, 'click', removeFilters);
  on($deleteAllBtn, 'click', deleteAllProjects);
  on($manageOptionsBtn, 'click', openManageOptionsModal);
  on($selectToManage, 'change', renderOptionsList);
  on($addOptionBtn, 'click', function(e) {
    e.preventDefault();
    const value = ($newOptionValue.value || '').trim();
    const text = ($newOptionText.value || '').trim();
    if (!value || !text) {
      showNotification('Missing Fields', 'Please enter both value and display text.');
      return;
    }
    if (manageOptionsCurrentSelect) {
      const option = document.createElement('option');
      option.value = value;
      option.text = text;
      manageOptionsCurrentSelect.appendChild(option);
      $newOptionValue.value = '';
      $newOptionText.value = '';
      renderOptionsList();
    }
  });
  on($manageOptionsSave, 'click', function(e) {
    e.preventDefault();
    if (manageOptionsCurrentSelect) {
      var id = manageOptionsCurrentSelect.id;
      var arr = Array.from(manageOptionsCurrentSelect.options).filter(function(o){ return o.value !== ''; }).map(function(o){ return { value: o.value, text: o.text }; });
      // sort new options alphabetically A→Z by display text
      arr.sort(function(a,b){ return String(a.text).localeCompare(String(b.text), 'en', { sensitivity: 'base' }); });
      CUSTOM_OPTIONS[id] = arr;
      saveToLocalStorage();
      syncFilterOptionsWithForm();
      // Refresh custom widgets and re-render table with updated options
      try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch(e) {}
      applyFiltersFromState(); // Update table display with new option values
    }
    closeManageOptionsModal();
  });
  on($manageOptionsClose, 'click', closeManageOptionsModal);
  on($manageOptionsCancel, 'click', closeManageOptionsModal);
  on($editOptionClose, 'click', closeEditOptionModal);
  on($editOptionCancel, 'click', closeEditOptionModal);
  on($editOptionSave, 'click', handleEditOptionSave);
  on($editOptionForm, 'submit', function(e) {
    e.preventDefault();
    handleEditOptionSave();
  });
  if ($editOptionModal) $editOptionModal.addEventListener('click', function(e) {
    if (e.target === $editOptionModal) closeEditOptionModal();
  });
  // Allow Enter key to save in edit modal
  on($editOptionValue, 'keypress', function(e) {
    if (e.key === 'Enter') handleEditOptionSave();
  });
  on($editOptionText, 'keypress', function(e) {
    if (e.key === 'Enter') handleEditOptionSave();
  });
  on($deleteAllConfirmOk, 'click', handleDeleteAllConfirm);
  on($deleteAllConfirmCancel, 'click', closeDeleteAllConfirmModal);
  on($deleteAllConfirmClose, 'click', closeDeleteAllConfirmModal);
  if ($manageOptionsModal) $manageOptionsModal.addEventListener('click', function(e) {
    if (e.target === $manageOptionsModal) closeManageOptionsModal();
  });
  if ($deleteAllConfirmModal) $deleteAllConfirmModal.addEventListener('click', function(e) {
    if (e.target === $deleteAllConfirmModal) closeDeleteAllConfirmModal();
  });
  on($exportBtn, 'click', exportData);
  on($importBtn, 'click', function () { if ($importFileInput) $importFileInput.click(); });
  on($importFileInput, 'change', handleImportFile);


  on($notificationClose, 'click', closeNotificationModal);
  on($notificationOk, 'click', closeNotificationModal);
  if ($notificationModal) $notificationModal.addEventListener('click', function(e) {
    if (e.target === $notificationModal) closeNotificationModal();
  });

  initSort();
  initCustomOptions();
  // initialize custom styled multi-select widgets
  try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
  syncFilterOptionsWithForm();
  // ensure all selects are alphabetically ordered on startup
  sortAllSelects();
  // Display initial last updated time
  updateLastUpdatedDisplay();
  // Update the relative time display every minute
  setInterval(updateLastUpdatedDisplay, 60000);
  applyFiltersFromState();
})();
