// @ts-nocheck
import { initFirebase } from '../lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureArray, ensureArrayOr, escapeHtml, formatRelativeTime, sanitizeUrl } from './utils';
import { normalizeProjects } from './normalize';
import { mergePayloads } from './merge';
import { normalizeSideLinks, toRenderableSideLinks } from './sideLinks';
import { STATUS_CONFIG, MANAGED_SELECT_IDS, SORTABLE_SELECT_IDS, MULTI_SELECT_IDS, DEFAULT_OPTIONS_BY_SELECT } from './constants';
import { getNextProjectId, projectToFormData, formDataToProject, hasProjectDuplicate } from './projectHelpers';
import { validateProjectLinks } from './validation';

export function initApp() {
  'use strict';

  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.__airdropInit) return;
    w.__airdropInit = true;
  }
  const STORAGE_KEY = 'airdrop-tracker-data';
  const BACKUP_STORAGE_KEY = 'airdrop-tracker-backups';
  const STORAGE_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
  const AUTO_BACKUP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
  let CUSTOM_OPTIONS = {};
  let LAST_UPDATED_AT = 0; // Track when data was last updated
  let LAST_AUTO_BACKUP_AT = 0;

  function byId(id) {
    return document.getElementById(id) as any;
  }

  function getOptionTextBySelect(selectId, val) {
    try {
      const sel = byId(selectId) as HTMLSelectElement | null;
      if (!sel) return val || '';
      const opt = Array.from(sel.options).find(function (o) { return o.value === val; });
      return opt ? opt.text : (val != null ? String(val) : '');
    } catch (e) {
      return val || '';
    }
  }

  function on(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  function setModalState(modal, open) {
    if (!modal) return;
    const activeEl = document.activeElement as HTMLElement | null;
    const isFocusInside = !!(activeEl && modal.contains(activeEl));
    const previousFocus = (modal as any).__previousActiveElement as HTMLElement | null;

    if (open) {
      if (activeEl && !modal.contains(activeEl)) {
        (modal as any).__previousActiveElement = activeEl;
      }
      modal.removeAttribute('inert');
      try { (modal as any).inert = false; } catch (e) {}
    } else {
      if (isFocusInside) {
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        else if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
      }
      modal.setAttribute('inert', '');
      try { (modal as any).inert = true; } catch (e) {}
    }

    modal.classList.toggle('open', open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function bindOverlayClose(modal, closeFn) {
    if (!modal) return;
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeFn();
    });
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
      if (data && data.lastAutoBackupAt) {
        LAST_AUTO_BACKUP_AT = Number(data.lastAutoBackupAt) || 0;
      }
      const list = Array.isArray(data) ? data : (data.projects || []);
      const savedAt = data.savedAt || 0;
      if (savedAt && Date.now() - savedAt > STORAGE_EXPIRY_MS) return [];
      return normalizeProjects(list);
    } catch (e) {
      return [];
    }
  }

  function buildPayload() {
    return {
      projects: PROJECTS,
      customOptions: CUSTOM_OPTIONS,
      lastUpdatedAt: LAST_UPDATED_AT,
      lastAutoBackupAt: LAST_AUTO_BACKUP_AT,
      savedAt: Date.now(),
    };
  }

  function persistAutoBackup(payload, reason) {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const backups = Array.isArray(existing) ? existing.slice(0, 19) : [];
      backups.unshift({
        id: now,
        reason: reason || 'auto',
        createdAt: now,
        payload: payload || buildPayload(),
      });
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups));
      LAST_AUTO_BACKUP_AT = now;
    } catch (e) {}
  }

  function maybeRunAutoBackup(payload, reason) {
    if (!PROJECTS || !PROJECTS.length) return;
    if (Date.now() - Number(LAST_AUTO_BACKUP_AT || 0) < AUTO_BACKUP_INTERVAL_MS) return;
    persistAutoBackup(payload || buildPayload(), reason || 'interval');
    setAuthStatus('Auto backup saved (3-day interval)', 'muted', true);
  }

  function saveToLocalStorage(skipCloud) {
    try {
      const payload = buildPayload();
      maybeRunAutoBackup(payload, 'save');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (!skipCloud) queueCloudSave(payload);
    } catch (e) {}
  }

  let PROJECTS = loadFromLocalStorage();
  let CLOUD_ENABLED = false;
  let CLOUD_AUTH = null;
  let CLOUD_DB = null;
  let CLOUD_USER = null;
  let CLOUD_SAVE_TIMER = null;
  let CLOUD_SYNCING = false;
  let LAST_SIGNED_OUT_AT = 0;
  let CLOUD_UNSUBSCRIBE = null;
  let IGNORE_REMOTE_APPLY = false;

  let filteredProjects = [];
  let sortKey = 'name';
  let sortDir = 'asc';
  let deleteConfirmId = null;
  let viewMode = 'all';
  let LAST_TABLE_HTML = '';
  let EXPANDED_MORE_ROWS = {};

  const $tableBody = byId('tableBody');
  const $searchInput = byId('searchInput');
  const $taskFilter = byId('taskFilter');
  const $taskTypeFilter = byId('taskTypeFilter');
  const $statusFilter = byId('statusFilter');
  const $addAirdropBtn = byId('addAirdropBtn');
  const $openFiltersBtn = byId('openFiltersBtn');
  const $filtersModal = byId('filtersModal');
  const $filtersClose = byId('filtersClose');
  const $filtersDone = byId('filtersDone');
  const $filtersClear = byId('filtersClear');
  const $airdropFormModal = byId('airdropFormModal');
  const $airdropForm = byId('airdropForm');
  const $airdropLinkInput = byId('airdropLink');
  const $airdropFormClose = byId('airdropFormClose');
  const $airdropFormCancel = byId('airdropFormCancel');
  const $airdropFormTitle = byId('airdropFormTitle');
  const $addMoreLinksAnchor = byId('addMoreLinksAnchor');
  const $airdropExtraLinks = byId('airdropExtraLinks');
  const $deleteConfirmModal = byId('deleteConfirmModal');
  const $deleteConfirmClose = byId('deleteConfirmClose');
  const $deleteConfirmCancel = byId('deleteConfirmCancel');
  const $deleteConfirmOk = byId('deleteConfirmOk');
  const $deleteConfirmMessage = byId('deleteConfirmMessage');
  const $deleteAllBtn = byId('deleteAllBtn');
  const $manageOptionsBtn = byId('manageOptionsBtn');
  const $manageOptionsModal = byId('manageOptionsModal');
  const $manageOptionsForm = byId('manageOptionsForm');
  const $manageOptionsClose = byId('manageOptionsClose');
  const $manageOptionsCancel = byId('manageOptionsCancel');
  const $resetOptionsConfirmModal = byId('resetOptionsConfirmModal');
  const $resetOptionsConfirmClose = byId('resetOptionsConfirmClose');
  const $resetOptionsConfirmCancel = byId('resetOptionsConfirmCancel');
  const $resetOptionsConfirmOk = byId('resetOptionsConfirmOk');
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
  const $lastUpdatedTime = byId('lastUpdatedTime');
  const $signInBtn = byId('signInBtn');
  const $signOutBtn = byId('signOutBtn');
  const $authUser = byId('authUser');
  const $authStatusBar = byId('authStatusBar');
  const $authStatusText = byId('authStatusText');
  const $authStatusIcon = byId('authStatusIcon');
  const $backToTopBtn = byId('backToTopBtn');
  const $taskCountDropdown = byId('taskCountDropdown');
  const $taskCountTrigger = byId('taskCountTrigger');
  const $taskCountMenu = byId('taskCountMenu');
  const $connectCountDropdown = byId('connectCountDropdown');
  const $connectCountTrigger = byId('connectCountTrigger');
  const $connectCountMenu = byId('connectCountMenu');
  const $statusCountDropdown = byId('statusCountDropdown');
  const $statusCountTrigger = byId('statusCountTrigger');
  const $statusCountMenu = byId('statusCountMenu');
  const $recentBtn = byId('recentBtn');
  let AUTH_STATUS_LAST_KEY = '';
  let AUTH_STATUS_HIDE_TIMER = null;
  const AUTH_STATUS_HIDE_MS = 1500;
  const AUTH_STATUS_QUEUE_GAP_MS = 120;
  const AUTH_STATUS_DEDUPE_WINDOW_MS = 4000;
  let AUTH_STATUS_QUEUE = [];
  let AUTH_STATUS_IS_SHOWING = false;
  let AUTH_STATUS_LAST_SHOWN_KEY = '';
  let AUTH_STATUS_LAST_SHOWN_AT = 0;

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

  function updateBackToTopVisibility() {
    if (!$backToTopBtn) return;
    const shouldShow = window.scrollY > 400;
    $backToTopBtn.classList.toggle('is-visible', shouldShow);
  }

  function buildCounterItems(menuEl, optionSelectId, filterType, counts, allCount) {
    if (!menuEl) return;
    const keys = Object.keys(counts || {});
    if (!keys.length) {
      menuEl.innerHTML = '<div class="task-count-item">No data</div>';
      return;
    }
    keys.sort(function (a, b) {
      return String(a).localeCompare(String(b), 'en', { sensitivity: 'base' });
    });
    const items = [
      '<button type="button" class="task-count-item task-count-filter-item" data-filter-type="' + filterType + '" data-filter-value=""><span class="task-count-label">All</span><span class="task-count-badge">' + allCount + '</span></button>'
    ];
    keys.forEach(function (k) {
      const label = getOptionTextBySelect(optionSelectId, k) || k;
      items.push('<button type="button" class="task-count-item task-count-filter-item" data-filter-type="' + filterType + '" data-filter-value="' + escapeHtml(k) + '"><span class="task-count-label">' + escapeHtml(label) + '</span><span class="task-count-badge">' + counts[k] + '</span></button>');
    });
    menuEl.innerHTML = items.join('');
  }

  function renderTaskCounters() {
    const taskCounts = {};
    const connectCounts = {};
    const statusCounts = {};
    PROJECTS.forEach(function (p) {
      ensureArray(p.taskType).forEach(function (t) {
        if (!t) return;
        taskCounts[t] = (taskCounts[t] || 0) + 1;
      });
      ensureArray(p.connectType).forEach(function (c) {
        if (!c) return;
        connectCounts[c] = (connectCounts[c] || 0) + 1;
      });
      if (p.status) {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      }
    });
    const total = PROJECTS.length;
    buildCounterItems($taskCountMenu, 'airdropTaskType', 'task', taskCounts, total);
    buildCounterItems($connectCountMenu, 'airdropConnectType', 'connect', connectCounts, total);
    buildCounterItems($statusCountMenu, 'airdropStatus', 'status', statusCounts, total);
  }

  function applyCounterFilter(e) {
    const trigger = e.target && e.target.closest ? e.target.closest('.task-count-filter-item') : null;
    if (!trigger) return;
    const value = trigger.getAttribute('data-filter-value') || '';
    const type = trigger.getAttribute('data-filter-type') || '';
    const labelNode = trigger.querySelector('.task-count-label');
    const selectedLabel = labelNode ? (labelNode.textContent || '').trim() : 'All';
    if (type === 'task' && $taskFilter) {
      $taskFilter.value = value;
      $taskFilter.dispatchEvent(new Event('change'));
    } else if (type === 'connect' && $taskTypeFilter) {
      $taskTypeFilter.value = value;
      $taskTypeFilter.dispatchEvent(new Event('change'));
    } else if (type === 'status' && $statusFilter) {
      $statusFilter.value = value;
      $statusFilter.dispatchEvent(new Event('change'));
    }
    setAuthStatus('Filter as ' + selectedLabel, 'success', true);
    closeAllCounterDropdowns();
  }

  function applyAuthStatus(message, tone) {
    if ($authStatusBar) {
      if ($authStatusText) $authStatusText.textContent = message;
      $authStatusBar.classList.remove('is-hidden');
      $authStatusBar.classList.remove('auth-status--muted', 'auth-status--success', 'auth-status--error');
      if (tone) $authStatusBar.classList.add('auth-status--' + tone);
    }
    if ($authStatusIcon) {
      var iconClass = 'fa-circle-info';
      if (tone === 'success') iconClass = 'fa-circle-check';
      else if (tone === 'error') iconClass = 'fa-circle-xmark';
      $authStatusIcon.innerHTML = '<i class="fas ' + iconClass + '"></i>';
    }
  }

  function showImmediateAuthStatus(message, tone) {
    AUTH_STATUS_QUEUE = [];
    AUTH_STATUS_IS_SHOWING = true;
    if (AUTH_STATUS_HIDE_TIMER) {
      clearTimeout(AUTH_STATUS_HIDE_TIMER);
      AUTH_STATUS_HIDE_TIMER = null;
    }
    applyAuthStatus(message, tone);
    AUTH_STATUS_LAST_KEY = (message || '') + '::' + (tone || '');
    AUTH_STATUS_LAST_SHOWN_KEY = AUTH_STATUS_LAST_KEY;
    AUTH_STATUS_LAST_SHOWN_AT = Date.now();
    AUTH_STATUS_HIDE_TIMER = setTimeout(function () {
      if ($authStatusBar) $authStatusBar.classList.add('is-hidden');
      AUTH_STATUS_HIDE_TIMER = null;
      AUTH_STATUS_IS_SHOWING = false;
    }, AUTH_STATUS_HIDE_MS);
  }

  function consumeAuthStatusQueue() {
    if (!AUTH_STATUS_QUEUE.length) {
      AUTH_STATUS_IS_SHOWING = false;
      return;
    }
    AUTH_STATUS_IS_SHOWING = true;
    var item = AUTH_STATUS_QUEUE.shift();
    applyAuthStatus(item.message, item.tone);
    AUTH_STATUS_LAST_SHOWN_KEY = item.key || '';
    AUTH_STATUS_LAST_SHOWN_AT = Date.now();
    if (AUTH_STATUS_HIDE_TIMER) clearTimeout(AUTH_STATUS_HIDE_TIMER);
    AUTH_STATUS_HIDE_TIMER = setTimeout(function () {
      if ($authStatusBar) $authStatusBar.classList.add('is-hidden');
      AUTH_STATUS_HIDE_TIMER = null;
      setTimeout(function () {
        consumeAuthStatusQueue();
      }, AUTH_STATUS_QUEUE_GAP_MS);
    }, AUTH_STATUS_HIDE_MS);
  }

  function setAuthStatus(message, tone, forceShow) {
    const nextKey = (message || '') + '::' + (tone || '');
    if (!message) {
      AUTH_STATUS_LAST_KEY = '';
      AUTH_STATUS_QUEUE = [];
      AUTH_STATUS_IS_SHOWING = false;
      if (AUTH_STATUS_HIDE_TIMER) {
        clearTimeout(AUTH_STATUS_HIDE_TIMER);
        AUTH_STATUS_HIDE_TIMER = null;
      }
      if ($authStatusText) $authStatusText.textContent = '';
      if ($authStatusBar) $authStatusBar.classList.add('is-hidden');
      return;
    }
    if (!forceShow && nextKey === AUTH_STATUS_LAST_KEY) return;
    if (!forceShow && nextKey === AUTH_STATUS_LAST_SHOWN_KEY && (Date.now() - AUTH_STATUS_LAST_SHOWN_AT) < AUTH_STATUS_DEDUPE_WINDOW_MS) return;
    if (!forceShow && AUTH_STATUS_QUEUE.some(function (item) { return item.key === nextKey; })) return;
    AUTH_STATUS_LAST_KEY = nextKey;
    AUTH_STATUS_QUEUE.push({ key: nextKey, message: message, tone: tone });
    if (!AUTH_STATUS_IS_SHOWING) {
      consumeAuthStatusQueue();
    }
  }

  function setAuthUi(user) {
    if ($signInBtn) {
      const hideSignIn = !CLOUD_ENABLED || !!user;
      $signInBtn.classList.toggle('is-hidden', hideSignIn);
      $signInBtn.disabled = !CLOUD_ENABLED;
      $signInBtn.style.display = hideSignIn ? 'none' : '';
    }
    if ($signOutBtn) $signOutBtn.classList.toggle('is-hidden', !user);
    if ($authUser) {
      if (user) {
        const label = user.displayName || user.email || 'Signed in';
        $authUser.textContent = label;
        $authUser.classList.remove('is-hidden');
        $authUser.style.display = '';
      } else {
        $authUser.textContent = '';
        $authUser.classList.add('is-hidden');
        $authUser.style.display = 'none';
      }
    }
    if ($signOutBtn) {
      const showSignOut = !!user;
      $signOutBtn.classList.toggle('is-hidden', !showSignOut);
      $signOutBtn.style.display = showSignOut ? '' : 'none';
    }
  }

  function getCloudDocRef(uid) {
    if (!CLOUD_DB || !uid) return null;
    return doc(CLOUD_DB, 'users', uid, 'airdrop', 'state');
  }

  function applyPayload(payload) {
    if (!payload) return;
    const list = Array.isArray(payload) ? payload : (payload.projects || []);
    try { CUSTOM_OPTIONS = payload.customOptions || {}; } catch (e) { CUSTOM_OPTIONS = {}; }
    LAST_UPDATED_AT = payload.lastUpdatedAt || 0;
    LAST_AUTO_BACKUP_AT = Number(payload.lastAutoBackupAt || LAST_AUTO_BACKUP_AT || 0);
    PROJECTS = normalizeProjects(list);
    initCustomOptions();
    syncFilterOptionsWithForm();
    updateLastUpdatedDisplay();
    saveToLocalStorage(true);
    applyFiltersFromState();
  }

  async function readCloudState(uid) {
    const ref = getCloudDocRef(uid);
    if (!ref) return null;
    try {
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      setAuthStatus('Cloud read failed...', 'error');
      return null;
    }
  }

  async function writeCloudState(payload) {
    if (!CLOUD_DB || !CLOUD_USER) return;
    const ref = getCloudDocRef(CLOUD_USER.uid);
    if (!ref) return;
    try {
      CLOUD_SYNCING = true;
      await setDoc(
        ref,
        {
          ...payload,
          serverUpdatedAt: serverTimestamp(),
          uid: CLOUD_USER.uid,
        },
        { merge: true }
      );
      CLOUD_SYNCING = false;
      setAuthStatus('Cloud synced', 'success');
    } catch (err) {
      CLOUD_SYNCING = false;
      setAuthStatus('Cloud sync failed', 'error');
    }
  }

  async function syncFromCloud(user) {
    if (!user) return;
    setAuthStatus('Checking cloud...', 'muted');
    const cloudPayload = await readCloudState(user.uid);
    const cloudUpdated = cloudPayload && cloudPayload.lastUpdatedAt ? Number(cloudPayload.lastUpdatedAt) : 0;
    const localUpdated = Number(LAST_UPDATED_AT || 0);
    if (!cloudPayload) {
      setAuthStatus('Cloud ready (local data)...', 'muted');
      if (PROJECTS.length || Object.keys(CUSTOM_OPTIONS || {}).length) {
        queueCloudSave(buildPayload());
      }
      return;
    }
    if (cloudUpdated === 0 && localUpdated === 0) {
      setAuthStatus('Cloud synced', 'success');
      return;
    }
    var merged = mergePayloads(buildPayload(), cloudPayload);
    applyPayload(merged);
    queueCloudSave(merged);
    setAuthStatus('Cloud synced', 'success');
  }

  function attachCloudListener(user) {
    if (!CLOUD_DB || !user) return;
    if (CLOUD_UNSUBSCRIBE) {
      try { CLOUD_UNSUBSCRIBE(); } catch (e) {}
      CLOUD_UNSUBSCRIBE = null;
    }
    const ref = getCloudDocRef(user.uid);
    if (!ref) return;
    CLOUD_UNSUBSCRIBE = onSnapshot(ref, function (snap) {
      if (!snap.exists()) return;
      if (IGNORE_REMOTE_APPLY) return;
      const data = snap.data();
      const remoteUpdated = Number(data && data.lastUpdatedAt || 0);
      const localUpdated = Number(LAST_UPDATED_AT || 0);
      if (remoteUpdated > localUpdated) {
        IGNORE_REMOTE_APPLY = true;
        applyPayload(data);
        setAuthStatus('Updated from cloud...', 'success');
        setTimeout(function () { IGNORE_REMOTE_APPLY = false; }, 300);
      }
    });
  }

  function detachCloudListener() {
    if (CLOUD_UNSUBSCRIBE) {
      try { CLOUD_UNSUBSCRIBE(); } catch (e) {}
      CLOUD_UNSUBSCRIBE = null;
    }
  }

  function queueCloudSave(payload) {
    if (!CLOUD_ENABLED || !CLOUD_DB || !CLOUD_USER) return;
    const data = payload || buildPayload();
    if (CLOUD_SAVE_TIMER) clearTimeout(CLOUD_SAVE_TIMER);
    CLOUD_SAVE_TIMER = setTimeout(function () {
      CLOUD_SAVE_TIMER = null;
      IGNORE_REMOTE_APPLY = true;
      writeCloudState(data);
      setTimeout(function () { IGNORE_REMOTE_APPLY = false; }, 300);
    }, 300);
  }


  function getNextId() {
    return getNextProjectId(PROJECTS);
  }

  function addProject(data) {
    const p = formDataToProject(data, null, PROJECTS);
    PROJECTS.push(p);
    updateLastUpdatedTime();
    applyFiltersFromState();
    queueCloudSave(buildPayload());
    setAuthStatus('Added', 'success', true);
  }

  function updateProject(id, data) {
    const idx = PROJECTS.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    const existing = PROJECTS[idx];
    const p = formDataToProject(data, id, PROJECTS);
    p.favorite = existing.favorite;
    p.logos = existing.logos;
    PROJECTS[idx] = p;
    updateLastUpdatedTime();
    applyFiltersFromState();
    queueCloudSave(buildPayload());
    setAuthStatus('Edited', 'success', true);
  }

  function deleteProject(id) {
    const idx = PROJECTS.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    PROJECTS.splice(idx, 1);
    updateLastUpdatedTime();
    applyFiltersFromState();
    queueCloudSave(buildPayload());
    setAuthStatus('Deleted', 'success', true);
  }

  function deleteAllProjects() {
    setModalState($deleteAllConfirmModal, true);
  }

  function closeDeleteAllConfirmModal() {
    setModalState($deleteAllConfirmModal, false);
  }

  function openFiltersModal() {
    setModalState($filtersModal, true);
  }

  function closeFiltersModal() {
    setModalState($filtersModal, false);
  }

  function handleDeleteAllConfirm() {
    PROJECTS = [];
    updateLastUpdatedTime();
    applyFiltersFromState();
    queueCloudSave(buildPayload());
    closeDeleteAllConfirmModal();
    setAuthStatus('Deleted All', 'success', true);
  }

  function renderProjectRow(p) {
    const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.potential;
    const taskTypeDisplay = (p.taskType && p.taskType.length) ? p.taskType.map(function(t){ return String(t).charAt(0).toUpperCase() + String(t).slice(1); }).join(', ') : '';
    const connectTypeDisplay = (p.connectType && p.connectType.length) ? p.connectType.map(function(c){
      // Use the display text from the form select if available to preserve casing
      const txt = getOptionTextBySelect('airdropConnectType', c);
      return txt || String(c).toUpperCase();
    }).join(', ') : '';
    
    // Get status label from select options (respects custom edits)
    const statusLabel = getOptionTextBySelect('airdropStatus', p.status) || statusCfg.label;
    
    // Get reward type labels from select options (respects custom edits)
    const rewardTypeDisplay = (p.rewardType && p.rewardType.length) ? p.rewardType.map(function(r){
      const txt = getOptionTextBySelect('airdropRewardType', r);
      return txt || r;
    }).join(', ') : '';

    const safeName = escapeHtml(p.name || '');
    const safeCode = escapeHtml(p.code || '');
    const safeStatusLabel = escapeHtml(statusLabel || '');
    const safeStatusDate = escapeHtml(p.statusDate || '');
    const safeTaskTypeDisplay = escapeHtml(taskTypeDisplay || '--');
    const safeConnectTypeDisplay = escapeHtml(connectTypeDisplay || '--');
    const safeRewardTypeDisplay = escapeHtml(rewardTypeDisplay || '--');
    const safeLink = sanitizeUrl(p.link);
    const expanded = !!EXPANDED_MORE_ROWS[p.id];
    const sideLinks = toRenderableSideLinks(p.sideLinks, function (type) {
      return getOptionTextBySelect('airdropExtraLinkType', type) || String(type || '');
    });
    const safeNote = escapeHtml((p.note || '').trim());
    
    const taskCellContent = `
        <span class="task-meta">
          <span class="cost">Cost: $${p.taskCost}</span>
          <span class="time">Time: ${p.taskTime} min</span>
        </span>
        <span class="task-desc">${safeConnectTypeDisplay}</span>
      `;
    const sideLinksLinksHtml = sideLinks.length
      ? sideLinks.map(function (x) {
          return '<a href="' + x.href + '" target="_blank" rel="noopener noreferrer" class="side-link-chip" aria-label="' + escapeHtml(x.label) + '" title="' + escapeHtml(x.label) + '"><i class="' + x.icon + '"></i></a>';
        }).join('')
      : '<span class="side-links-empty">No sub links</span>';
    const sideLinksNoteHtml = safeNote ? '<div class="project-note">' + safeNote + '</div>' : '';
    const sideLinksHtml = sideLinksNoteHtml + '<div class="side-links-links">' + sideLinksLinksHtml + '</div>';
    const hasMoreContent = sideLinks.length || !!safeNote;
    const moreButtonHtml = hasMoreContent
      ? '<button type="button" class="btn-action more btn-more-inline ' + (expanded ? 'is-open' : '') + '" aria-label="More links" aria-expanded="' + (expanded ? 'true' : 'false') + '" data-id="' + p.id + '" data-action="more">' + (expanded ? 'Less <i class="fa-solid fa-chevron-up"></i>' : 'More <i class="fa-solid fa-chevron-down"></i>') + '</button>'
      : '';
    return `
      <tr data-id="${p.id}">
        <td class="col-name">
          <div class="cell-name">
            <span class="name-prefix-icon" aria-hidden="true"><i class="fa-solid fa-circle-notch"></i></span>
            <div class="project-info">
              <div class="project-name-row">
                <a href="${safeLink || '#'}" target="_blank" rel="noopener noreferrer" class="project-link" ${!safeLink ? 'onclick="return false"' : ''}>
                  <div class="name">${safeName} <span class="code">${safeCode}</span></div>
                </a>
                ${moreButtonHtml}
              </div>
            </div>
          </div>
        </td>
        <td class="col-task">
          <div class="cell-task">
            <span class="task-badge">${safeTaskTypeDisplay}</span>
          </div>
        </td>
        <td class="col-tasktype">
          <div class="cell-tasktype">${taskCellContent}</div>
        </td>
        <td class="col-status">
          <div class="status-cell">
            <span class="status-label ${statusCfg.class}">${safeStatusLabel}</span>
            <span class="status-date">${safeStatusDate}</span>
          </div>
        </td>
        <td class="col-reward"><span class="reward-type">${safeRewardTypeDisplay}</span></td>
        <td class="col-actions">
          <div class="cell-actions">
            <button type="button" class="btn-action edit" aria-label="Edit" data-id="${p.id}" data-action="edit"><i class="fas fa-pen"></i></button>
            <button type="button" class="btn-action delete" aria-label="Delete" data-id="${p.id}" data-action="delete"><i class="fas fa-trash-alt"></i></button>
          </div>
        </td>
      </tr>
      <tr class="side-links-row ${expanded ? 'is-expanded' : ''}" data-more-row-for="${p.id}">
        <td colspan="6">
          <div class="side-links-panel">${sideLinksHtml}</div>
        </td>
      </tr>
    `;
  }

  function collapseAllMoreRows() {
    if (!Object.keys(EXPANDED_MORE_ROWS || {}).length) return;
    EXPANDED_MORE_ROWS = {};
  }

  function applyFiltersFromState() {
    collapseAllMoreRows();
    const search = ($searchInput && $searchInput.value || '').trim().toLowerCase();
    const taskType = $taskFilter && $taskFilter.value || '';
    const connectType = $taskTypeFilter && $taskTypeFilter.value || '';
    const status = $statusFilter && $statusFilter.value || '';
    filteredProjects = PROJECTS.filter(function (p) {
      if (search) {
        const match = (p.name + ' ' + p.code + ' ' + (p.note || '')).toLowerCase().includes(search);
        if (!match) return false;
      }
      if (taskType) {
        if (!p.taskType || !Array.isArray(p.taskType) || !p.taskType.includes(taskType)) return false;
      }
      if (connectType) {
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
    renderTaskCounters();
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
    const nextHtml = filteredProjects.length
      ? filteredProjects.map(renderProjectRow).join('')
      : '<tr class="no-data-row"><td class="no-data-cell" colspan="6"><div class="empty-state-card"><div class="empty-state-title">No airdrops yet.</div><div class="empty-state-copy">First, add options (Task, Connect, Status, Reward, Sub link), then create your first drop .</div><button type="button" class="btn-secondary empty-state-manage-btn" data-action="open-manage-options">Manage Options</button></div></td></tr>';
    if (nextHtml === LAST_TABLE_HTML) return;
    LAST_TABLE_HTML = nextHtml;
    $tableBody.innerHTML = nextHtml;
  }

  function handleTableClick(e) {
    if (!$tableBody || !e.target || typeof e.target.closest !== 'function') return;
    const openManageBtn = e.target.closest('[data-action="open-manage-options"]');
    if (openManageBtn && $tableBody.contains(openManageBtn)) {
      openManageOptionsModal();
      return;
    }

    const actionBtn = e.target.closest('.btn-action');
    if (actionBtn && $tableBody.contains(actionBtn)) {
      const id = parseInt(actionBtn.getAttribute('data-id'), 10);
      const action = actionBtn.getAttribute('data-action');
      if (action === 'more') {
        const nextExpanded = !EXPANDED_MORE_ROWS[id];
        EXPANDED_MORE_ROWS[id] = nextExpanded;

        const dataRow = $tableBody.querySelector('tr[data-id="' + id + '"]');
        const sideRow = $tableBody.querySelector('tr[data-more-row-for="' + id + '"]');
        if (dataRow && sideRow) {
          sideRow.classList.toggle('is-expanded', nextExpanded);
          actionBtn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
          actionBtn.innerHTML = nextExpanded
            ? 'Less <i class="fa-solid fa-chevron-up"></i>'
            : 'More <i class="fa-solid fa-chevron-down"></i>';
        } else {
          renderTable();
        }
        return;
      }
      if (action === 'edit') openAirdropFormForEdit(id);
      if (action === 'delete') openDeleteConfirmModal(id);
    }
  }

  function syncFilterOptionsWithForm() {
    // Sync Task options from airdropTaskType to taskFilter
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

    // Sync Connect options from airdropConnectType to taskTypeFilter
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

    // Sync Reward options from airdropRewardType (collect from actual data)
    const $airdropRewardType = byId('airdropRewardType');
    if ($airdropRewardType) {
      const rewardTypeOptions = Array.from($airdropRewardType.options).map(function(opt) {
        return { value: opt.value, text: opt.text };
      });
      // Note: Reward is used in data but not exposed as a filter dropdown in header currently
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
    SORTABLE_SELECT_IDS.forEach(function(id){ sortSelectElement(id); });
  }

  function ensureDefaultManagedOptions() {
    let changed = false;
    Object.keys(DEFAULT_OPTIONS_BY_SELECT).forEach(function (id) {
      const selectEl = byId(id);
      if (!selectEl) return;
      const hasCustom = Array.isArray(CUSTOM_OPTIONS && CUSTOM_OPTIONS[id]) && CUSTOM_OPTIONS[id].length > 0;
      const hasSelectValues = Array.from(selectEl.options || []).some(function (opt: any) { return opt && opt.value !== ''; });
      if (hasCustom || hasSelectValues) return;

      const defaults = (DEFAULT_OPTIONS_BY_SELECT as any)[id] || [];
      defaults.forEach(function (entry: any) {
        const option = document.createElement('option');
        option.value = entry.value;
        option.text = entry.text;
        selectEl.appendChild(option);
      });

      CUSTOM_OPTIONS[id] = defaults.map(function (entry: any) {
        return { value: entry.value, text: entry.text };
      });
      changed = true;
    });
    if (changed) saveToLocalStorage(true);
  }

  function initCustomOptions() {
    ensureDefaultManagedOptions();
    MANAGED_SELECT_IDS.forEach(function(id) {
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

  function persistCustomOptionsForSelect(selectEl) {
    if (!selectEl || !selectEl.id) return;
    var id = selectEl.id;
    var arr = Array.from(selectEl.options)
      .filter(function (o) { return o.value !== ''; })
      .map(function (o) { return { value: o.value, text: o.text }; });
    arr.sort(function (a, b) {
      return String(a.text).localeCompare(String(b.text), 'en', { sensitivity: 'base' });
    });
    CUSTOM_OPTIONS[id] = arr;
    saveToLocalStorage();
    syncFilterOptionsWithForm();
    try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
    refreshExtraLinkTypeSelects();
    applyFiltersFromState();
  }

  function openResetOptionsConfirmModal() {
    setModalState($resetOptionsConfirmModal, true);
  }

  function closeResetOptionsConfirmModal() {
    setModalState($resetOptionsConfirmModal, false);
  }

  function clearSelectOptions(selectId) {
    var selectEl = byId(selectId);
    if (!selectEl) return;
    while (selectEl.options.length) selectEl.remove(0);
  }

  function resetAllManagedOptions() {
    MANAGED_SELECT_IDS.forEach(clearSelectOptions);
    CUSTOM_OPTIONS = {};
    saveToLocalStorage();
    syncFilterOptionsWithForm();
    try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
    refreshExtraLinkTypeSelects();
    applyFiltersFromState();
    renderOptionsList();
    closeResetOptionsConfirmModal();
    closeManageOptionsModal();
    setAuthStatus('All options reset', 'success', true);
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
            persistCustomOptionsForSelect(manageOptionsCurrentSelect);
            renderOptionsList();
            setAuthStatus('Option removed', 'success', true);
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
      setAuthStatus('Value and text cannot be empty.', 'error', true);
      return;
    }

    // Update the option in the select element
    if (manageOptionsCurrentSelect && editOptionCurrentValue) {
      var opt = Array.from(manageOptionsCurrentSelect.options).find(function(o) { return o.value === editOptionCurrentValue; });
      if (opt) {
        opt.value = newValue;
        opt.text = newText;
        persistCustomOptionsForSelect(manageOptionsCurrentSelect);
        
        renderOptionsList(); // Re-render options list to show changes
        closeEditOptionModal();
        setAuthStatus('Option updated', 'success', true);
      }
    }
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

  function getExtraLinkTypeOptions() {
    const sel = byId('airdropExtraLinkType');
    if (!sel) return [];
    const options = Array.from(sel.options || []).map(function (o) {
      return { value: o.value, text: o.text };
    }).filter(function (o) { return !!o.value; });
    return options;
  }

  function buildExtraLinkTypeControl(typeValue) {
    const selectedValue = String(typeValue || '');
    const options = getExtraLinkTypeOptions();
    const selected =
      options.find(function (x) { return x.value === selectedValue; }) ||
      { value: selectedValue, text: selectedValue || 'Select type' };

    const control = document.createElement('div');
    control.className = 'extra-link-type-control';

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'sideLinkType';
    hiddenInput.value = selected.value;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'extra-link-type-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML =
      '<span class="extra-link-type-current"><span>' + escapeHtml(selected.text) + '</span></span><span class="extra-link-type-caret">▼</span>';

    const menu = document.createElement('div');
    menu.className = 'extra-link-type-menu';
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'extra-link-type-empty';
      empty.textContent = 'No options';
      menu.appendChild(empty);
    }
    options.forEach(function (optItem) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'extra-link-type-option';
      item.setAttribute('data-value', optItem.value);
      item.setAttribute('data-text', optItem.text);
      item.innerHTML =
        '<span>' + escapeHtml(optItem.text) + '</span>';
      menu.appendChild(item);
    });

    control.appendChild(hiddenInput);
    control.appendChild(trigger);
    control.appendChild(menu);
    return control;
  }

  function closeExtraLinkTypeMenus(exceptControl) {
    if (!$airdropExtraLinks) return;
    Array.from($airdropExtraLinks.querySelectorAll('.extra-link-type-control.is-open')).forEach(function (control) {
      if (exceptControl && control === exceptControl) return;
      control.classList.remove('is-open');
      const trigger = control.querySelector('.extra-link-type-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function buildExtraLinkRow(entry) {
    const item = entry && typeof entry === 'object' ? entry : { type: '', url: entry || '' };
    const typeValue = (item.type || '').toString();
    const urlValue = (item.url || '').toString();
    const row = document.createElement('div');
    row.className = 'extra-link-row';
    const typeControl = buildExtraLinkTypeControl(typeValue);

    const input = document.createElement('input');
    input.type = 'url';
    input.name = 'sideLinkUrl';
    input.className = 'extra-link-input';
    input.placeholder = 'https://...';
    input.value = urlValue;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'extra-link-delete';
    delBtn.setAttribute('aria-label', 'Delete sub link');
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

    row.appendChild(typeControl);
    row.appendChild(input);
    row.appendChild(delBtn);
    return row;
  }

  function addExtraLinkInput(value, shouldFocus) {
    if (!$airdropExtraLinks) return;
    const row = buildExtraLinkRow(value);
    $airdropExtraLinks.appendChild(row);
    if (shouldFocus) {
      const input = row.querySelector('input[name="sideLinkUrl"]');
      if (input && typeof input.focus === 'function') input.focus();
    }
  }

  function setExtraLinkInputs(values) {
    if (!$airdropExtraLinks) return;
    $airdropExtraLinks.innerHTML = '';
    ensureArrayOr(values, []).forEach(function (v) {
      addExtraLinkInput(v, false);
    });
  }

  function getExtraLinkValues() {
    if (!$airdropExtraLinks) return [];
    return Array.from($airdropExtraLinks.querySelectorAll('.extra-link-row'))
      .map(function (row) {
        const typeEl = row.querySelector('input[name="sideLinkType"]');
        const urlEl = row.querySelector('input[name="sideLinkUrl"]');
        const type = typeEl && typeEl.value ? typeEl.value : '';
        const url = urlEl && urlEl.value ? urlEl.value.trim() : '';
        return { type: type, url: url };
      })
      .filter(function (x) { return !!x.url; });
  }

  function refreshExtraLinkTypeSelects() {
    if (!$airdropExtraLinks) return;
    const rows = Array.from($airdropExtraLinks.querySelectorAll('.extra-link-row')).map(function (row) {
      const typeEl = row.querySelector('input[name="sideLinkType"]');
      const urlEl = row.querySelector('input[name="sideLinkUrl"]');
      return {
        type: typeEl && typeEl.value ? typeEl.value : '',
        url: urlEl && urlEl.value ? urlEl.value : '',
      };
    });
    setExtraLinkInputs(rows);
  }

  function getAirdropFormData() {
    const idEl = byId('airdropId');
    const nameEl = byId('airdropName');
    const codeEl = byId('airdropCode');
    const linkEl = byId('airdropLink');
    const taskTypeEl = byId('airdropTaskType');
    const connectTypeEl = byId('airdropConnectType');
    const taskCostEl = byId('airdropTaskCost');
    const taskTimeEl = byId('airdropTaskTime');
    const statusEl = byId('airdropStatus');
    const statusDateEl = byId('airdropStatusDate');
    const rewardTypeEl = byId('airdropRewardType');
    const noteEl = byId('airdropNote');
    const idVal = idEl && idEl.value ? parseInt(idEl.value, 10) : null;
    return {
      id: idVal,
      name: nameEl ? nameEl.value : '',
      code: codeEl ? codeEl.value.toUpperCase() : '',
      link: linkEl ? linkEl.value : '',
      sideLinks: getExtraLinkValues(),
      taskType: taskTypeEl ? (taskTypeEl.multiple ? Array.from(taskTypeEl.selectedOptions).map(function(o){ return o.value; }) : taskTypeEl.value) : [],
      connectType: connectTypeEl ? (connectTypeEl.multiple ? Array.from(connectTypeEl.selectedOptions).map(function(o){ return o.value; }) : connectTypeEl.value) : [],
      taskCost: taskCostEl ? taskCostEl.value : '0',
      taskTime: taskTimeEl ? taskTimeEl.value : '3',
      status: statusEl ? statusEl.value : 'potential',
      statusDate: statusDateEl ? statusDateEl.value : '',
      rewardType: rewardTypeEl ? (rewardTypeEl.multiple ? Array.from(rewardTypeEl.selectedOptions).map(function(o){ return o.value; }) : rewardTypeEl.value) : [],
      note: noteEl ? noteEl.value : '',
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
    setExtraLinkInputs(data.sideLinks);
    set('airdropTaskType', data.taskType);
    set('airdropConnectType', data.connectType);
    set('airdropTaskCost', data.taskCost);
    set('airdropTaskTime', data.taskTime);
    set('airdropStatus', data.status);
    set('airdropStatusDate', data.statusDate);
    set('airdropRewardType', data.rewardType && Array.isArray(data.rewardType) ? data.rewardType : (data.rewardType ? [data.rewardType] : []));
    set('airdropNote', data.note);
  }

  function resetAirdropForm() {
    setAirdropFormData({
      id: '',
      name: '',
      code: '',
      link: '',
      sideLinks: [],
      taskType: '',
      connectType: '',
      taskCost: '',
      taskTime: '',
      status: 'potential',
      statusDate: '',
      rewardType: [],
      note: '',
    });
  }

  function clearLinkValidationState() {
    const main = byId('airdropLink');
    if (main) main.classList.remove('input-invalid');
    if ($airdropExtraLinks) {
      Array.from($airdropExtraLinks.querySelectorAll('input[name="sideLinkUrl"]')).forEach(function (el) {
        el.classList.remove('input-invalid');
      });
    }
  }

  function validateLinkInputs(data) {
    clearLinkValidationState();
    const result = validateProjectLinks(data);
    const mainEl = byId('airdropLink');
    if (result.invalidMain && mainEl) mainEl.classList.add('input-invalid');
    if ($airdropExtraLinks && result.invalidSideIndexes.length) {
      const sideInputs = Array.from($airdropExtraLinks.querySelectorAll('input[name="sideLinkUrl"]'));
      result.invalidSideIndexes.forEach(function (idx) {
        if (sideInputs[idx]) sideInputs[idx].classList.add('input-invalid');
      });
    }
    return result.errors;
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
    const linkErrors = validateLinkInputs(data);
    if (linkErrors.length) {
      showAirdropFormError(linkErrors.join(' | '));
      return;
    }
    // Validate duplicate name (case-insensitive) for new entries
    var nameVal = (data.name || '').trim();
    if (!nameVal) {
      showAirdropFormError('Name is required');
      return;
    }
    var exists = hasProjectDuplicate(PROJECTS, data);
    if (exists) {
      showAirdropFormError('Possible duplicate found (same name/code/link)');
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
        setAuthStatus(msg, 'error', true);
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
      clearLinkValidationState();
    } catch (e) {}
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
    var hadAnyFilter = false;
    if ($taskFilter && $taskFilter.value) hadAnyFilter = true;
    if ($taskTypeFilter && $taskTypeFilter.value) hadAnyFilter = true;
    if ($statusFilter && $statusFilter.value) hadAnyFilter = true;
    if ($searchInput && $searchInput.value) hadAnyFilter = true;
    if (viewMode !== 'all') hadAnyFilter = true;
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
    viewMode = 'all';
    updateRecentButtonState();
    applyFiltersFromState();
    if (hadAnyFilter) setAuthStatus('Removed filters', 'muted', true);
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
        setAuthStatus('Invalid JSON file. Please check the file format.', 'error', true);
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
        var placeholder = (sel.options && sel.options[0] && sel.options[0].value === '') ? sel.options[0].text : '  ';
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
    MULTI_SELECT_IDS.forEach(function(id){ createOrUpdateCustomMultiSelect(id); });
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
        collapseAllMoreRows();
        sortProjects();
        renderTable();
      });
    });
  }

  function initCloudSync() {
    const firebase = initFirebase();
    if (!firebase || !firebase.enabled) {
      setAuthStatus('Cloud sync disabled', 'muted');
      setAuthUi(null);
      return;
    }
    CLOUD_ENABLED = true;
    CLOUD_AUTH = firebase.auth;
    CLOUD_DB = firebase.db;
    setAuthUi(null);
    setAuthStatus('Cloud ready', 'muted');
    onAuthStateChanged(CLOUD_AUTH, function (user) {
      CLOUD_USER = user;
      setAuthUi(user);
      if (!user) {
        LAST_SIGNED_OUT_AT = Date.now();
        detachCloudListener();
        setAuthStatus('Store locally, sign in to sync', 'muted');
        return;
      }
      syncFromCloud(user);
      attachCloudListener(user);
    });
  }

  on($searchInput, 'input', applyFiltersFromState);
  on($searchInput, 'keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$searchInput.value) return;
    e.preventDefault();
    e.stopPropagation();
    $searchInput.value = '';
    $searchInput.dispatchEvent(new Event('input'));
  });
  on($taskFilter, 'change', applyFiltersFromState);
  on($taskTypeFilter, 'change', applyFiltersFromState);
  on($statusFilter, 'change', applyFiltersFromState);
  on($tableBody, 'click', handleTableClick);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($airdropFormModal && $airdropFormModal.classList.contains('open')) closeAirdropFormModal();
    else if ($deleteConfirmModal && $deleteConfirmModal.classList.contains('open')) closeDeleteConfirmModal();
    else if ($filtersModal && $filtersModal.classList.contains('open')) closeFiltersModal();
    else if ($manageOptionsModal && $manageOptionsModal.classList.contains('open')) closeManageOptionsModal();
    else if ($resetOptionsConfirmModal && $resetOptionsConfirmModal.classList.contains('open')) closeResetOptionsConfirmModal();
    else if ($deleteAllConfirmModal && $deleteAllConfirmModal.classList.contains('open')) closeDeleteAllConfirmModal();
  });

  on($openFiltersBtn, 'click', openFiltersModal);
  on($filtersClose, 'click', closeFiltersModal);
  on($filtersDone, 'click', closeFiltersModal);
  on($filtersClear, 'click', removeFilters);
  bindOverlayClose($filtersModal, closeFiltersModal);

  on($addAirdropBtn, 'click', function () {
    resetAirdropForm();
    if ($airdropFormTitle) $airdropFormTitle.textContent = 'Add Airdrop';
    hideAirdropFormError();
    openAirdropFormModal();
  });
  on($addMoreLinksAnchor, 'click', function (e) {
    e.preventDefault();
    addExtraLinkInput({ type: '', url: '' }, true);
  });
  on($airdropLinkInput, 'input', function () {
    if ($airdropLinkInput) $airdropLinkInput.classList.remove('input-invalid');
  });
  on($airdropExtraLinks, 'click', function (e) {
    const typeTrigger = e.target && e.target.closest ? e.target.closest('.extra-link-type-trigger') : null;
    if (typeTrigger && $airdropExtraLinks && $airdropExtraLinks.contains(typeTrigger)) {
      e.preventDefault();
      const control = typeTrigger.closest('.extra-link-type-control');
      const willOpen = !(control && control.classList.contains('is-open'));
      closeExtraLinkTypeMenus(control);
      if (control) {
        control.classList.toggle('is-open', willOpen);
        typeTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      }
      return;
    }

    const typeOption = e.target && e.target.closest ? e.target.closest('.extra-link-type-option') : null;
    if (typeOption && $airdropExtraLinks && $airdropExtraLinks.contains(typeOption)) {
      e.preventDefault();
      const control = typeOption.closest('.extra-link-type-control');
      if (!control) return;
      const value = typeOption.getAttribute('data-value') || '';
      const text = typeOption.getAttribute('data-text') || value;
      const hiddenInput = control.querySelector('input[name="sideLinkType"]');
      const trigger = control.querySelector('.extra-link-type-trigger');
      if (hiddenInput) hiddenInput.value = value;
      if (trigger) {
        trigger.innerHTML =
          '<span class="extra-link-type-current"><span>' + escapeHtml(text) + '</span></span><span class="extra-link-type-caret">▼</span>';
        trigger.setAttribute('aria-expanded', 'false');
      }
      control.classList.remove('is-open');
      return;
    }

    const deleteBtn = e.target && e.target.closest ? e.target.closest('.extra-link-delete') : null;
    if (!deleteBtn || !$airdropExtraLinks || !$airdropExtraLinks.contains(deleteBtn)) return;
    e.preventDefault();
    const row = deleteBtn.closest('.extra-link-row');
    if (row && row.parentNode) row.parentNode.removeChild(row);
  });
  on($airdropExtraLinks, 'input', function (e) {
    const target = e.target;
    if (target && target.name === 'sideLinkUrl') target.classList.remove('input-invalid');
  });
  on($airdropForm, 'submit', handleAirdropFormSubmit);
  on($airdropFormClose, 'click', closeAirdropFormModal);
  on($airdropFormCancel, 'click', closeAirdropFormModal);
  bindOverlayClose($airdropFormModal, closeAirdropFormModal);
  on($deleteConfirmClose, 'click', closeDeleteConfirmModal);
  on($deleteConfirmCancel, 'click', closeDeleteConfirmModal);
  on($deleteConfirmOk, 'click', handleDeleteConfirm);
  bindOverlayClose($deleteConfirmModal, closeDeleteConfirmModal);

  function updateRecentButtonState() {
    if (!$recentBtn) return;
    const active = viewMode === 'newTasks';
    $recentBtn.classList.toggle('is-active', active);
    $recentBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function toggleRecentView() {
    viewMode = viewMode === 'newTasks' ? 'all' : 'newTasks';
    updateRecentButtonState();
    applyFiltersFromState();
  }

  document.addEventListener('click', function (e) {
    const recentBtn = e.target && e.target.closest ? e.target.closest('#recentBtn') : null;
    if (recentBtn) return toggleRecentView();
    const removeBtn = e.target && e.target.closest ? e.target.closest('#removeFiltersBtn') : null;
    if (removeBtn) {
      removeFilters();
    }
  });
  on($deleteAllBtn, 'click', deleteAllProjects);
  on($manageOptionsBtn, 'click', openManageOptionsModal);
  on($selectToManage, 'change', renderOptionsList);
  on($addOptionBtn, 'click', function(e) {
    e.preventDefault();
    const value = ($newOptionValue.value || '').trim();
    const text = ($newOptionText.value || '').trim();
    if (!value || !text) {
      setAuthStatus('Please enter both value and display text.', 'error', true);
      return;
    }
    if (manageOptionsCurrentSelect) {
      const option = document.createElement('option');
      option.value = value;
      option.text = text;
      manageOptionsCurrentSelect.appendChild(option);
      persistCustomOptionsForSelect(manageOptionsCurrentSelect);
      $newOptionValue.value = '';
      $newOptionText.value = '';
      renderOptionsList();
      setAuthStatus('Option added', 'success', true);
    }
  });
  on($manageOptionsSave, 'click', function(e) {
    e.preventDefault();
    if (manageOptionsCurrentSelect) {
      persistCustomOptionsForSelect(manageOptionsCurrentSelect);
      setAuthStatus('Changed options', 'success', true);
    }
    closeManageOptionsModal();
  });
  on($manageOptionsClose, 'click', closeManageOptionsModal);
  on($manageOptionsCancel, 'click', openResetOptionsConfirmModal);
  on($editOptionClose, 'click', closeEditOptionModal);
  on($editOptionCancel, 'click', closeEditOptionModal);
  on($editOptionSave, 'click', handleEditOptionSave);
  on($editOptionForm, 'submit', function(e) {
    e.preventDefault();
    handleEditOptionSave();
  });
  bindOverlayClose($editOptionModal, closeEditOptionModal);
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
  on($resetOptionsConfirmOk, 'click', resetAllManagedOptions);
  on($resetOptionsConfirmCancel, 'click', closeResetOptionsConfirmModal);
  on($resetOptionsConfirmClose, 'click', closeResetOptionsConfirmModal);
  bindOverlayClose($manageOptionsModal, closeManageOptionsModal);
  bindOverlayClose($resetOptionsConfirmModal, closeResetOptionsConfirmModal);
  bindOverlayClose($deleteAllConfirmModal, closeDeleteAllConfirmModal);
  on($exportBtn, 'click', exportData);
  on($importBtn, 'click', function () { if ($importFileInput) $importFileInput.click(); });
  on($importFileInput, 'change', handleImportFile);
  on($signInBtn, 'click', function () {
    if (!CLOUD_AUTH) return;
    const provider = new GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) {}
    signInWithPopup(CLOUD_AUTH, provider)
      .then(function (result) {
        if (result && result.user) {
          CLOUD_USER = result.user;
          setAuthUi(result.user);
          syncFromCloud(result.user);
        }
      })
      .catch(function () {
        showImmediateAuthStatus('Google sign-in failed', 'error');
      });
  });
  on($signOutBtn, 'click', function () {
    if (!CLOUD_AUTH) return;
    LAST_SIGNED_OUT_AT = Date.now();
    signOut(CLOUD_AUTH).catch(function () {
      setAuthStatus('Sign-out failed', 'error');
    });
  });
  function toggleCounterDropdown(dropdownEl, triggerEl) {
    if (!dropdownEl || !triggerEl) return;
    const willOpen = !dropdownEl.classList.contains('open');
    closeAllCounterDropdowns();
    dropdownEl.classList.toggle('open', willOpen);
    triggerEl.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
  function closeAllCounterDropdowns() {
    [
      { dropdown: $taskCountDropdown, trigger: $taskCountTrigger },
      { dropdown: $connectCountDropdown, trigger: $connectCountTrigger },
      { dropdown: $statusCountDropdown, trigger: $statusCountTrigger },
    ].forEach(function (item) {
      if (!item.dropdown || !item.trigger) return;
      item.dropdown.classList.remove('open');
      item.trigger.setAttribute('aria-expanded', 'false');
    });
  }
  on($taskCountTrigger, 'click', function () {
    toggleCounterDropdown($taskCountDropdown, $taskCountTrigger);
  });
  on($connectCountTrigger, 'click', function () {
    toggleCounterDropdown($connectCountDropdown, $connectCountTrigger);
  });
  on($statusCountTrigger, 'click', function () {
    toggleCounterDropdown($statusCountDropdown, $statusCountTrigger);
  });
  on($taskCountMenu, 'click', applyCounterFilter);
  on($connectCountMenu, 'click', applyCounterFilter);
  on($statusCountMenu, 'click', applyCounterFilter);
  document.addEventListener('click', function (e) {
    if ($airdropExtraLinks && $airdropExtraLinks.contains(e.target)) return;
    closeExtraLinkTypeMenus();
  });
  document.addEventListener('click', function (e) {
    if ($taskCountDropdown && $taskCountDropdown.contains(e.target)) return;
    if ($connectCountDropdown && $connectCountDropdown.contains(e.target)) return;
    if ($statusCountDropdown && $statusCountDropdown.contains(e.target)) return;
    closeAllCounterDropdowns();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeExtraLinkTypeMenus();
    closeAllCounterDropdowns();
  });
  window.addEventListener('scroll', function () {
    closeAllCounterDropdowns();
  });
  on($backToTopBtn, 'click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateBackToTopVisibility);
  updateBackToTopVisibility();

  initSort();
  initCustomOptions();
  initCloudSync();
  // initialize custom styled multi-select widgets
  try { if (typeof refreshCustomMultiSelects === 'function') refreshCustomMultiSelects(); } catch (e) {}
  syncFilterOptionsWithForm();
  // ensure all selects are alphabetically ordered on startup
  sortAllSelects();
  // Display initial last updated time
  updateLastUpdatedDisplay();
  updateRecentButtonState();
  // 3-day automatic local backup snapshots
  maybeRunAutoBackup(buildPayload(), 'startup');
  // Update the relative time display every minute
  setInterval(updateLastUpdatedDisplay, 60000);
  applyFiltersFromState();
}










