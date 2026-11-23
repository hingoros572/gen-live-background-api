const API_BASE = "https://api.poof.bg/v1";

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.POOF_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Server is missing POOF_API_KEY" });
  }

  const jobId = typeof req.query.job_id === "string" ? req.query.job_id : "";
  if (!/^job_[a-zA-Z0-9_-]+$/.test(jobId)) {
    return sendJson(res, 400, { error: "A valid Poof job_id is required." });
  }

  try {
    const upstream = await fetch(API_BASE + "/jobs/" + encodeURIComponent(jobId), {
      method: "GET",
      headers: { "x-api-key": apiKey }
    });
    const payload = await upstream.json();
    return sendJson(res, upstream.status, payload);
  } catch (error) {
    return sendJson(res, 502, { error: "Could not check Poof job", message: error.message });
  }
};
