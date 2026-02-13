// @ts-nocheck
import { normalizeProjects } from './normalize';

export function mergeCustomOptions(localOptions, cloudOptions) {
  var merged = {};
  var ids = {};
  Object.keys(localOptions || {}).forEach(function (k) { ids[k] = true; });
  Object.keys(cloudOptions || {}).forEach(function (k) { ids[k] = true; });
  Object.keys(ids).forEach(function (id) {
    var byValue = {};
    var addAll = function (arr) {
      (arr || []).forEach(function (opt) {
        if (!opt || !opt.value) return;
        if (!byValue[opt.value]) byValue[opt.value] = opt;
      });
    };
    addAll(cloudOptions && cloudOptions[id]);
    addAll(localOptions && localOptions[id]);
    merged[id] = Object.keys(byValue).map(function (k) { return byValue[k]; });
  });
  return merged;
}

export function mergeProjects(localList, cloudList) {
  var byId = {};
  var addAll = function (list, source) {
    (list || []).forEach(function (p) {
      if (!p || p.id == null) return;
      if (!byId[p.id]) {
        byId[p.id] = p;
        byId[p.id].__source = source;
        return;
      }
      var existing = byId[p.id];
      var a = Number(existing.lastEdited || existing.createdAt || 0);
      var b = Number(p.lastEdited || p.createdAt || 0);
      if (b >= a) {
        byId[p.id] = p;
        byId[p.id].__source = source;
      }
    });
  };
  addAll(cloudList, 'cloud');
  addAll(localList, 'local');
  return Object.keys(byId).map(function (k) {
    var p = byId[k];
    if (p && p.__source) delete p.__source;
    return p;
  });
}

export function mergePayloads(localPayload, cloudPayload) {
  var localList = Array.isArray(localPayload) ? localPayload : (localPayload && localPayload.projects) ? localPayload.projects : [];
  var cloudList = Array.isArray(cloudPayload) ? cloudPayload : (cloudPayload && cloudPayload.projects) ? cloudPayload.projects : [];
  var mergedProjects = mergeProjects(normalizeProjects(localList), normalizeProjects(cloudList));
  var mergedOptions = mergeCustomOptions(localPayload && localPayload.customOptions || {}, cloudPayload && cloudPayload.customOptions || {});
  var mergedUpdated = Math.max(Number(localPayload && localPayload.lastUpdatedAt || 0), Number(cloudPayload && cloudPayload.lastUpdatedAt || 0));
  var mergedBackupAt = Math.max(Number(localPayload && localPayload.lastAutoBackupAt || 0), Number(cloudPayload && cloudPayload.lastAutoBackupAt || 0));
  return {
    projects: mergedProjects,
    customOptions: mergedOptions,
    lastUpdatedAt: mergedUpdated,
    lastAutoBackupAt: mergedBackupAt,
    savedAt: Date.now(),
  };
}
