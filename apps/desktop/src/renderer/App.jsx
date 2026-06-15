import { useEffect, useMemo, useState } from "react";
import { SHELL_SEED_STATE } from "../shared/shell-state.mjs";
import { LOCALE_STORAGE_KEY, getCopy } from "./i18n.js";
import { rowKey, rowsForNav, summarizeRows } from "./view-model.js";
import hermesControlLogo from "./hermes-control-logo.svg";

const fallbackReadModel = {
  summary: {
    desktop_read_model_status: "blocked_desktop_shell",
    ready_source_count: 0,
    source_count: 0,
    ready_section_count: 0,
    section_count: 0,
    operator_handbook_bound: false,
    authority_boundary_ready: false,
    validation_error_count: 1,
  },
  source_rows: [],
  sections: [],
  release_projection: {
    projection_rows: [
      { row_id: "deployment_authorization", label: "Deployment authorization", value: "not authorized", status: "closed" },
    ],
  },
  factory_projection: {
    projection_rows: [
      { row_id: "gate_open_now", label: "Gate open now", value: "0", status: "closed" },
    ],
  },
  project_projection: {
    projection_rows: [
      { row_id: "project_count", label: "Projects", value: "0", status: "blocked" },
    ],
    project_rows: [],
    project_detail_rows: [],
    project_attention_rows: [],
    safe_affordance_rows: [],
  },
  agent_projection: {
    projection_rows: [
      { row_id: "agent_execution", label: "Execution", value: "closed", status: "blocked" },
    ],
    runtime_rows: [],
    capability_rows: [],
    request_rows: [],
    receipt_rows: [],
    agent_control_rows: [],
  },
  desktop_read_authority: SHELL_SEED_STATE.authority_flags,
};

