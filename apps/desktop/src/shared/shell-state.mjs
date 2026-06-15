export const APP_TITLE = "Hermes Operator Desktop";

export const NAV_ITEMS = [
  { id: "queue", label_en: "Queue", label_ko: "Queue" },
  { id: "projects", label_en: "Projects", label_ko: "Projects" },
  { id: "requirements", label_en: "Requirements", label_ko: "Requirements" },
  { id: "evidence", label_en: "Evidence", label_ko: "Evidence" },
  { id: "reviews", label_en: "Reviews", label_ko: "Reviews" },
  { id: "gates", label_en: "Gates", label_ko: "Gates" },
  { id: "conversations", label_en: "Conversations", label_ko: "Conversations" },
  { id: "governance", label_en: "Governance", label_ko: "Governance" },
  { id: "sources", label_en: "Sources", label_ko: "Sources" },
  { id: "release", label_en: "Release", label_ko: "Release" },
  { id: "factory", label_en: "Factory", label_ko: "Factory" },
  { id: "settings", label_en: "Settings", label_ko: "Settings" },
];

export const CLOSED_AUTHORITY_FLAGS = Object.freeze({
  command_execution_allowed_now: false,
  shell_execution_allowed_now: false,
  deployment_allowed_now: false,
  git_push_allowed_now: false,
  approval_application_allowed_now: false,
  receipt_application_allowed_now: false,
  connector_write_allowed_now: false,
  secret_read_allowed_now: false,
  raw_source_exposure_allowed: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
  protected_closeout_enabled: false,
  desktop_write_authority_enabled: false,
});

export const SHELL_SEED_STATE = Object.freeze({
  app_title: APP_TITLE,
  shell_status: "read_only_shell_ready",
  release_label: "single-owner lower-trust RC",
  language_options: ["ko", "en"],
  nav_items: NAV_ITEMS,
  authority_flags: CLOSED_AUTHORITY_FLAGS,
  notices: [
    "Desktop is a read-only operator surface.",
    "No deploy, approval apply, receipt apply, connector write, secret read, or raw source exposure.",
  ],
});

export const FORBIDDEN_DESKTOP_TRUST_COPY = [
  "production PASS",
  "enterprise PASS",
  "GitHub independent approval",
  "Production launch approval",
  "deployment authorization",
  "protected closeout complete",
  "independently approved",
  "production launch approved",
  "desktop write authority enabled",
];

export function unsafeAuthorityFlagCount(flags = CLOSED_AUTHORITY_FLAGS) {
  return Object.values(flags).filter((value) => value === true).length;
}

export function containsForbiddenDesktopTrustCopy(value) {
  return findForbiddenDesktopTrustCopy(value).length > 0;
}

export function findForbiddenDesktopTrustCopy(value) {
  const text = String(value ?? "").toLowerCase();
  return FORBIDDEN_DESKTOP_TRUST_COPY.filter((item) => text.includes(item.toLowerCase()));
}
