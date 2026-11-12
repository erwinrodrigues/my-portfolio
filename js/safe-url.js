(function (global) {
  function hasTraversal(url) {
    return url.includes("\\") || url.includes("..");
  }

  function hasDangerousScheme(url) {
    return /^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(https?|data|blob):/i.test(url);
  }

  function isLocalAssetPath(url) {
    return (
      url.startsWith("assets/") ||
      url.startsWith("./assets/") ||
      url.startsWith("/assets/")
    );
  }

  /* Links: local assets, https?, allowlisted data/blob. */
  function safeUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (hasDangerousScheme(url) || hasTraversal(url)) return "";
    if (isLocalAssetPath(url)) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:(image\/[a-z0-9.+-]+|application\/pdf)(;|,)/i.test(url)) return url;
    /* blob: omitted for navigable hrefs — too easy to point at unexpected content */
    return "";
  }

  /* Images / media: local or data/blob only. No arbitrary external https. */
  function safeMediaUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (hasDangerousScheme(url) || hasTraversal(url)) return "";
    if (isLocalAssetPath(url)) return url;
    if (/^data:image\/[a-z0-9.+-]+(;|,)/i.test(url)) return url;
    if (/^blob:/i.test(url)) return url;
    return "";
  }

  function ageFromBirthDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const today = new Date();
    let age = today.getFullYear() - year;
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
    return age;
  }

  function visibleSlice(items, limit, expanded) {
    const list = Array.isArray(items) ? items : [];
    const cap = Number(limit) || 0;
    if (expanded || list.length <= cap) return list.slice();
    return list.slice(0, cap);
  }

  global.portfolioSafe = {
    safeUrl: safeUrl,
    safeMediaUrl: safeMediaUrl,
    ageFromBirthDate: ageFromBirthDate,
    visibleSlice: visibleSlice
  };
})(window);
