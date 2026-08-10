/* ===== BhaktiSangeet - escapeHtml helper ===== */
/* Used by app.js - kept separate so editors don't mangle entities. */
window.BS_escapeHtml = function (str) {
  return String(str || "").replace(/[&<>"']/g, function (c) {
    return {
      "&": "&",
      "<": "<",
      ">": ">",
      '"': """,
      "'": "&#39;"
    }[c];
  });
};
