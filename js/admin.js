(function () {
  if (!window.portfolioAuth || !portfolioAuth.requireLogin("login.html")) return;

  const DRAFT_KEY = "portfolioAdminDraft";
  const pendingFiles = [];

  const form = document.getElementById("admin-form");
  const status = document.getElementById("admin-status");
  const certList = document.getElementById("cert-editor-list");
  const projectList = document.getElementById("project-editor-list");
  const addCertBtn = document.getElementById("add-certificate");
  const addProjectBtn = document.getElementById("add-project");
  const downloadBtn = document.getElementById("download-data");
  const updateBtn = document.getElementById("update-site");
  const logoutBtn = document.getElementById("logout-btn");
  const LIVE_KEY = "portfolioLiveData";
  const LIVE_CHANNEL = "portfolio-live-updates";

  let draft = mergePortfolio(window.portfolioData || emptyData(), loadDraft());

  fillForm(draft);
  renderCertEditors();
  renderProjectEditors();
  updateHeroPreview(getValue("hero-photo"));

  const heroUpload = document.getElementById("hero-photo-upload");
  if (heroUpload) {
    heroUpload.addEventListener("change", function () {
      const file = heroUpload.files && heroUpload.files[0];
      if (!file) return;
      const path = "assets/" + sanitizeName(file.name);
      setInputValue("hero-photo", path);
      queueFile(path, file);
      updateHeroPreview(URL.createObjectURL(file));
      draft = readForm();
      saveDraft(draft);
      setStatus("Personal photo queued. Use Download data.js, then put the image into assets/.");
      heroUpload.value = "";
    });
  }

  if (addCertBtn) {
    addCertBtn.addEventListener("click", function () {
      draft.certificates = draft.certificates || [];
      draft.certificates.push({
        title: "",
        image: "",
        file: "",
        alt: ""
      });
      renderCertEditors();
      setStatus("Certificate row added. Fill it in, then download data.js.");
    });
  }

  if (addProjectBtn) {
    addProjectBtn.addEventListener("click", function () {
      draft.projects = draft.projects || [];
      draft.projects.push({
        name: "",
        description: "",
        image: "",
        alt: "",
        url: ""
      });
      renderProjectEditors();
      setStatus("Project row added. Fill it in, then download data.js.");
    });
  }

  if (form) {
    form.addEventListener("input", function (event) {
      draft = readForm();
      saveDraft(draft);
      if (event.target && event.target.id === "hero-photo") {
        updateHeroPreview(event.target.value);
      }
    });
  }

  if (window.location.hash === "#personal-photo") {
    const photoBlock = document.getElementById("personal-photo");
    if (photoBlock) photoBlock.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (updateBtn) {
    updateBtn.addEventListener("click", async function () {
      draft = readForm();
      saveDraft(draft);
      updateBtn.disabled = true;
      setStatus("Updating site…");
      try {
        const budget = checkUploadBudget(pendingFiles);
        if (!budget.ok) {
          setStatus(budget.message);
          updateBtn.disabled = false;
          return;
        }

        const live = mergePortfolio(
          window.portfolioData || emptyData(),
          await buildLiveData(draft)
        );
        live.certificates = cleanCertificates(live.certificates);
        if (!hasPublishableContent(live)) {
          setStatus("Update blocked: the form looks empty. Reload admin and try again.");
          updateBtn.disabled = false;
          return;
        }

        const liveCheck = assertPublishSize(live);
        if (!liveCheck.ok) {
          setStatus(liveCheck.message);
          updateBtn.disabled = false;
          return;
        }

        localStorage.setItem(LIVE_KEY, JSON.stringify(live));
        try {
          const channel = new BroadcastChannel(LIVE_CHANNEL);
          channel.postMessage({ type: "portfolio-updated" });
          channel.close();
        } catch (err) {
          /* BroadcastChannel may be unavailable */
        }

        const durable = await publishDurable(draft, pendingFiles);
        if (durable.ok) {
          pendingFiles.length = 0;
          setStatus(
            "Site updated on this device and saved to data.js" +
              (durable.files && durable.files.length
                ? " (+" + durable.files.length + " asset file(s))."
                : ".")
          );
        } else {
          setStatus(
            "Live preview updated on this device. Durable save skipped: " +
              (durable.error || "start node tools/serve.js and sign in again.")
          );
        }
      } catch (err) {
        setStatus(
          "Could not update the live site (storage may be full). Try smaller images, or use Download data.js."
        );
      }
      updateBtn.disabled = false;
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      draft = readForm();
      saveDraft(draft);
      downloadTextFile("data.js", buildDataFile(draft));
      pendingFiles.forEach(function (item) {
        downloadBlob(item.filename, item.blob);
      });
      setStatus(
        pendingFiles.length
          ? "Downloaded data.js and " + pendingFiles.length + " asset file(s). Put asset files into the matching folders under assets/."
          : "Downloaded data.js. Replace the project data.js with this file."
      );
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      portfolioAuth.logout();
      window.location.href = "login.html";
    });
  }

  function fillForm(data) {
    const style = (data.about && data.about.style) || {};
    setValue("currently-working-on", data.about && data.about.currentlyWorkingOn);
    setValue("about-paragraphs", ((data.about && data.about.paragraphs) || []).join("\n\n"));
    setSelectValue("about-font-family", style.fontFamily || "Segoe UI");
    setSelectValue("about-font-size", style.fontSize || "1rem");
    setSelectValue("about-font-weight", style.fontWeight || "400");
    setSelectValue("about-line-height", style.lineHeight || "1.7");
    setValue("about-text-color", style.color || "#241F1C");
    setValue("github-username", data.github && data.github.username);
    setValue("hero-photo", data.hero && data.hero.photo);
    updateHeroPreview(data.hero && data.hero.photo);
    setValue("contact-mobile", data.contact && data.contact.mobile);
    setValue("contact-instagram", data.contact && data.contact.instagram);
    setValue("contact-linkedin", data.contact && data.contact.linkedin);
  }

  function readForm() {
    const next = cloneData(draft);
    next.about = next.about || {};
    next.github = next.github || {};
    next.hero = next.hero || {};
    next.contact = next.contact || {};

    next.about.currentlyWorkingOn = getValue("currently-working-on");
    next.about.paragraphs = getValue("about-paragraphs")
      .split(/\n\s*\n/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    next.about.style = {
      fontFamily: getValue("about-font-family") || "Segoe UI",
      fontSize: getValue("about-font-size") || "1rem",
      fontWeight: getValue("about-font-weight") || "400",
      lineHeight: getValue("about-line-height") || "1.7",
      color: getValue("about-text-color") || "#241F1C"
    };
    next.github.username = getValue("github-username");
    next.hero.photo = getValue("hero-photo") || "assets/portrait.svg";
    next.contact.mobile = getValue("contact-mobile");
    next.contact.instagram = getValue("contact-instagram");
    next.contact.linkedin = getValue("contact-linkedin");
    next.certificates = readCertEditors();
    next.projects = readProjectEditors();
    return next;
  }

  function renderCertEditors() {
    if (!certList) return;
    certList.replaceChildren();
    const items = Array.isArray(draft.certificates) ? draft.certificates : [];
    if (!items.length) {
      certList.appendChild(emptyNote("No certificates yet. Use Add certificate."));
      return;
    }
    items.forEach(function (item, index) {
      certList.appendChild(certEditor(item || {}, index));
    });
  }

  function renderProjectEditors() {
    if (!projectList) return;
    projectList.replaceChildren();
    const items = Array.isArray(draft.projects) ? draft.projects : [];
    if (!items.length) {
      projectList.appendChild(emptyNote("No projects yet. Use Add project."));
      return;
    }
    items.forEach(function (item, index) {
      projectList.appendChild(projectEditor(item || {}, index));
    });
  }

  function certEditor(item, index) {
    const wrap = document.createElement("div");
    wrap.className = "space-y-3 border border-[#D9CBBA] bg-[#F7F2EB] p-4";
    wrap.dataset.index = String(index);

    wrap.appendChild(fieldLabel("Title"));
    wrap.appendChild(textInput("cert-title-" + index, item.title || "", "Certificate title"));

    wrap.appendChild(fieldLabel("Display image path"));
    wrap.appendChild(textInput("cert-image-" + index, item.image || "", "assets/certificates/example.jpg"));

    wrap.appendChild(fieldLabel("Upload display image"));
    wrap.appendChild(fileInput(function (file) {
      const path = "assets/certificates/" + sanitizeName(file.name);
      setInputValue("cert-image-" + index, path);
      queueFile(path, file);
      if (!getInputValue("cert-file-" + index)) setInputValue("cert-file-" + index, path);
      draft = readForm();
      saveDraft(draft);
      setStatus("Queued " + file.name + " for download with data.js.");
    }, "image/*"));

    wrap.appendChild(fieldLabel("Open-on-click file path (image or PDF)"));
    wrap.appendChild(textInput("cert-file-" + index, item.file || "", "assets/certificates/example.pdf"));

    wrap.appendChild(fieldLabel("Upload open-on-click file"));
    wrap.appendChild(fileInput(function (file) {
      const path = "assets/certificates/" + sanitizeName(file.name);
      setInputValue("cert-file-" + index, path);
      queueFile(path, file);
      draft = readForm();
      saveDraft(draft);
      setStatus("Queued " + file.name + " for download with data.js.");
    }, "image/*,application/pdf"));

    wrap.appendChild(fieldLabel("Alt text"));
    wrap.appendChild(textInput("cert-alt-" + index, item.alt || "", "What the certificate shows"));

    wrap.appendChild(rowActions(index, "certificate"));
    return wrap;
  }

  function projectEditor(item, index) {
    const wrap = document.createElement("div");
    wrap.className = "space-y-3 border border-[#D9CBBA] bg-[#F7F2EB] p-4";
    wrap.dataset.index = String(index);

    wrap.appendChild(fieldLabel("Name"));
    wrap.appendChild(textInput("project-name-" + index, item.name || "", "Project name"));

    wrap.appendChild(fieldLabel("Description"));
    const desc = document.createElement("textarea");
    desc.id = "project-description-" + index;
    desc.rows = 3;
    desc.className = inputClass();
    desc.value = item.description || "";
    wrap.appendChild(desc);

    wrap.appendChild(fieldLabel("Landing image path"));
    wrap.appendChild(textInput("project-image-" + index, item.image || "", "assets/projects/landing.jpg"));

    wrap.appendChild(fieldLabel("Upload landing image"));
    wrap.appendChild(fileInput(function (file) {
      const path = "assets/projects/" + sanitizeName(file.name);
      setInputValue("project-image-" + index, path);
      queueFile(path, file);
      draft = readForm();
      saveDraft(draft);
      setStatus("Queued " + file.name + " for download with data.js.");
    }, "image/*"));

    wrap.appendChild(fieldLabel("Alt text"));
    wrap.appendChild(textInput("project-alt-" + index, item.alt || "", "Landing page of the project"));

    wrap.appendChild(fieldLabel("Project URL (optional)"));
    wrap.appendChild(textInput("project-url-" + index, item.url || "", "https://"));

    wrap.appendChild(rowActions(index, "project"));
    return wrap;
  }

  function rowActions(index, kind) {
    const row = document.createElement("div");
    row.className = "flex flex-wrap gap-2 pt-2";

    const up = button("Move up", function () {
      moveItem(kind, index, -1);
    });
    const down = button("Move down", function () {
      moveItem(kind, index, 1);
    });
    const remove = button("Remove", function () {
      removeItem(kind, index);
    });
    row.append(up, down, remove);
    return row;
  }

  function moveItem(kind, index, delta) {
    draft = readForm();
    const key = kind === "certificate" ? "certificates" : "projects";
    const list = draft[key] || [];
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const temp = list[index];
    list[index] = list[next];
    list[next] = temp;
    draft[key] = list;
    saveDraft(draft);
    if (kind === "certificate") renderCertEditors();
    else renderProjectEditors();
  }

  function removeItem(kind, index) {
    draft = readForm();
    const key = kind === "certificate" ? "certificates" : "projects";
    draft[key] = (draft[key] || []).filter(function (_item, i) {
      return i !== index;
    });
    saveDraft(draft);
    if (kind === "certificate") renderCertEditors();
    else renderProjectEditors();
  }

  function readCertEditors() {
    const items = Array.isArray(draft.certificates) ? draft.certificates : [];
    return items.map(function (_item, index) {
      return {
        title: getInputValue("cert-title-" + index),
        image: getInputValue("cert-image-" + index),
        file: getInputValue("cert-file-" + index),
        alt: getInputValue("cert-alt-" + index)
      };
    });
  }

  function readProjectEditors() {
    const items = Array.isArray(draft.projects) ? draft.projects : [];
    return items.map(function (_item, index) {
      return {
        name: getInputValue("project-name-" + index),
        description: getInputValue("project-description-" + index),
        image: getInputValue("project-image-" + index),
        alt: getInputValue("project-alt-" + index),
        url: getInputValue("project-url-" + index)
      };
    });
  }

  function queueFile(path, file) {
    const filename = path.split("/").pop();
    const existing = pendingFiles.findIndex(function (item) {
      return item.filename === filename;
    });
    const entry = { filename: filename, blob: file, path: path };
    if (existing >= 0) pendingFiles[existing] = entry;
    else pendingFiles.push(entry);
  }

  async function buildLiveData(data) {
    const live = cloneData(data);
    const pathMap = {};
    for (let i = 0; i < pendingFiles.length; i += 1) {
      const item = pendingFiles[i];
      pathMap[item.path] = await fileToDataUrl(item.blob);
    }
    return replacePaths(live, pathMap);
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Could not read file"));
      };
      reader.readAsDataURL(file);
    });
  }

  function replacePaths(value, pathMap) {
    if (typeof value === "string") {
      return Object.prototype.hasOwnProperty.call(pathMap, value) ? pathMap[value] : value;
    }
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return replacePaths(item, pathMap);
      });
    }
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = replacePaths(value[key], pathMap);
      });
      return out;
    }
    return value;
  }

  function cleanCertificates(list) {
    const seen = Object.create(null);
    return (Array.isArray(list) ? list : []).filter(function (item) {
      const title = String((item && item.title) || "").trim();
      const image = String((item && item.image) || "").trim();
      const file = String((item && item.file) || "").trim();
      if (!title && !image && !file) return false;
      const key = title
        ? title.toLowerCase()
        : "media:" + image.toLowerCase() + "|" + file.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function buildDataFile(data) {
    const payload = {
      birthDate: data.birthDate || "2008-12-21",
      hero: {
        greeting: (data.hero && data.hero.greeting) || "Hi, I'm Erwin Anthony Rodrigues",
        line: (data.hero && data.hero.line) || "I have a desire to learn and I am always open to new things.",
        motto: (data.hero && data.hero.motto) || "Master the craft. Earn the Trust. Outwork the Rest.",
        photo: (data.hero && data.hero.photo) || "assets/portrait.svg",
        photoAlt: (data.hero && data.hero.photoAlt) || "Portrait of Erwin Anthony Rodrigues"
      },
      about: {
        paragraphs: (data.about && data.about.paragraphs) || [],
        currentlyWorkingOn: (data.about && data.about.currentlyWorkingOn) || "",
        style: (data.about && data.about.style) || {
          fontFamily: "Segoe UI",
          fontSize: "1rem",
          fontWeight: "400",
          lineHeight: "1.7",
          color: "#241F1C"
        }
      },
      certificates: cleanCertificates(data.certificates),
      github: {
        username: (data.github && data.github.username) || ""
      },
      projects: Array.isArray(data.projects) ? data.projects : [],
      contact: {
        mobile: (data.contact && data.contact.mobile) || "",
        instagram: (data.contact && data.contact.instagram) || "",
        linkedin: (data.contact && data.contact.linkedin) || ""
      }
    };

    return [
      "/* Editable portfolio content.",
      "   Change values in this file only.",
      "   Each list stands alone: adding, removing, or reordering items",
      "   in one list leaves every other section as it is.",
      "   birthDate is stored here so the page can calculate age.",
      "   The date itself is never shown. */",
      "",
      "window.portfolioData = " + JSON.stringify(payload, null, 2) + ";",
      ""
    ].join("\n");
  }

  function downloadTextFile(filename, text) {
    downloadBlob(filename, new Blob([text], { type: "text/javascript;charset=utf-8" }));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveDraft(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore quota errors */
    }
  }

  function emptyData() {
    return {
      birthDate: "2008-12-21",
      hero: {},
      about: { paragraphs: [], currentlyWorkingOn: "" },
      certificates: [],
      github: { username: "" },
      projects: [],
      contact: { mobile: "", instagram: "", linkedin: "" }
    };
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data || emptyData()));
  }

  function mergePortfolio(base, overlay) {
    const out = cloneData(base || emptyData());
    if (!overlay || typeof overlay !== "object") return out;

    if (overlay.birthDate) out.birthDate = overlay.birthDate;

    out.hero = Object.assign({}, out.hero || {}, overlay.hero || {});
    keepIfEmpty(out.hero, base && base.hero, ["greeting", "line", "motto", "photo", "photoAlt"]);

    out.about = Object.assign({}, out.about || {}, overlay.about || {});
    if (overlay.about && Array.isArray(overlay.about.paragraphs)) {
      out.about.paragraphs = overlay.about.paragraphs;
    } else if (base && base.about && Array.isArray(base.about.paragraphs)) {
      out.about.paragraphs = base.about.paragraphs.slice();
    }
    if (overlay.about && overlay.about.style) {
      out.about.style = Object.assign({}, (base && base.about && base.about.style) || {}, overlay.about.style);
    }
    if (!String(out.about.currentlyWorkingOn || "").trim() && base && base.about) {
      out.about.currentlyWorkingOn = base.about.currentlyWorkingOn || "";
    }

    if (Array.isArray(overlay.certificates)) out.certificates = overlay.certificates;
    if (Array.isArray(overlay.projects)) out.projects = overlay.projects;

    out.github = Object.assign({}, out.github || {}, overlay.github || {});
    keepIfEmpty(out.github, base && base.github, ["username"]);

    out.contact = Object.assign({}, out.contact || {}, overlay.contact || {});
    return out;
  }

  function keepIfEmpty(target, source, keys) {
    if (!target || !source) return;
    keys.forEach(function (key) {
      if (!String(target[key] || "").trim() && source[key]) target[key] = source[key];
    });
  }

  function hasPublishableContent(data) {
    if (!data || typeof data !== "object") return false;
    if (data.hero && String(data.hero.greeting || "").trim()) return true;
    const paragraphs = data.about && Array.isArray(data.about.paragraphs) ? data.about.paragraphs : [];
    if (paragraphs.some(function (p) { return String(p || "").trim(); })) return true;
    if (data.certificates && data.certificates.length) return true;
    if (data.projects && data.projects.length) return true;
    return false;
  }

  const MAX_LIVE_JSON_CHARS = 1500 * 1024;
  const MAX_DATA_URL_CHARS = 700 * 1024;
  const MAX_UPLOAD_BYTES = 1500 * 1024;

  function checkUploadBudget(files) {
    for (let i = 0; i < files.length; i += 1) {
      const blob = files[i] && files[i].blob;
      if (blob && blob.size > MAX_UPLOAD_BYTES) {
        return {
          ok: false,
          message:
            "Upload too large: " +
            files[i].path +
            " (" +
            Math.round(blob.size / 1024) +
            " KB). Keep each file under " +
            Math.round(MAX_UPLOAD_BYTES / 1024) +
            " KB."
        };
      }
    }
    return { ok: true };
  }

  function assertPublishSize(live) {
    let packed = "";
    try {
      packed = JSON.stringify(live);
    } catch (err) {
      return { ok: false, message: "Could not serialize portfolio data." };
    }
    if (packed.length > MAX_LIVE_JSON_CHARS) {
      return {
        ok: false,
        message:
          "Update blocked: live data is too large (" +
          Math.round(packed.length / 1024) +
          " KB). Use smaller images."
      };
    }
    if (/data:[^;]+;base64,[A-Za-z0-9+/=]{200,}/.test(packed)) {
      const match = packed.match(/data:[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (match && match[0].length > MAX_DATA_URL_CHARS) {
        return {
          ok: false,
          message:
            "Update blocked: an embedded image exceeds " +
            Math.round(MAX_DATA_URL_CHARS / 1024) +
            " KB. Compress it or use Download data.js + assets folder."
        };
      }
    }
    return { ok: true };
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Could not read file"));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function publishDurable(data, files) {
    const body = {
      portfolio: {
        birthDate: data.birthDate || "2008-12-21",
        hero: data.hero || {},
        about: data.about || {},
        certificates: cleanCertificates(data.certificates),
        github: data.github || {},
        projects: Array.isArray(data.projects) ? data.projects : [],
        contact: data.contact || {}
      },
      files: []
    };

    for (let i = 0; i < files.length; i += 1) {
      const item = files[i];
      body.files.push({
        path: item.path,
        contentBase64: await blobToBase64(item.blob)
      });
    }

    try {
      const token =
        (portfolioAuth.getPublishToken && portfolioAuth.getPublishToken()) || "";
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(function () {
        return null;
      });
      if (!res.ok || !json || !json.ok) {
        return {
          ok: false,
          error: (json && json.error) || "HTTP " + res.status
        };
      }
      return { ok: true, files: json.files || [] };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }

  function setStatus(message) {
    if (!status) return;
    status.textContent = message;
  }

  function emptyNote(text) {
    const p = document.createElement("p");
    p.className = "text-sm text-[#5C5148]";
    p.textContent = text;
    return p;
  }

  function fieldLabel(text) {
    const label = document.createElement("label");
    label.className = "block text-sm font-medium";
    label.textContent = text;
    return label;
  }

  function textInput(id, value, placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.value = value;
    input.placeholder = placeholder || "";
    input.className = inputClass();
    return input;
  }

  function fileInput(onFile, accept) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept || "";
    input.className = "block w-full text-sm";
    input.addEventListener("change", function () {
      const file = input.files && input.files[0];
      if (file) onFile(file);
      input.value = "";
    });
    return input;
  }

  function button(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className =
      "inline-flex min-h-11 items-center border border-[#D9CBBA] bg-[#EFE4D6] px-3 text-sm hover:bg-[#E4D5C4]";
    btn.addEventListener("click", onClick);
    return btn;
  }

  function inputClass() {
    return "mt-1 w-full min-h-11 border border-[#D9CBBA] bg-white px-3 text-base text-[#241F1C]";
  }

  function sanitizeName(name) {
    return String(name || "file")
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-");
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
  }

  function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = value == null ? "" : String(value);
    el.value = next;
    if (el.value !== next) {
      const option = document.createElement("option");
      option.value = next;
      option.textContent = next;
      el.appendChild(option);
      el.value = next;
    }
  }

  function updateHeroPreview(src) {
    const preview = document.getElementById("hero-photo-preview");
    if (!preview) return;
    const value = String(src || "").trim();
    if (!value || /\.svg($|\?)/i.test(value) && /portrait\.svg/i.test(value)) {
      preview.hidden = true;
      preview.classList.add("hidden");
      preview.removeAttribute("src");
      return;
    }
    preview.src = value;
    preview.hidden = false;
    preview.classList.remove("hidden");
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }
})();
