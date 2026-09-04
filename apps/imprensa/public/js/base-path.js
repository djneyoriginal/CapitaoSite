(function () {
  const path = window.location.pathname;
  const knownPages = ["/admin.html", "/index.html", "/TV.html", "/tv.html", "/admin"];
  let basePath = path;

  for (const page of knownPages) {
    if (path.endsWith(page)) {
      basePath = path.slice(0, -page.length);
      break;
    }
  }

  basePath = basePath.replace(/\/$/, "");
  if (basePath === "/") basePath = "";

  window.APP_BASE_PATH = basePath;
  window.appUrl = function appUrl(routePath) {
    const normalizedPath = String(routePath || "").startsWith("/")
      ? String(routePath || "")
      : `/${routePath || ""}`;
    return `${basePath}${normalizedPath}`;
  };
})();
