/* Local portfolio server.
   - Public static files for the portfolio
   - Durable publish: POST /api/publish  Authorization: Bearer <sha256-password-hash>
   - Login is client-side (js/auth.js); this file does not gate admin pages
   Usage: node serve.js
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = 8765;
const PASSWORD_HASH =
  "8e23f5f04bb1d932f44a674bda7c187ea97cf0d6d37f709980ec423d91aa402f";
const MAX_JSON_BYTES = 1.5 * 1024 * 1024;
const MAX_ASSET_BYTES = 1.5 * 1024 * 1024;
const MAX_FILES = 20;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".json": "application/json"
};

const ALLOWED_ASSET_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);
const DENY_WRITE_NAMES = new Set([
  "portfolio.css",
  "site.css",
  "tailwind-src.css",
  "instagram.svg",
  "linkedin.svg"
]);

function isBearerAuthorized(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  return token === PASSWORD_HASH;
}

function isLocalOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    const referer = req.headers.referer || "";
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(referer);
  }
  return origin === "http://127.0.0.1:" + PORT || origin === "http://localhost:" + PORT;
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function isDeniedStaticPath(normalized) {
  const lower = normalized.toLowerCase();
  if (lower === "/serve.js") return true;
  if (lower === "/.portfolio-auth.json") return true;
  if (lower.startsWith("/reports/")) return true;
  if (lower.endsWith(".mjs")) return true;
  if (lower.endsWith(".map")) return true;
  if (lower.includes("/.") && !lower.startsWith("/assets/")) return true;
  if (lower === "/package.json" || lower === "/package-lock.json") return true;
  if (lower === "/tailwind.config.js") return true;
  return false;
}

function safeAssetPath(relPath) {
  const raw = String(relPath || "").replace(/\\/g, "/").trim();
  if (!raw.startsWith("assets/")) return null;
  if (raw.includes("..") || raw.includes("\\") || raw.includes("\0")) return null;
  const ext = path.extname(raw).toLowerCase();
  if (!ALLOWED_ASSET_EXT.has(ext)) return null;
  const base = path.basename(raw).toLowerCase();
  if (DENY_WRITE_NAMES.has(base)) return null;
  const resolved = path.resolve(ROOT, raw);
  const assetsRoot = path.join(ROOT, "assets") + path.sep;
  if (!resolved.startsWith(assetsRoot)) return null;
  return resolved;
}

function looksLikeAllowedFile(ext, buf) {
  if (!buf || buf.length < 4) return false;
  if (ext === ".jpg" || ext === ".jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === ".png") return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (ext === ".gif") return buf.slice(0, 3).toString("ascii") === "GIF";
  if (ext === ".webp") {
    return (
      buf.slice(0, 4).toString("ascii") === "RIFF" &&
      buf.slice(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (ext === ".pdf") return buf.slice(0, 5).toString("ascii") === "%PDF-";
  return false;
}

function asString(value, max) {
  const text = String(value == null ? "" : value);
  if (text.length > max) return text.slice(0, max);
  return text;
}

function sanitizePortfolio(input) {
  const src = input && typeof input === "object" ? input : {};
  const heroIn = src.hero && typeof src.hero === "object" ? src.hero : {};
  const aboutIn = src.about && typeof src.about === "object" ? src.about : {};
  const styleIn = aboutIn.style && typeof aboutIn.style === "object" ? aboutIn.style : {};
  const githubIn = src.github && typeof src.github === "object" ? src.github : {};
  const contactIn = src.contact && typeof src.contact === "object" ? src.contact : {};

  const paragraphs = Array.isArray(aboutIn.paragraphs)
    ? aboutIn.paragraphs
        .map(function (p) {
          return asString(p, 2000);
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const certificates = Array.isArray(src.certificates)
    ? src.certificates
        .slice(0, 100)
        .map(function (item) {
          const row = item && typeof item === "object" ? item : {};
          return {
            title: asString(row.title, 200),
            image: asString(row.image, 300),
            file: asString(row.file, 300),
            alt: asString(row.alt, 300)
          };
        })
        .filter(function (row) {
          return row.title || row.image || row.file;
        })
    : [];

  const projects = Array.isArray(src.projects)
    ? src.projects.slice(0, 100).map(function (item) {
        const row = item && typeof item === "object" ? item : {};
        return {
          name: asString(row.name, 200),
          description: asString(row.description, 4000),
          image: asString(row.image, 300),
          alt: asString(row.alt, 300),
          url: asString(row.url, 500)
        };
      })
    : [];

  return {
    birthDate: asString(src.birthDate || "2008-12-21", 32),
    hero: {
      greeting: asString(heroIn.greeting || "Hi, I'm Erwin Anthony Rodrigues", 200),
      line: asString(heroIn.line || "", 500),
      motto: asString(heroIn.motto || "", 500),
      photo: asString(heroIn.photo || "assets/portrait.svg", 300),
      photoAlt: asString(heroIn.photoAlt || "Portrait of Erwin Anthony Rodrigues", 300)
    },
    about: {
      paragraphs: paragraphs,
      currentlyWorkingOn: asString(aboutIn.currentlyWorkingOn || "", 2000),
      style: {
        fontFamily: asString(styleIn.fontFamily || "Segoe UI", 80),
        fontSize: asString(styleIn.fontSize || "1rem", 40),
        fontWeight: asString(styleIn.fontWeight || "400", 40),
        lineHeight: asString(styleIn.lineHeight || "1.7", 40),
        color: asString(styleIn.color || "#241F1C", 40)
      }
    },
    certificates: certificates,
    github: {
      username: asString(githubIn.username || "", 80)
    },
    projects: projects,
    contact: {
      mobile: asString(contactIn.mobile || "", 80),
      instagram: asString(contactIn.instagram || "", 200),
      linkedin: asString(contactIn.linkedin || "", 300)
    }
  };
}

function buildDataJs(portfolio) {
  return [
    "/* Editable portfolio content.",
    "   Change values in this file only.",
    "   Each list stands alone: adding, removing, or reordering items",
    "   in one list leaves every other section as it is.",
    "   birthDate is stored here so the page can calculate age.",
    "   The date itself is never shown. */",
    "",
    "window.portfolioData = " + JSON.stringify(portfolio, null, 2) + ";",
    ""
  ].join("\n");
}

