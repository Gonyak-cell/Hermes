import { useEffect, useMemo, useState } from "react";
import { SHELL_SEED_STATE } from "../shared/shell-state.mjs";
import { LOCALE_STORAGE_KEY, getCopy } from "./i18n.js";
import { sectionForNav, summarizeRows } from "./view-model.js";

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
  desktop_read_authority: SHELL_SEED_STATE.authority_flags,
};

export default function App() {
  const [language, setLanguage] = usePersistentLanguage();
  const [activeNav, setActiveNav] = useState(getInitialNav());
  const [readModel, setReadModel] = useState(fallbackReadModel);
  const [sourcePreview, setSourcePreview] = useState(null);
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
    const sectionId = sectionForNav(activeNav);
    if (activeNav === "settings") return [];
    if (activeNav === "artifacts") return readModel.source_rows ?? [];
    return (readModel.source_rows ?? []).filter((row) => row.section_id === sectionId);
  }, [activeNav, readModel]);

  const rowSummary = summarizeRows(rows);
  const summary = readModel.summary ?? fallbackReadModel.summary;
  const authority = readModel.desktop_read_authority ?? SHELL_SEED_STATE.authority_flags;
  const projectionRows = projectionRowsForNav(activeNav, readModel);

  return (
    <main className="desktop-shell" lang={language}>
      <header className="top-band">
        <div className="brand-block">
          <div className="brand-mark">H</div>
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
              <EvidenceTable copy={copy} rows={rows} onPreview={setSourcePreview} />
              <SourcePreview copy={copy} preview={sourcePreview} />
            </>
          )}
        </section>

        <aside className="decision-panel">
          <h2>{copy.decisionBoundary}</h2>
          <div className="score-grid">
            <Metric label={copy.sources} value={`${summary.ready_source_count ?? 0}/${summary.source_count ?? 0}`} />
            <Metric label={copy.sections} value={`${summary.ready_section_count ?? 0}/${summary.section_count ?? 0}`} />
            <Metric label={copy.errors} value={summary.validation_error_count ?? 0} />
          </div>
          <BoundaryList copy={copy} authority={authority} />
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

function EvidenceTable({ copy, rows, onPreview }) {
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
            <tr key={`${row.section_id}.${row.source_id}`}>
              <td>
                <strong>{row.label}</strong>
                <small>{row.source_id}</small>
              </td>
              <td><StatusPill tone={row.status === "ready" ? "green" : "red"} label={row.status} /></td>
              <td className="path-cell">
                <button className="path-button" type="button" onClick={() => requestPreview(row.source_path, onPreview)}>
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
  if (activeNav === "release") return readModel.release_projection?.projection_rows ?? [];
  if (activeNav === "factory") return readModel.factory_projection?.projection_rows ?? [];
  return [];
}

function getInitialNav() {
  const screen = new URLSearchParams(globalThis.location?.search ?? "").get("screen");
  return SHELL_SEED_STATE.nav_items.some((item) => item.id === screen) ? screen : "release";
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
