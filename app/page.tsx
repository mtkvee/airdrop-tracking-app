"use client";

import { useEffect } from "react";
import { initApp } from "./legacy/initApp";

export default function HomePage() {
  useEffect(() => {
    initApp();
  }, []);

  return (
    <>
      <div
        className="auth-status-banner is-hidden"
        id="authStatusBar"
        role="status"
        aria-live="polite"
      >
        <div className="auth-status">
          <span
            className="auth-status-icon"
            id="authStatusIcon"
            aria-hidden="true"
          ></span>
          <span className="auth-status-text" id="authStatusText"></span>
        </div>
      </div>
      <h1 className="app-title">
        Airdrop Tracer <span className="app-version">(v1.0.1)</span>
      </h1>
      <div className="social-icons">
        <a
          className="social-icon"
          href="https://x.com/vee_mtk"
          target="_blank"
          rel="noreferrer"
        >
          <i className="fa-brands fa-x-twitter"></i>
          <span>Vee</span>
        </a>
      </div>
      <div className="app">
        <header className="header">
          <div className="auth-bar">
            <button
              type="button"
              className="btn-auth"
              id="signInBtn"
              aria-label="Sign in with Google"
            >
              <i className="fa-brands fa-google"></i> Sign in
            </button>
            <div className="auth-user is-hidden" id="authUser"></div>
            <button
              type="button"
              className="btn-auth btn-auth-ghost is-hidden"
              id="signOutBtn"
              aria-label="Sign out"
            >
              <i className="fa-brands fa-google"></i> Sign out
            </button>
            <div className="data-import-export">
              <button
                type="button"
                className="btn-import-export"
                id="exportBtn"
                aria-label="Export airdrops"
                title="Export"
              >
                <i className="fas fa-download"></i>
              </button>
              <button
                type="button"
                className="btn-import-export"
                id="importBtn"
                aria-label="Import airdrops"
                title="Import"
              >
                <i className="fas fa-upload"></i>
              </button>
              <input
                type="file"
                id="importFileInput"
                accept=".json,application/json"
                hidden
              />
            </div>
          </div>
          <div className="header-actions">
            <div className="header-main-actions-btns">
              <button
                type="button"
                className="btn-add-airdrop"
                id="addAirdropBtn"
                aria-label="Add airdrop"
              >
                <i className="fas fa-plus"></i>New
              </button>
              <button
                type="button"
                className="btn-manage-options"
                id="manageOptionsBtn"
                aria-label="Manage select options"
                title="Manage select options"
              >
                <i className="fa-solid fa-bars-progress"></i>
              </button>
              <button
                type="button"
                className="btn-delete-all"
                id="deleteAllBtn"
                aria-label="Delete all airdrops"
                title="Delete all airdrops"
              >
                <i className="fas fa-trash"></i>All
              </button>
            </div>
          </div>
          <div className="header-helper-text">Add, Track & Manage Airdrops</div>
          <div className="header-filters">
            <div className="search-wrap">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                className="search-input"
                placeholder="Search airdrops"
                id="searchInput"
              />
            </div>
          </div>
        </header>

        <main className="main">
          <div className="last-updated-section" id="lastUpdatedSection">
            <div className="last-updated-status">
              <i className="fas fa-sync-alt last-updated-icon"></i>
              <span className="last-updated-text">
                Last updated: <span id="lastUpdatedTime">Just now</span>
              </span>
            </div>
            <div className="counter-row">
              <div className="task-count-dropdown" id="taskCountDropdown">
                <button
                  type="button"
                  className="task-count-trigger"
                  id="taskCountTrigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  Task <i className="fas fa-chevron-down"></i>
                </button>
                <div
                  className="task-count-menu"
                  id="taskCountMenu"
                  role="listbox"
                ></div>
              </div>
              <div className="task-count-dropdown" id="connectCountDropdown">
                <button
                  type="button"
                  className="task-count-trigger"
                  id="connectCountTrigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  Connect <i className="fas fa-chevron-down"></i>
                </button>
                <div
                  className="task-count-menu"
                  id="connectCountMenu"
                  role="listbox"
                ></div>
              </div>
              <div className="task-count-dropdown" id="statusCountDropdown">
                <button
                  type="button"
                  className="task-count-trigger"
                  id="statusCountTrigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  Status <i className="fas fa-chevron-down"></i>
                </button>
                <div
                  className="task-count-menu"
                  id="statusCountMenu"
                  role="listbox"
                ></div>
              </div>
              <div className="counter-tools">
                <div className="filter-bar">
                  <button
                    type="button"
                    className="btn-recent"
                    id="recentBtn"
                    aria-label="Toggle recent view"
                    title="Recent"
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    className="btn-remove-filters"
                    id="removeFiltersBtn"
                    aria-label="Remove filters"
                    title="Remove filters"
                  >
                    <i className="fa-solid fa-filter-circle-xmark"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-name sortable" data-sort="name">
                    Name <i className="fas fa-sort"></i>
                  </th>
                  <th className="col-task sortable" data-sort="taskType">
                    Task
                  </th>
                  <th className="col-tasktype sortable" data-sort="connectType">
                    Connect
                  </th>
                  <th className="col-status sortable" data-sort="status">
                    Status
                  </th>
                  <th className="col-reward sortable" data-sort="rewardType">
                    Reward
                  </th>
                  <th className="col-actions col-header-center">Actions</th>
                </tr>
              </thead>
              <tbody id="tableBody"></tbody>
            </table>
          </div>
        </main>
      </div>

      <div className="modal-overlay" id="airdropFormModal" aria-hidden="true">
        <div
          className="modal modal-form"
          role="dialog"
          aria-labelledby="airdropFormTitle"
        >
          <div className="modal-header">
            <h2 id="airdropFormTitle" className="modal-title">
              Add Airdrop
            </h2>
            <button
              type="button"
              className="modal-close"
              id="airdropFormClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body modal-body-form">
            <form id="airdropForm" className="airdrop-form">
              <input type="hidden" id="airdropId" name="id" defaultValue="" />
              <div className="form-row two-cols">
                <div className="form-group">
                  <label htmlFor="airdropName">Name</label>
                  <input
                    type="text"
                    id="airdropName"
                    name="name"
                    required
                    placeholder="e.g. Bitcoin"
                    autoComplete="true"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="airdropCode">Code</label>
                  <input
                    type="text"
                    id="airdropCode"
                    name="code"
                    placeholder="e.g. BTC"
                  />
                </div>
              </div>
              <div
                id="airdropFormError"
                className="form-error is-hidden"
                aria-live="assertive"
              ></div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="airdropLink">Link</label>
                  <input
                    type="url"
                    id="airdropLink"
                    name="link"
                    placeholder="e.g. https://bitcoin.org"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <select
                    id="airdropExtraLinkType"
                    name="extraLinkType"
                    className="is-hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                  ></select>
                  <a
                    href="#"
                    id="addMoreLinksAnchor"
                    className="add-more-links-anchor"
                  >
                    Add more links
                  </a>
                  <div
                    id="airdropExtraLinks"
                    className="extra-links-list"
                  ></div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="airdropTaskType">Task</label>
                  <select
                    id="airdropTaskType"
                    name="taskType"
                    multiple
                    size={4}
                  ></select>
                </div>
              </div>
              <div className="form-section">Task details</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="airdropConnectType">Connect</label>
                  <select
                    id="airdropConnectType"
                    name="connectType"
                    multiple
                    size={4}
                  ></select>
                </div>
              </div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label htmlFor="airdropTaskCost">Cost ($)</label>
                  <input
                    type="number"
                    id="airdropTaskCost"
                    name="taskCost"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="airdropTaskTime">Time (min)</label>
                  <input
                    type="number"
                    id="airdropTaskTime"
                    name="taskTime"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-section">Status &amp; reward</div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label htmlFor="airdropStatus">Status</label>
                  <select id="airdropStatus" name="status"></select>
                </div>
                <div className="form-group">
                  <label htmlFor="airdropStatusDate">Status date</label>
                  <input
                    type="text"
                    id="airdropStatusDate"
                    name="statusDate"
                    placeholder="31 Jan 2026"
                  />
                </div>
              </div>
              <div className="form-row reward-form-row">
                <div className="form-group">
                  <label htmlFor="airdropRewardType">Reward</label>
                  <select
                    id="airdropRewardType"
                    name="rewardType"
                    multiple
                    size={4}
                  ></select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="airdropNote">Note</label>
                  <textarea
                    id="airdropNote"
                    name="note"
                    rows={3}
                    maxLength={280}
                    placeholder="Short note about this airdrop"
                  ></textarea>
                </div>
              </div>
              <div className="add-airdrop-message">
                Click "Save Airdrop" to add your airdrop.
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="airdropFormCancel"
            >
              Cancel
            </button>
            <button type="submit" form="airdropForm" className="btn-apply">
              Save Airdrop
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="filtersModal" aria-hidden="true">
        <div
          className="modal modal-form"
          role="dialog"
          aria-labelledby="filtersTitle"
        >
          <div className="modal-header">
            <h2 id="filtersTitle" className="modal-title">
              Filters
            </h2>
            <button
              type="button"
              className="modal-close"
              id="filtersClose"
              aria-label="Close filters"
              title="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body modal-body-form">
            <div className="filter-modal-grid">
              <label className="filter-modal-field">
                <span>Task</span>
                <select className="filter-select" id="taskFilter"></select>
              </label>
              <label className="filter-modal-field">
                <span>Connect</span>
                <select className="filter-select" id="taskTypeFilter">
                  <option value="">All</option>
                  <option value="evm">EVM</option>
                  <option value="gmail">Gmail</option>
                  <option value="google">Google</option>
                  <option value="sol">SOL</option>
                  <option value="discord">Discord</option>
                  <option value="x">X</option>
                </select>
              </label>
              <label className="filter-modal-field">
                <span>Status</span>
                <select className="filter-select" id="statusFilter"></select>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" id="filtersClear">
              Clear
            </button>
            <button type="button" className="btn-apply" id="filtersDone">
              Done
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="manageOptionsModal" aria-hidden="true">
        <div
          className="modal modal-form"
          role="dialog"
          aria-labelledby="manageOptionsTitle"
        >
          <div className="modal-header">
            <h2 id="manageOptionsTitle" className="modal-title">
              Manage Options
            </h2>
            <button
              type="button"
              className="modal-close"
              id="manageOptionsClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body modal-body-form">
            <form id="manageOptionsForm" className="manage-options-form">
              <div className="form-section">Select to Manage</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="selectToManage">Field</label>
                  <select id="selectToManage" name="selectField">
                    <option value="airdropTaskType">Task</option>
                    <option value="airdropConnectType">Connect</option>
                    <option value="airdropStatus">Status</option>
                    <option value="airdropRewardType">Reward</option>
                    <option value="airdropExtraLinkType">Sub link</option>
                  </select>
                </div>
              </div>

              <div className="form-section">Current Options</div>
              <div className="form-group">
                <div id="optionsList" className="options-list-container"></div>
              </div>

              <div className="form-section">Add New Option</div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label htmlFor="newOptionValue">Value</label>
                  <input
                    type="text"
                    id="newOptionValue"
                    name="newOptionValue"
                    placeholder="e.g. evm"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="newOptionText">Display Text</label>
                  <input
                    type="text"
                    id="newOptionText"
                    name="newOptionText"
                    placeholder="e.g. EVM"
                  />
                </div>
              </div>
              <p className="add-option-message">
                Fill Value &amp; Display Text first, then click "Add Option".
              </p>
              <button type="button" className="btn-secondary" id="addOptionBtn">
                <i className="fas fa-plus"></i> Add Option
              </button>
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="manageOptionsCancel"
            >
              Reset All Options
            </button>
            <button type="button" className="btn-apply" id="manageOptionsSave">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div
        className="modal-overlay"
        id="resetOptionsConfirmModal"
        aria-hidden="true"
      >
        <div
          className="modal modal-sm"
          role="dialog"
          aria-labelledby="resetOptionsConfirmTitle"
        >
          <div className="modal-header">
            <h2 id="resetOptionsConfirmTitle" className="modal-title">
              Reset All Options?
            </h2>
            <button
              type="button"
              className="modal-close"
              id="resetOptionsConfirmClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <p>
              This will delete all options in Task, Connect, Status, Reward, and
              Sub link.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="resetOptionsConfirmCancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              id="resetOptionsConfirmOk"
            >
              <i className="fas fa-trash-alt"></i> Reset
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editOptionModal" aria-hidden="true">
        <div
          className="modal modal-form"
          role="dialog"
          aria-labelledby="editOptionTitle"
        >
          <div className="modal-header">
            <h2 id="editOptionTitle" className="modal-title">
              Edit Option
            </h2>
            <button
              type="button"
              className="modal-close"
              id="editOptionClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body modal-body-form">
            <form id="editOptionForm" className="edit-option-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editOptionValue">Value</label>
                  <input
                    type="text"
                    id="editOptionValue"
                    name="editOptionValue"
                    placeholder="e.g. quest"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editOptionText">Display Text</label>
                  <input
                    type="text"
                    id="editOptionText"
                    name="editOptionText"
                    placeholder="e.g. Quest"
                  />
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="editOptionCancel"
            >
              Cancel
            </button>
            <button type="button" className="btn-apply" id="editOptionSave">
              Update Option
            </button>
          </div>
        </div>
      </div>

      <div
        className="modal-overlay"
        id="deleteAllConfirmModal"
        aria-hidden="true"
      >
        <div
          className="modal"
          role="dialog"
          aria-labelledby="deleteAllConfirmTitle"
        >
          <div className="modal-header">
            <h2 id="deleteAllConfirmTitle" className="modal-title">
              Delete All Airdrops
            </h2>
            <button
              type="button"
              className="modal-close"
              id="deleteAllConfirmClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <p id="deleteAllConfirmMessage">
              Are you sure you want to delete all airdrops? This action cannot
              be undone.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="deleteAllConfirmCancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              id="deleteAllConfirmOk"
            >
              <i className="fas fa-trash-alt"></i> Delete All
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="deleteConfirmModal" aria-hidden="true">
        <div
          className="modal modal-sm"
          role="dialog"
          aria-labelledby="deleteConfirmTitle"
        >
          <div className="modal-header">
            <h2 id="deleteConfirmTitle" className="modal-title">
              Delete airdrop?
            </h2>
            <button
              type="button"
              className="modal-close"
              id="deleteConfirmClose"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <p id="deleteConfirmMessage">
              This will remove the airdrop from the list. This action cannot be
              undone.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              id="deleteConfirmCancel"
            >
              Cancel
            </button>
            <button type="button" className="btn-danger" id="deleteConfirmOk">
              <i className="fas fa-trash-alt"></i> Delete
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="back-to-top"
        id="backToTopBtn"
        aria-label="Back to top"
        title="Back to top"
      >
        <i className="fas fa-arrow-up"></i>
      </button>
    </>
  );
}
