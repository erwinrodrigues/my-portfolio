/* Simple client-side admin gate.
   This is not server security. Anyone can still read the site files.
   Only this one account is accepted. */

(function (global) {
  const SESSION_KEY = "portfolioAdminSession";
  const ALLOWED_EMAIL = "rodriguesaerwin@gmail.com";
  /* SHA-256 of the password. The password itself is not stored in this file. */
  const PASSWORD_HASH =
    "8e23f5f04bb1d932f44a674bda7c187ea97cf0d6d37f709980ec423d91aa402f";

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || normalizeEmail(data.email) !== ALLOWED_EMAIL) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!readSession();
  }

  async function login(email, password) {
    const normalized = normalizeEmail(email);
    if (normalized !== ALLOWED_EMAIL) {
      return { ok: false, message: "Access denied for this email." };
    }
    const hash = await sha256Hex(password);
    if (hash !== PASSWORD_HASH) {
      return { ok: false, message: "Incorrect password." };
    }
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email: ALLOWED_EMAIL, at: Date.now() })
    );
    return { ok: true };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function requireLogin(redirectTo) {
    if (isLoggedIn()) return true;
    window.location.replace(redirectTo || "login.html");
    return false;
  }

  function getPublishToken() {
    return isLoggedIn() ? PASSWORD_HASH : "";
  }

  global.portfolioAuth = {
    ALLOWED_EMAIL: ALLOWED_EMAIL,
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    requireLogin: requireLogin,
    readSession: readSession,
    getPublishToken: getPublishToken
  };
})(window);
