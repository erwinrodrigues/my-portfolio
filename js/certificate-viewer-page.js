(function () {
  const params = new URLSearchParams(window.location.search);
  const file = window.portfolioSafe.safeUrl(params.get("file") || "");
  const image = window.portfolioSafe.safeMediaUrl(params.get("image") || "");
  const title = String(params.get("title") || "Certificate").trim() || "Certificate";
  const titleEl = document.getElementById("viewer-title");
  const errorEl = document.getElementById("viewer-error");
  const img = document.getElementById("viewer-image");
  const frame = document.getElementById("viewer-pdf");

  if (titleEl) {
    titleEl.textContent = title;
    document.title = title + " — Certificate";
  }

  const preview =
    image && !/\.pdf($|\?)/i.test(image)
      ? image
      : file && !/\.pdf($|\?)/i.test(file)
        ? file
        : "";

  if (preview && img) {
    img.hidden = false;
    img.src = preview;
    img.alt = title;
  }

  if (file && /\.pdf($|\?)/i.test(file) && frame) {
    frame.hidden = false;
    frame.setAttribute("data", file + "#view=FitH");
    frame.setAttribute("type", "application/pdf");
  }

  if (!preview && !(file && /\.pdf($|\?)/i.test(file))) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = "Certificate preview is unavailable.";
    }
  }
})();