function handlePublish(req, res) {
  if (!isLocalOrigin(req)) {
    sendJson(res, 403, { ok: false, error: "Invalid origin" });
    return;
  }
  if (!isBearerAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: "Authentication required" });
    return;
  }

  readBody(req, MAX_JSON_BYTES + MAX_ASSET_BYTES * 2)
    .then(function (buf) {
      let payload;
      try {
        payload = JSON.parse(buf.toString("utf8"));
      } catch (err) {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        return;
      }

      if (payload && payload.dataJs) {
        sendJson(res, 400, {
          ok: false,
          error: "Freeform dataJs is not allowed. Send portfolio JSON only."
        });
        return;
      }

      const portfolio = sanitizePortfolio(payload && payload.portfolio);
      const dataJs = buildDataJs(portfolio);
      if (dataJs.length > MAX_JSON_BYTES) {
        sendJson(res, 400, { ok: false, error: "Serialized portfolio too large" });
        return;
      }

      const files = Array.isArray(payload.files) ? payload.files : [];
      if (files.length > MAX_FILES) {
        sendJson(res, 400, { ok: false, error: "Too many files" });
        return;
      }

      const prepared = [];
      for (let i = 0; i < files.length; i += 1) {
        const item = files[i] || {};
        const dest = safeAssetPath(item.path);
        if (!dest) {
          sendJson(res, 400, { ok: false, error: "Invalid or disallowed asset path: " + item.path });
          return;
        }
        const ext = path.extname(dest).toLowerCase();
        let buffer;
        try {
          buffer = Buffer.from(String(item.contentBase64 || ""), "base64");
        } catch (err) {
          sendJson(res, 400, { ok: false, error: "Invalid base64 for " + item.path });
          return;
        }
        if (!buffer.length || buffer.length > MAX_ASSET_BYTES) {
          sendJson(res, 400, { ok: false, error: "Asset too large or empty: " + item.path });
          return;
        }
        if (!looksLikeAllowedFile(ext, buffer)) {
          sendJson(res, 400, {
            ok: false,
            error: "Asset content does not match allowed type: " + item.path
          });
          return;
        }
        prepared.push({ dest: dest, path: item.path, buffer: buffer });
      }

      const dataPath = path.join(ROOT, "data.js");
      const tmpData = dataPath + ".tmp-" + crypto.randomBytes(6).toString("hex");
      fs.writeFileSync(tmpData, dataJs, "utf8");
      fs.renameSync(tmpData, dataPath);

      const written = [];
      for (let i = 0; i < prepared.length; i += 1) {
        const item = prepared[i];
        fs.mkdirSync(path.dirname(item.dest), { recursive: true });
        fs.writeFileSync(item.dest, item.buffer);
        written.push(item.path);
      }

      sendJson(res, 200, { ok: true, wrote: "data.js", files: written });
    })
    .catch(function (err) {
      sendJson(res, 413, { ok: false, error: String(err.message || err) });
    });
}

function sendFile(req, res, file) {
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    const size = stat.size;
    const wantDownload = /[?&]download=1(?:&|$)/.test(req.url || "");
    const headers = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    };
    if (ext === ".pdf") {
      const mode = wantDownload ? "attachment" : "inline";
      headers["Content-Disposition"] =
        mode + '; filename="' + path.basename(file) + '"';
    }

    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        res.writeHead(416, {
          "Content-Range": "bytes */" + size,
          "Content-Type": "text/plain; charset=utf-8"
        });
        res.end("Range Not Satisfiable");
        return;
      }
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
      headers["Content-Length"] = String(end - start + 1);
      res.writeHead(206, headers);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(file, { start: start, end: end }).pipe(res);
      return;
    }

    headers["Content-Length"] = String(size);
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
}

http
  .createServer(function (req, res) {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const normalized = (urlPath === "/" ? "/index.html" : urlPath).replace(/\\/g, "/");

    if (normalized === "/api/publish" && req.method === "POST") {
      handlePublish(req, res);
      return;
    }

    if (isDeniedStaticPath(normalized)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }

    const file = path.resolve(ROOT, "." + normalized);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    sendFile(req, res, file);
  })
  .listen(PORT, "127.0.0.1", function () {
    console.log("Serving http://127.0.0.1:" + PORT + "/");
    console.log("Login is client-side (js/auth.js)");
    console.log("Durable publish: POST /api/publish (Bearer token)");
  });
