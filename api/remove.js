const API_BASE = "https://api.poof.bg/v1";

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  // Allow browser-based testing from ReqBin. The mobile app itself does not
  // rely on browser CORS, but ReqBin may send an OPTIONS preflight first.
  res.setHeader("Access-Control-Allow-Origin", "https://reqbin.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.POOF_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Server is missing POOF_API_KEY" });
  }

  const body = req.body || {};
  const mediaUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!mediaUrl) {
    return sendJson(res, 400, { error: "Provide a public HTTPS media URL in 'url'." });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(mediaUrl);
  } catch {
    return sendJson(res, 400, { error: "The media URL is invalid." });
  }
  if (parsedUrl.protocol !== "https:") {
    return sendJson(res, 400, { error: "Only public HTTPS media URLs are accepted." });
  }

  const format = typeof body.format === "string" ? body.format : "";
  const allowedFormats = ["png", "jpg", "webp", "webm", "mov", "mp4", "gif"];
  if (format && !allowedFormats.includes(format)) {
    return sendJson(res, 400, { error: "Unsupported output format." });
  }

  const form = new FormData();
  form.append("url", mediaUrl);
  if (format) form.append("format", format);
  form.append("size", "full");

  if (typeof body.bg_color === "string" && body.bg_color.trim()) {
    form.append("bg_color", body.bg_color.trim());
  }
  if (body.channels === "rgba" || body.channels === "rgb" || body.channels === "alpha") {
    form.append("channels", body.channels);
  }

  try {
    const upstream = await fetch(API_BASE + "/remove", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: form
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const errorText = await upstream.text();
      let details;
      try { details = JSON.parse(errorText); } catch { details = { message: errorText.slice(0, 1000) }; }
      return sendJson(res, upstream.status, { error: "Poof processing request failed", details });
    }

    if (contentType.includes("application/json")) {
      const job = await upstream.json();
      return sendJson(res, upstream.status, job);
    }

    const imageBytes = Buffer.from(await upstream.arrayBuffer());
    return sendJson(res, upstream.status, { contentType: contentType || "image/png", data: imageBytes.toString("base64") });
  } catch (error) {
    return sendJson(res, 502, { error: "Could not reach Poof API", message: error.message });
  }
};