export default function App() {
  const [language, setLanguage] = usePersistentLanguage();
  const [activeNav, setActiveNav] = useState(getInitialNav());
  const [readModel, setReadModel] = useState(fallbackReadModel);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const copy = getCopy(language);

  useEffect(() => {
    let cancelled = false;
    window.hermesOperator?.getReadModel?.()
      .then((model) => {
        if (!cancelled) setReadModel(model ?? fallbackReadModel);
      })
      .catch(() => {
        if (!cancelled) setReadModel(fallbackReadModel);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return rowsForNav(activeNav, readModel);
  }, [activeNav, readModel]);

  const isProjectControlNav = activeNav === "projects" || activeNav === "queue";
  const isProjectContextNav = ["projects", "queue", "governance", "reviews", "gates", "evidence", "sources"].includes(activeNav);
  const isAgentNav = activeNav === "agents";
  const projectRows = readModel.project_projection?.project_rows ?? [];
  const rowSummary = isProjectControlNav
    ? {
      total: projectRows.length,
      ready: readModel.project_projection?.ready_project_count ?? projectRows.filter((row) => row.project_state === "ready_read_only").length,
      blocked: readModel.project_projection?.blocked_project_count ?? projectRows.filter((row) => row.project_state !== "ready_read_only").length,
    }
    : summarizeRows(rows);
  const selectedRow = rows.find((row) => rowKey(row) === selectedRowKey) ?? rows[0] ?? null;
  const selectedProject = projectRows.find((row) => row.project_id === selectedProjectId) ?? projectRows[0] ?? null;
  const selectedProjectDetail = (readModel.project_projection?.project_detail_rows ?? []).find((row) => row.project_id === selectedProject?.project_id) ?? null;
  const summary = readModel.summary ?? fallbackReadModel.summary;
  const authority = readModel.desktop_read_authority ?? SHELL_SEED_STATE.authority_flags;
  const projectionRows = projectionRowsForNav(activeNav, readModel);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRowKey(null);
      return;
    }
    if (!rows.some((row) => rowKey(row) === selectedRowKey)) setSelectedRowKey(rowKey(rows[0]));
  }, [rows, selectedRowKey]);

  useEffect(() => {
    if (!isProjectContextNav || projectRows.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    if (!projectRows.some((row) => row.project_id === selectedProjectId)) setSelectedProjectId(projectRows[0].project_id);
  }, [isProjectContextNav, projectRows, selectedProjectId]);

  return (
    <main className="desktop-shell" lang={language}>
      <header className="top-band">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <img src={hermesControlLogo} alt="" />
          </div>
          <div>
            <h1>Hermes Operator Desktop</h1>
            <p>{copy.statusLine}</p>
          </div>
        </div>
        <div className="top-metrics" aria-label="desktop status">
          <StatusPill tone="green" label={copy.readOnly} />
          <StatusPill tone="blue" label="single-owner lower-trust RC" />
          <StatusPill tone="amber" label={copy.authorityClosed} />
          <button className="language-toggle" type="button" onClick={() => setLanguage(language === "ko" ? "en" : "ko")}>
            <span className={language === "ko" ? "active" : ""}>Korean</span>
            <span className={language === "en" ? "active" : ""}>English</span>
          </button>
        </div>
      </header>

      <section className="workspace-grid">
        <nav className="side-rail" aria-label="desktop navigation">
          {SHELL_SEED_STATE.nav_items.map((item) => (
            <button
              className={`nav-item ${activeNav === item.id ? "selected" : ""}`}
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
            >
              <span>{language === "ko" ? item.label_ko : item.label_en}</span>
              <small>{copy.navSub[item.id]}</small>
            </button>
          ))}
        </nav>

        <section className="evidence-panel">
          <div className="panel-heading">
            <div>
              <h2>{copy.screenTitle[activeNav]}</h2>
              <p>{copy.screenLead[activeNav]}</p>
            </div>
            <div className="section-counts">
              <span>{rowSummary.ready}/{rowSummary.total}</span>
              <small>{copy.readyRows}</small>
            </div>
          </div>
          {activeNav === "settings" ? (
            <SettingsView copy={copy} language={language} summary={summary} />
          ) : (
            <>
              <ProjectionStrip copy={copy} rows={projectionRows} />
              {isProjectControlNav ? (
                <ProjectControlTable
                  copy={copy}
                  rows={projectRows}
                  selectedProjectId={selectedProject?.project_id ?? null}
                  onSelectProject={setSelectedProjectId}
                />
              ) : null}
              {isProjectContextNav ? (
                <ProjectAttentionPanel
                  copy={copy}
                  rows={readModel.project_projection?.project_attention_rows ?? []}
                  selectedProjectId={selectedProject?.project_id ?? null}
                />
              ) : null}
              {isProjectContextNav ? (
                <SafeAffordancePanel copy={copy} rows={readModel.project_projection?.safe_affordance_rows ?? []} />
              ) : null}
              {isAgentNav ? (
                <AgentBridgePanel copy={copy} projection={readModel.agent_projection ?? fallbackReadModel.agent_projection} />
              ) : null}
              <EvidenceTable copy={copy} rows={rows} selectedRowKey={selectedRow ? rowKey(selectedRow) : null} onSelect={setSelectedRowKey} onPreview={setSourcePreview} />
              <SourcePreview copy={copy} preview={sourcePreview} />
            </>
          )}
        </section>

        <aside className="decision-panel">
          <h2>{copy.decisionBoundary}</h2>
          <div className="score-grid">
            <Metric label={copy.sources} value={`${summary.ready_source_count ?? 0}/${summary.source_count ?? 0}`} />
            <Metric label={copy.sections} value={`${summary.ready_section_count ?? 0}/${summary.section_count ?? 0}`} />
            <Metric label="Projects" value={`${summary.ready_project_count ?? 0}/${summary.project_count ?? 0}`} />
            <Metric label={copy.errors} value={summary.validation_error_count ?? 0} />
          </div>
          {isProjectContextNav ? <ProjectInspector copy={copy} project={selectedProject} detail={selectedProjectDetail} /> : null}
          <BoundaryList copy={copy} authority={authority} />
          <ObjectInspector copy={copy} row={selectedRow} onPreview={setSourcePreview} />
        </aside>
      </section>

      <footer className="no-action-bar">
        <span>{copy.noAction}</span>
        <span>No deploy</span>
        <span>No approval apply</span>
        <span>No secret read</span>
      </footer>
    </main>
  );
}

