(function () {
  let data = window.portfolioData || null;
  if (!data) return;

  const CERTIFICATE_LIMIT = 6;
  const PROJECT_LIMIT = 4;
  let certificatesExpanded = false;
  let projectsExpanded = false;
  let certificateRenderToken = 0;

  const certificatesMore = document.getElementById("certificates-more");
  const projectsMore = document.getElementById("projects-more");

  if (certificatesMore) {
    certificatesMore.addEventListener("click", function () {
      certificatesExpanded = true;
      renderCertificates();
    });
  }

  if (projectsMore) {
    projectsMore.addEventListener("click", function () {
      projectsExpanded = true;
      renderProjects();
    });
  }

  refreshAll();

  function refreshAll() {
    if (!data) return;
    renderHero();
    renderAbout();
    renderCertificates();
    renderGithub();
    renderProjects();
    renderContact();
  }

  function renderHero() {
    const hero = data.hero || {};
    setText("hero-greeting", hero.greeting || "");
    setText("hero-line", hero.line || "");
    setText("hero-motto", hero.motto || "");

    const photo = document.getElementById("hero-photo");
    const photoWrap = document.getElementById("hero-photo-wrap");
    const heroGrid = document.getElementById("hero-grid");
    if (!photo) return;
    const src = safeMediaUrl(hero.photo) || "assets/portrait.svg";
    photo.hidden = false;
    if (photoWrap) {
      photoWrap.hidden = false;
      photoWrap.setAttribute("aria-hidden", "false");
    }
    if (heroGrid) heroGrid.classList.add("lg:grid-cols-2");
    photo.src = src;
    photo.alt = hero.photoAlt || "Portrait of Erwin Anthony Rodrigues";
  }

  function renderAbout() {
    const about = data.about || {};
    const style = about.style || {};
    const copy = document.getElementById("about-copy");
    const working = document.getElementById("currently-working-on");

    applyAboutTextStyle(copy, style);
    applyAboutTextStyle(working, style);

    if (copy) {
      copy.replaceChildren();
      const age = ageFromBirthDate(data.birthDate);
      const ageLine = document.createElement("p");
      ageLine.textContent = age === null ? "[Age unavailable]" : "I am " + age + " years old.";
      copy.appendChild(ageLine);

      const paragraphs = Array.isArray(about.paragraphs) ? about.paragraphs : [];
      paragraphs.forEach(function (paragraph) {
        const text = String(paragraph || "").trim();
        if (!text) return;
        const p = document.createElement("p");
        p.textContent = text;
        copy.appendChild(p);
      });
    }

    const workingWrap = document.getElementById("currently-working-wrap");
    if (!working) return;
    const current = String(about.currentlyWorkingOn || "").trim();
    if (workingWrap) workingWrap.hidden = false;
    working.textContent = current || "[Currently working on to be provided]";
  }

  function applyAboutTextStyle(el, style) {
    if (!el || !style) return;
    if (style.fontFamily) el.style.fontFamily = style.fontFamily;
    if (style.fontSize) el.style.fontSize = style.fontSize;
    if (style.fontWeight) el.style.fontWeight = style.fontWeight;
    if (style.lineHeight) el.style.lineHeight = style.lineHeight;
    if (style.color) el.style.color = style.color;
  }

  function renderCertificates() {
    const items = dedupeByTitle(
      repairCertificatePaths(Array.isArray(data.certificates) ? data.certificates : [])
    );
    data.certificates = items;
    const list = document.getElementById("certificate-list");
    const empty = document.getElementById("certificates-empty");
    if (!list || !empty) return;

    const renderToken = ++certificateRenderToken;
    const visible = window.portfolioSafe
      ? window.portfolioSafe.visibleSlice(items, CERTIFICATE_LIMIT, certificatesExpanded)
      : certificatesExpanded
        ? items
        : items.slice(0, CERTIFICATE_LIMIT);
    list.replaceChildren();

    const certSection = document.getElementById("certificates");
    const hasItems = items.length > 0;
    list.hidden = !hasItems;
    empty.hidden = hasItems;
    empty.textContent = hasItems ? "" : "[Certificates to be provided]";
    if (certSection) {
      certSection.hidden = false;
      certSection.setAttribute("aria-hidden", "false");
    }

    if (certificatesMore) {
      const hasMore = items.length > CERTIFICATE_LIMIT && !certificatesExpanded;
      certificatesMore.hidden = !hasMore;
      certificatesMore.setAttribute("aria-expanded", certificatesExpanded ? "true" : "false");
    }

    if (renderToken !== certificateRenderToken) return;
    visible.forEach(function (item) {
      list.appendChild(certificateCard(item || {}));
    });
  }

  function dedupeByTitle(items) {
    const seen = Object.create(null);
    return items.filter(function (item) {
      const title = String((item && item.title) || "").trim();
      const image = String((item && item.image) || "").trim();
      const file = String((item && item.file) || "").trim();
      /* Drop empty spam rows (no title and no media). */
      if (!title && !image && !file) return false;
      const key = title
        ? title.toLowerCase()
        : "media:" + image.toLowerCase() + "|" + file.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function repairCertificatePaths(items) {
    return items.map(function (item) {
      const next = Object.assign({}, item || {});
      const image = String(next.image || "");
      const file = String(next.file || "");
      if (/IBKxt7L_page-0001\.jpg/i.test(image) || /certificate-ai-bootcamp.*\.jpg/i.test(image)) {
        next.image = "assets/certificates/young-ai-explorer.jpg";
      }
      if (/IBKxt7L\.pdf/i.test(file) || /certificate-ai-bootcamp.*\.pdf/i.test(file)) {
        next.file = "assets/certificates/young-ai-explorer.pdf";
      }
      return next;
    });
  }

  function certificateCard(item) {
    const file = safeUrl(item.file);
    const image = safeMediaUrl(item.image);
    const thumb = image && !isPdf(image) ? image : "";
    const title = String(item.title || "").trim() || "Certificate";
    const alt = String(item.alt || "").trim() || title;
    const openUrl = certificateOpenUrl(file, image, title);

    const card = document.createElement(openUrl ? "a" : "div");
    card.className = "certificate-card group block w-[16.5rem] max-w-full shrink-0 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E4630]";
    if (openUrl) {
      card.href = openUrl;
      if (openUrl.indexOf("certificate-viewer.html") === 0) {
        card.target = "_self";
      } else {
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }
    }

    if (thumb) {
      const img = document.createElement("img");
      img.src = encodeURI(thumb);
      img.alt = alt;
      img.width = 640;
      img.height = 480;
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "mx-auto h-auto max-h-56 w-auto max-w-full bg-[#F7F2EB] object-contain";
      img.addEventListener("error", function () {
        img.replaceWith(missingMediaNote("[Certificate image unavailable]"));
      });
      card.appendChild(img);
    } else {
      card.appendChild(missingMediaNote("[Certificate image to be added]"));
    }

    const caption = document.createElement("p");
    caption.className = "mt-3 break-words text-base font-medium leading-snug text-[#241F1C]";
    caption.textContent = title;
    card.appendChild(caption);
    return card;
  }

  function missingMediaNote(text) {
    const holder = document.createElement("div");
    holder.className = "flex h-40 w-full items-center justify-center bg-[#F7F2EB] px-4 text-sm text-[#5C5148]";
    holder.textContent = text;
    return holder;
  }

  function renderGithub() {
    const slot = document.getElementById("github-slot");
    if (!slot) return;
    slot.replaceChildren();

    const username = String((data.github && data.github.username) || "").trim();
    if (!username || /to be provided/i.test(username)) {
      const note = document.createElement("p");
      note.className = "text-[#5C5148]";
      note.textContent = "[GitHub username to be provided]";
      slot.appendChild(note);
      return;
    }

    const profile = "https://github.com/" + encodeURIComponent(username);
    const link = document.createElement("a");
    link.href = profile;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E4630]";
    link.setAttribute("aria-label", "GitHub profile for " + username);

    const graph = document.createElement("img");
    graph.src = "https://ghchart.rshah.org/6E4630/" + encodeURIComponent(username);
    graph.alt = "GitHub contribution graph for " + username;
    graph.width = 830;
    graph.height = 128;
    graph.loading = "lazy";
    graph.decoding = "async";
    graph.className = "mx-auto h-auto w-full max-w-3xl";
    graph.addEventListener("error", function () {
      graph.remove();
    });
    link.appendChild(graph);
    slot.appendChild(link);

    const profileLink = document.createElement("a");
    profileLink.href = profile;
    profileLink.target = "_blank";
    profileLink.rel = "noopener noreferrer";
    profileLink.className = "mt-4 inline-flex min-h-11 items-center text-[#6E4630] underline decoration-1 underline-offset-4 hover:text-[#241F1C]";
    profileLink.textContent = "github.com/" + username;
    slot.appendChild(profileLink);
  }

  function renderProjects() {
    const items = Array.isArray(data.projects) ? data.projects : [];
    const list = document.getElementById("project-list");
    const empty = document.getElementById("projects-empty");
    if (!list || !empty) return;

    const visible = window.portfolioSafe
      ? window.portfolioSafe.visibleSlice(items, PROJECT_LIMIT, projectsExpanded)
      : projectsExpanded
        ? items
        : items.slice(0, PROJECT_LIMIT);
    list.replaceChildren();
    visible.forEach(function (item) {
      list.appendChild(projectCard(item || {}));
    });

    const projectsSection = document.getElementById("projects");
    const hasItems = items.length > 0;
    list.hidden = !hasItems;
    empty.hidden = hasItems;
    empty.textContent = hasItems ? "" : "[Projects to be provided]";
    if (projectsSection) {
      projectsSection.hidden = false;
      projectsSection.setAttribute("aria-hidden", "false");
    }

    if (!projectsMore) return;
    const hasMore = items.length > PROJECT_LIMIT && !projectsExpanded;
    projectsMore.hidden = !hasMore;
    projectsMore.setAttribute("aria-expanded", projectsExpanded ? "true" : "false");
  }

  function projectCard(item) {
    const name = String(item.name || "").trim() || "Project";
    const description = String(item.description || "").trim();
    const image = safeMediaUrl(item.image);
    const url = safeUrl(item.url);
    const alt = String(item.alt || "").trim() || "Landing page of " + name;

    const article = document.createElement("article");
    article.className = "flex w-full max-w-3xl flex-col gap-4 min-[420px]:flex-row min-[420px]:items-start min-[900px]:w-[calc(50%-0.75rem)] min-[900px]:max-w-none";

    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = alt;
      img.width = 640;
      img.height = 360;
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "aspect-video w-full bg-[#F7F2EB] object-cover min-[420px]:aspect-[4/3] min-[420px]:w-36 min-[420px]:shrink-0 lg:w-44";
      img.addEventListener("error", function () {
        img.remove();
      });
      article.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "min-w-0";

    const heading = document.createElement("h3");
    heading.className = "break-words text-[clamp(1.25rem,2vw,1.6rem)] font-bold leading-tight text-[#241F1C]";
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "underline decoration-1 underline-offset-4 hover:text-[#6E4630]";
      link.textContent = name;
      heading.appendChild(link);
    } else {
      heading.textContent = name;
    }
    body.appendChild(heading);

    if (description) {
      const summary = document.createElement("p");
      summary.className = "mt-2 break-words whitespace-pre-line text-sm leading-relaxed text-[#5C5148]";
      summary.textContent = description;
      body.appendChild(summary);
    }

    article.appendChild(body);
    return article;
  }

  function renderContact() {
    const contact = data.contact || {};
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.hidden = false;
      contactSection.setAttribute("aria-hidden", "false");
    }

    const mobile = String(contact.mobile || "").trim();
    const mobileRow = document.getElementById("contact-mobile-row");
    const mobileValue = document.getElementById("contact-mobile");
    if (mobileRow && mobileValue) {
      mobileRow.hidden = false;
      mobileValue.textContent = mobile || "[Mobile number to be provided]";
    }

    const ig = String(contact.instagram || "").trim();
    const igRow = document.getElementById("contact-instagram-row");
    fillSocial(
      "contact-instagram",
      ig || "[Instagram to be provided]",
      ig ? instagramHref(contact.instagram) : ""
    );
    if (igRow) igRow.hidden = false;

    const li = String(contact.linkedin || "").trim();
    const liRow = document.getElementById("contact-linkedin-row");
    fillSocial(
      "contact-linkedin",
      li || "[LinkedIn to be provided]",
      li ? safeUrl(contact.linkedin) : ""
    );
    if (liRow) liRow.hidden = false;

    const messageLabel = document.getElementById("contact-message-label");
    if (messageLabel) messageLabel.hidden = false;
  }

  function fillSocial(id, value, href) {
    const el = document.getElementById(id);
    if (!el) return;
    el.replaceChildren();
    const text = String(value || "").trim();
    if (!text) return;
    if (!href) {
      el.textContent = text;
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "underline decoration-1 underline-offset-4 hover:text-[#6E4630] break-all";
    link.textContent = text;
    el.appendChild(link);
  }

  function instagramHref(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    const handle = text.replace(/^@/, "");
    if (/^[A-Za-z0-9._]+$/.test(handle)) return "https://instagram.com/" + handle;
    return "";
  }

  function ageFromBirthDate(isoDate) {
    return window.portfolioSafe
      ? window.portfolioSafe.ageFromBirthDate(isoDate)
      : null;
  }

  function safeUrl(value) {
    return window.portfolioSafe ? window.portfolioSafe.safeUrl(value) : "";
  }

  function safeMediaUrl(value) {
    return window.portfolioSafe && window.portfolioSafe.safeMediaUrl
      ? window.portfolioSafe.safeMediaUrl(value)
      : "";
  }

  function isPdf(url) {
    const value = String(url || "");
    return /\.pdf($|\?)/i.test(value) || /^data:application\/pdf/i.test(value);
  }

  function certificateOpenUrl(file, image, title) {
    const preview = image && !isPdf(image) ? image : file && !isPdf(file) ? file : "";
    if (preview || (file && isPdf(file))) {
      const params = new URLSearchParams();
      if (preview) params.set("image", preview);
      if (file && isPdf(file)) params.set("file", file);
      if (title) params.set("title", title);
      return "certificate-viewer.html?" + params.toString();
    }
    if (file) return encodeURI(file);
    return "";
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
})();
