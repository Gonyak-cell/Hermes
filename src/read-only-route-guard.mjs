export const READ_ONLY_ROUTE_METHODS = ["GET", "HEAD"];

export function isReadOnlyRouteMethod(method = "GET") {
  return READ_ONLY_ROUTE_METHODS.includes(String(method).toUpperCase());
}

export function buildReadOnlyMethodNotAllowed(method = "GET") {
  return {
    schema_version: "read-only-route-error.v1",
    error: "method_not_allowed",
    method: String(method).toUpperCase(),
    allowed_methods: READ_ONLY_ROUTE_METHODS,
    message: "Route is read-only. Only GET and HEAD are allowed.",
  };
}
