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

// Generate a structured video script
app.post("/api/script", (req, res) => {
  try {
    const {
      topic,
      prompt,
      language = "Hindi",
      duration = "60 seconds",
      style = "Cinematic realistic",
      voice = "Natural male voice",
      format = "Shorts (9:16)"
    } = req.body || {};

    const subject = String(topic || prompt || "").trim();

    if (!subject || subject.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "A valid video topic is required."
      });
    }

    let script;

    if (language === "English") {
      script = `TITLE: ${subject}

VIDEO STYLE: ${style}
FORMAT: ${format}
DURATION: ${duration}
VOICE: ${voice}

INTRO:
Welcome! Today, we are exploring ${subject}.

SCENE 1 - INTRODUCTION:
Introduce the topic with an engaging opening visual.

SCENE 2 - MAIN STORY:
Explain the important details about ${subject}.
Use relevant visuals and clear narration.

SCENE 3 - KEY MOMENT:
Show the most interesting aspect of the topic.

SCENE 4 - CONCLUSION:
Summarize the main message and leave viewers with a memorable thought.

OUTRO:
If you enjoyed this video, like, share and subscribe!`;

    } else if (language === "Hinglish") {
      script = `TITLE: ${subject}

STYLE: ${style}
FORMAT: ${format}
DURATION: ${duration}
VOICE: ${voice}

INTRO:
Hello dosto! Aaj hum baat karenge ${subject} ke baare mein.

SCENE 1:
Is topic ka interesting introduction dijiye.

SCENE 2:
Ab jaante hain ${subject} ki important details.

SCENE 3:
Iska sabse interesting aur important part dekhiye.

SCENE 4:
Toh dosto, aaj humne ${subject} ke baare mein jaana.

OUTRO:
Video pasand aaye toh Like, Share aur Subscribe zaroor karein!`;

    } else {
      script = `शीर्षक: ${subject}

स्टाइल: ${style}
फॉर्मेट: ${format}
अवधि: ${duration}
आवाज़: ${voice}

INTRO:
नमस्कार दोस्तों! आज हम जानेंगे ${subject} के बारे में।

सीन 1 - शुरुआत:
एक आकर्षक दृश्य के साथ विषय का परिचय दें।

सीन 2 - मुख्य जानकारी:
${subject} से जुड़ी महत्वपूर्ण जानकारी आसान भाषा में बताएं।

सीन 3 - खास जानकारी:
विषय के सबसे रोचक पहलू को दिखाएं और समझाएं।

सीन 4 - निष्कर्ष:
पूरी जानकारी का सार बताएं और दर्शकों को एक यादगार संदेश दें।

OUTRO:
अगर वीडियो पसंद आया हो तो लाइक, शेयर और चैनल को सब्सक्राइब जरूर करें!`;
    }

    return res.json({
      success: true,
      script,
      type: "template-based"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Could not generate script."
    });
  }
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
        