function AgentBridgePanel({ copy, projection }) {
  const runtimeRows = projection?.runtime_rows ?? [];
  const capabilityRows = projection?.capability_rows ?? [];
  const requestRows = projection?.request_rows ?? [];
  const receiptRows = projection?.receipt_rows ?? [];
  const controlRows = projection?.agent_control_rows ?? [];
  return (
    <section className="agent-bridge-panel" aria-label={copy.agentPanel}>
      <div className="project-control-heading">
        <h3>{copy.agentPanel}</h3>
        <small>{copy.displayOnly}</small>
      </div>
      <div className="agent-summary-grid">
        <Metric label={copy.agentRuntimeTable} value={projection?.runtime_count ?? runtimeRows.length} />
        <Metric label={copy.agentCapabilityTable} value={projection?.capability_count ?? capabilityRows.length} />
        <Metric label={copy.agentRequestTable} value={projection?.request_count ?? requestRows.length} />
        <Metric label={copy.agentReceiptTable} value={projection?.receipt_count ?? receiptRows.length} />
      </div>
      <div className="agent-grid">
        <AgentRuntimeTable copy={copy} rows={runtimeRows} />
        <AgentCapabilityTable copy={copy} rows={capabilityRows.slice(0, 8)} />
        <AgentRequestTable copy={copy} rows={requestRows} />
        <AgentReceiptTable copy={copy} rows={receiptRows} />
      </div>
      <div className="agent-control-strip" aria-label={copy.agentControls}>
        {controlRows.map((row) => (
          <span className="disabled-control-chip" key={row.control_id} title={row.disabled_reason}>
            {row.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function AgentRuntimeTable({ copy, rows }) {
  return (
    <div className="agent-table-card">
      <h4>{copy.agentRuntimeTable}</h4>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Runtime</th>
            <th>Model</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.runtime_id}>
              <td><strong>{row.display_name}</strong><small>{row.runtime_kind}</small></td>
              <td>{row.model_label_observed}</td>
              <td><StatusPill tone={row.executable ? "red" : "green"} label={row.executable ? "open" : "closed"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentCapabilityTable({ copy, rows }) {
  return (
    <div className="agent-table-card">
      <h4>{copy.agentCapabilityTable}</h4>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Kind</th>
            <th>Permission</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.capability_id}>
              <td><strong>{row.capability_name}</strong><small>{row.runtime_id}</small></td>
              <td>{formatProjectionText(row.capability_kind)}</td>
              <td><StatusPill tone={row.executable ? "red" : "green"} label={row.executable ? "open" : "closed"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentRequestTable({ copy, rows }) {
  return (
    <div className="agent-table-card">
      <h4>{copy.agentRequestTable}</h4>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Status</th>
            <th>Boundary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.request_id}>
              <td><strong>{row.request_title}</strong><small>{formatProjectionText(row.request_type)}</small></td>
              <td>{formatProjectionText(row.request_status)}</td>
              <td><StatusPill tone={row.execution_allowed_now ? "red" : "green"} label={row.execution_allowed_now ? "open" : "closed"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentReceiptTable({ copy, rows }) {
  return (
    <div className="agent-table-card">
      <h4>{copy.agentReceiptTable}</h4>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Verdict</th>
            <th>Apply</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.receipt_id}>
              <td><strong>{row.receipt_id}</strong><small>{formatProjectionText(row.receipt_kind)}</small></td>
              <td>{formatProjectionText(row.normalized_verdict)}</td>
              <td><StatusPill tone={row.receipt_applied ? "red" : "green"} label={row.receipt_applied ? "open" : "closed"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectionStrip({ copy, rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="projection-strip" aria-label={copy.projection}>
      {rows.map((row) => (
        <div className="projection-item" key={row.row_id}>
          <span>{row.label}</span>
          <strong>{formatProjectionText(row.value)}</strong>
          <small>{formatProjectionText(row.status)}</small>
        </div>
      ))}
    </div>
  );
}

function ProjectControlTable({ copy, rows, selectedProjectId, onSelectProject }) {
  if (rows.length === 0) return <div className="empty-state">{copy.empty}</div>;
  return (
    <section className="project-control" aria-label={copy.projectTable}>
      <div className="project-control-heading">
        <h3>{copy.projectTable}</h3>
        <small>{rows.length} projects</small>
      </div>
      <div className="project-table-wrap">
        <table className="project-table">
          <thead>
            <tr>
              <th>{copy.projectName}</th>
              <th>{copy.projectState}</th>
              <th>{copy.projectDomain}</th>
              <th>{copy.projectPhase}</th>
              <th>{copy.projectBlockers}</th>
              <th>{copy.projectFreshness}</th>
              <th>{copy.projectNextAction}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={selectedProjectId === row.project_id ? "selected-row" : ""} key={row.project_id} onClick={() => onSelectProject(row.project_id)}>
                <td>
                  <strong>{row.project_name}</strong>
                  <small>{row.project_id}</small>
                </td>
                <td><StatusPill tone={projectStateTone(row.project_state)} label={formatProjectionText(row.project_state)} /></td>
                <td>{row.domain_pack}</td>
                <td>
                  <strong>{row.current_phase_range ?? "-"}</strong>
                  <small>{row.current_goal_id ?? "-"}</small>
                </td>
                <td>{row.blocker_count}</td>
                <td>{formatProjectionText(row.freshness_status)}</td>
                <td><span className="safe-action-chip">{row.next_allowed_action}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectAttentionPanel({ copy, rows, selectedProjectId }) {
  const visibleRows = rows.filter((row) => !selectedProjectId || row.project_id === selectedProjectId).slice(0, 4);
  if (visibleRows.length === 0) return null;
  return (
    <section className="project-attention" aria-label={copy.projectAttention}>
      <div className="project-control-heading">
        <h3>{copy.projectAttention}</h3>
        <small>{visibleRows.length} rows</small>
      </div>
      <div className="attention-grid">
        {visibleRows.map((row) => (
          <div className={`attention-card ${row.severity}`} key={`${row.project_id}.${row.attention_type}`}>
            <span>{formatProjectionText(row.attention_type)}</span>
            <strong>{row.label}</strong>
            <p>{row.detail}</p>
            <small>{row.next_safe_action}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SafeAffordancePanel({ copy, rows }) {
  const visibleRows = rows.filter((row) => row.allowed === true).slice(0, 6);
  if (visibleRows.length === 0) return null;
  return (
    <section className="safe-affordances" aria-label={copy.safeAffordances}>
      <div className="project-control-heading">
        <h3>{copy.safeAffordances}</h3>
        <small>{copy.displayOnly}</small>
      </div>
      <div className="safe-affordance-row">
        {visibleRows.map((row) => (
          <span className="safe-action-chip" title={row.hint} key={row.action_type}>
            {row.display_label}
          </span>
        ))}
      </div>
    </section>
  );
}

function ProjectInspector({ copy, project, detail }) {
  return (
    <section className="project-inspector" aria-label={copy.projectTable}>
      <h3>{copy.projectTable}</h3>
      {project ? (
        <>
          <div className="inspector-title">
            <strong>{project.project_name}</strong>
            <StatusPill tone={projectStateTone(project.project_state)} label={formatProjectionText(project.project_state)} />
          </div>
          {detail ? (
            <div className="project-detail-strip">
              <ProjectDetailItem label="Risk" value={formatProjectionText(detail.risk_level)} />
              <ProjectDetailItem label="Remaining" value={String(detail.remaining_units)} />
              <ProjectDetailItem label="Source age" value={`${detail.source_age_days}d`} />
              <ProjectDetailItem label="Unsafe flags" value={String(detail.unsafe_flag_count)} />
            </div>
          ) : null}
          <InspectorField label="project_id" value={project.project_id} />
          <InspectorField label={copy.projectDomain} value={project.domain_pack} />
          <InspectorField label={copy.projectPhase} value={project.current_phase_range ?? "-"} />
          <InspectorField label="goal" value={project.current_goal_id ?? "-"} />
          <InspectorField label={copy.projectBlockers} value={String(project.blocker_count)} />
          <InspectorField label={copy.projectFreshness} value={formatProjectionText(project.freshness_status)} />
          <InspectorField label="confidence" value={formatProjectionText(project.progress_confidence)} />
          <InspectorField label={copy.projectNextAction} value={project.next_allowed_action} />
          {detail ? (
            <>
              <InspectorField label="state reason" value={formatProjectionText(detail.state_reason)} />
              <InspectorField label="risk" value={formatProjectionText(detail.risk_level)} />
              <InspectorField label="validation" value={detail.validation_ready ? "ready" : "blocked"} />
              <InspectorField label="review boundary" value={detail.review_boundary_ready ? "ready" : "blocked"} />
              <InspectorField label="remaining units" value={String(detail.remaining_units)} />
              <InspectorField label="source age days" value={String(detail.source_age_days)} />
              <InspectorField label="source path" value={detail.source_artifact_path || "-"} />
              <InspectorField label="authority unsafe flags" value={String(detail.unsafe_flag_count)} />
            </>
          ) : null}
        </>
      ) : (
        <p>{copy.noSelection}</p>
      )}
    </section>
  );
}

function ProjectDetailItem({ label, value }) {
  return (
    <div className="project-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EvidenceTable({ copy, rows, selectedRowKey, onSelect, onPreview }) {
  if (rows.length === 0) {
    return <div className="empty-state">{copy.empty}</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{copy.source}</th>
            <th>Status</th>
            <th>{copy.path}</th>
            <th>Blocker</th>
            <th>generated_at</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={selectedRowKey === rowKey(row) ? "selected-row" : ""} key={rowKey(row)} onClick={() => onSelect(rowKey(row))}>
              <td>
                <strong>{row.label}</strong>
                <small>{row.source_id}</small>
              </td>
              <td><StatusPill tone={row.status === "ready" ? "green" : "red"} label={row.status} /></td>
              <td className="path-cell">
                <button className="path-button" type="button" onClick={(event) => {
                  event.stopPropagation();
                  onSelect(rowKey(row));
                  requestPreview(row.source_path, onPreview);
                }}>
                  {row.source_path}
                </button>
              </td>
              <td>{row.blocker ?? "-"}</td>
              <td>{row.generated_at ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectInspector({ copy, row, onPreview }) {
  return (
    <section className="object-inspector" aria-label={copy.objectInspector}>
      <h3>{copy.objectInspector}</h3>
      {row ? (
        <>
          <div className="inspector-title">
            <strong>{row.label}</strong>
            <StatusPill tone={row.status === "ready" ? "green" : "red"} label={row.status} />
          </div>
          <InspectorField label="source_id" value={row.source_id} />
          <InspectorField label="section_id" value={row.section_id} />
          <InspectorField label={copy.path} value={row.source_path} />
          <InspectorField label="generated_at" value={row.generated_at ?? "-"} />
          <InspectorField label={copy.hash} value={row.source_content_hash ?? "-"} />
          <InspectorField label="blocker" value={row.blocker ?? "-"} />
          <button className="preview-button" type="button" onClick={() => requestPreview(row.source_path, onPreview)}>
            {copy.previewSource}
          </button>
        </>
      ) : (
        <p>{copy.noSelection}</p>
      )}
    </section>
  );
}

function InspectorField({ label, value }) {
  return (
    <div className="inspector-field">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function SourcePreview({ copy, preview }) {
  if (!preview) return null;
  return (
    <section className={`source-preview ${preview.status}`} aria-label={copy.preview}>
      <div className="source-preview-heading">
        <strong>{preview.source_path}</strong>
        <StatusPill tone={preview.status === "ready" ? "green" : "red"} label={preview.status} />
      </div>
      {preview.status === "ready" ? (
        <pre>{preview.preview_text}</pre>
      ) : (
        <p>{preview.blocker}</p>
      )}
    </section>
  );
}

function SettingsView({ copy, language, summary }) {
  return (
    <div className="settings-grid">
      <Metric label={copy.language} value={language === "ko" ? "Korean" : "English"} />
      <Metric label={copy.mode} value={copy.readOnly} />
      <Metric label="RC" value="single-owner lower-trust RC" />
      <Metric label={copy.boundary} value={summary.authority_boundary_ready ? "ready" : "blocked"} />
    </div>
  );
}

function BoundaryList({ copy, authority }) {
  const entries = [
    ["deploy", authority.deployment_allowed_now],
    ["gitPush", authority.git_push_allowed_now],
    ["approvalApply", authority.approval_application_allowed_now],
    ["receiptApply", authority.receipt_application_allowed_now],
    ["connectorWrite", authority.connector_write_allowed_now],
    ["secretRead", authority.secret_read_allowed_now],
    ["rawExposure", authority.raw_source_exposure_allowed],
    ["desktopWrite", authority.desktop_write_authority_enabled],
  ];
  return (
    <div className="boundary-list">
      {entries.map(([key, value]) => (
        <div className="boundary-row" key={key}>
          <span>{copy.boundaryRows[key]}</span>
          <StatusPill tone={value === true ? "red" : "green"} label={value === true ? "open" : "closed"} />
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ tone, label }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function projectStateTone(state) {
  if (state === "ready_read_only") return "green";
  if (state === "blocked" || state === "stale") return "red";
  return "amber";
}

function usePersistentLanguage() {
  const [language, setLanguageState] = useState(() => {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    return stored === "en" ? "en" : "ko";
  });
  const setLanguage = (next) => {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next);
    setLanguageState(next);
  };
  return [language, setLanguage];
}

function projectionRowsForNav(activeNav, readModel) {
  if (["projects", "queue"].includes(activeNav)) return readModel.project_projection?.projection_rows ?? [];
  if (activeNav === "agents") return readModel.agent_projection?.projection_rows ?? [];
  if (["queue", "release", "requirements"].includes(activeNav)) return readModel.release_projection?.projection_rows ?? [];
  if (activeNav === "reviews") return pickProjectionRows(readModel.project_projection?.projection_rows, ["review_needed_projects", "blocked_projects", "project_authority"]);
  if (activeNav === "gates") return [
    ...(readModel.factory_projection?.projection_rows ?? []).slice(0, 3),
    ...pickProjectionRows(readModel.project_projection?.projection_rows, ["blocked_projects", "stale_projects"]),
  ].slice(0, 5);
  if (["factory"].includes(activeNav)) return readModel.factory_projection?.projection_rows ?? [];
  if (activeNav === "governance") return [
    ...pickProjectionRows(readModel.project_projection?.projection_rows, ["project_authority", "blocked_projects", "review_needed_projects"]),
    ...(readModel.release_projection?.projection_rows ?? []),
    ...(readModel.factory_projection?.projection_rows ?? []),
  ].slice(0, 5);
  if (["evidence", "sources"].includes(activeNav)) return pickProjectionRows(readModel.project_projection?.projection_rows, ["project_count", "refresh_required", "project_authority"]);
  return [];
}

function pickProjectionRows(rows = [], ids = []) {
  return ids.map((id) => rows.find((row) => row.row_id === id)).filter(Boolean);
}

function getInitialNav() {
  const screen = new URLSearchParams(globalThis.location?.search ?? "").get("screen");
  return SHELL_SEED_STATE.nav_items.some((item) => item.id === screen) ? screen : "queue";
}

function formatProjectionText(value) {
  const text = String(value ?? "");
  if (/^[a-f0-9]{32,}$/i.test(text) || text.startsWith("v0.")) return text;
  return text.replaceAll("_", " ");
}

async function requestPreview(sourcePath, onPreview) {
  try {
    const preview = await window.hermesOperator?.getSourcePreview?.(sourcePath);
    onPreview(preview ?? {
      source_path: sourcePath,
      status: "blocked",
      blocker: "Preview API unavailable.",
      preview_text: "",
    });
  } catch (error) {
    onPreview({
      source_path: sourcePath,
      status: "blocked",
      blocker: error.message,
      preview_text: "",
    });
  }
}
