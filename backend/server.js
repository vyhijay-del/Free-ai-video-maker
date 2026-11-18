import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const AGNES_API_KEY = process.env.AGNES_API_KEY;
const AGNES_BASE = "https://apihub.agnes-ai.com";
const MODEL = "agnes-video-2.5-flash";

const ALLOWED_ORIGIN =
  "https://vyhijay-del.github.io";

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "AI Video Studio Backend",
    model: MODEL
  });
});

// Create a video generation task
app.post("/api/video", async (req, res) => {
  try {
    if (!AGNES_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Server API key is not configured."
      });
    }

    const {
      prompt,
      seconds = "8",
      aspect_ratio = "16:9"
    } = req.body || {};

    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid prompt is required."
      });
    }

    const duration = Number(seconds);

    if (
      !Number.isInteger(duration) ||
      duration < 4 ||
      duration > 12
    ) {
      return res.status(400).json({
        success: false,
        error: "Video duration must be 4 to 12 seconds."
      });
    }

    const allowedRatios = [
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4",
      "21:9"
    ];

    if (!allowedRatios.includes(aspect_ratio)) {
      return res.status(400).json({
        success: false,
        error: "Invalid aspect ratio."
      });
    }

    const response = await fetch(
      `${AGNES_BASE}/v1/videos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AGNES_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompt.trim(),
          mode: "text",
          seconds: String(duration),
          size: "720P",
          aspect_ratio,
          n: 1
        }),
        signal: AbortSignal.timeout(90000)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message ||
          data.message ||
          "Agnes video request failed."
      });
    }

    const videoId =
      data.video_id || data.id || data.task_id;

    if (!videoId) {
      return res.status(502).json({
        success: false,
        error: "Agnes did not return a video ID."
      });
    }

    res.json({
      success: true,
      video_id: videoId,
      model: MODEL,
      message: "Video task submitted."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not submit video request."
    });
  }
});

// Check video generation status
app.get("/api/video/status", async (req, res) => {
  try {
    if (!AGNES_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Server API key is not configured."
      });
    }

    const videoId = req.query.video_id;

    if (
      typeof videoId !== "string" ||
      !videoId.trim() ||
      videoId.length > 300
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid video_id is required."
      });
    }

    const url = new URL(`${AGNES_BASE}/agnesapi`);
    url.searchParams.set("video_id", videoId);
    url.searchParams.set("model_name", MODEL);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AGNES_API_KEY}`
      },
      signal: AbortSignal.timeout(30000)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message ||
          data.message ||
          "Could not check video status."
      });
    }

    res.json({
      success: true,
      status: data.status || "processing",
      video_url: data.url || null
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not check video status."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Video Studio backend running on port ${PORT}`);
});
        
