(function () {
  if (window.portfolioAuth && portfolioAuth.isLoggedIn()) {
    window.location.replace("admin.html");
    return;
  }

  const form = document.getElementById("login-form");
  const error = document.getElementById("login-error");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    error.hidden = true;
    error.textContent = "";

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const result = await portfolioAuth.login(email, password);

    if (!result.ok) {
      error.textContent = result.message || "Login failed.";
      error.hidden = false;
      return;
    }

    window.location.href = "admin.html";
  });
})();
