import express from "express";
import dotenv from "dotenv";
import TwitterBot from "./bot-supabase.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const bot = new TwitterBot();

// Initialize bot
await bot.initialize();

// Auto-start if configured
if (bot.config.isActive) {
  await bot.start();
}

// Health check endpoint (for Render)
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Self-ping endpoint
app.get("/ping", (req, res) => {
  res.json({ status: "pong", timestamp: new Date().toISOString() });
});

// Authentication endpoint
app.post("/api/authenticate", (req, res) => {
  const { passcode } = req.body;
  const correctPasscode = process.env.DASHBOARD_PASSCODE || "admin123";

  if (passcode === correctPasscode) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Get bot stats
app.get("/api/stats", (req, res) => {
  try {
    const stats = bot.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all posts
app.get("/api/posts", (req, res) => {
  try {
    const { filter } = req.query;
    let posts = bot.posts;

    if (filter === "posted") {
      posts = bot.getPostedPosts();
    } else if (filter === "unposted") {
      posts = bot.getUnpostedPosts();
    }

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduled posts for today
app.get("/api/scheduled", (req, res) => {
  try {
    const scheduled = bot.config.scheduledPosts.map((sp) => {
      const post = bot.posts.find((p) => p.id === sp.postId);
      return { ...sp, post };
    });
    res.json(scheduled);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start bot
app.post("/api/start", async (req, res) => {
  try {
    await bot.start();
    res.json({ success: true, message: "Bot started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop bot
app.post("/api/stop", async (req, res) => {
  try {
    await bot.stop();
    res.json({ success: true, message: "Bot stopped" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update config
app.post("/api/config", async (req, res) => {
  try {
    const { minPostsPerDay, maxPostsPerDay, startTime, endTime } = req.body;

    if (minPostsPerDay !== undefined)
      bot.config.minPostsPerDay = minPostsPerDay;
    if (maxPostsPerDay !== undefined)
      bot.config.maxPostsPerDay = maxPostsPerDay;
    if (startTime) bot.config.startTime = startTime;
    if (endTime) bot.config.endTime = endTime;

    await bot.saveConfig();

    // Smart recalculation: reschedule if bot is active
    if (bot.config.isActive) {
      await bot.schedulePostsForToday();
    }

    res.json({ success: true, config: bot.config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post now
app.post("/api/post-now", async (req, res) => {
  try {
    const { postId } = req.body;
    const post = bot.posts.find((p) => p.id === postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.posted) {
      return res.status(400).json({ error: "Post already posted" });
    }

    const result = await bot.postTweet(post);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Skip scheduled post
app.post("/api/skip-post", async (req, res) => {
  try {
    const { postId } = req.body;
    
    // Remove from scheduled posts array
    bot.config.scheduledPosts = bot.config.scheduledPosts.filter(
      (sp) => sp.postId !== postId
    );
    
    // Save to config and Supabase
    await bot.saveConfig();
    await bot.saveScheduledPosts();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update scheduled post time
app.post("/api/update-schedule", async (req, res) => {
  try {
    const { postId, newTime } = req.body;
    const scheduled = bot.config.scheduledPosts.find(
      (sp) => sp.postId === postId
    );

    if (scheduled) {
      scheduled.time = new Date(newTime).toISOString();
      await bot.saveConfig();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Scheduled post not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Swap scheduled posts
app.post("/api/swap-posts", async (req, res) => {
  try {
    const { postId1, postId2 } = req.body;
    const idx1 = bot.config.scheduledPosts.findIndex(
      (sp) => sp.postId === postId1
    );
    const idx2 = bot.config.scheduledPosts.findIndex(
      (sp) => sp.postId === postId2
    );

    if (idx1 !== -1 && idx2 !== -1) {
      const temp = bot.config.scheduledPosts[idx1].postId;
      bot.config.scheduledPosts[idx1].postId =
        bot.config.scheduledPosts[idx2].postId;
      bot.config.scheduledPosts[idx2].postId = temp;
      await bot.saveConfig();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Posts not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new posts
app.post("/api/add-posts", async (req, res) => {
  try {
    const { posts: newPosts, position, sortByViews } = req.body;

    if (!Array.isArray(newPosts)) {
      return res.status(400).json({ error: "Posts must be an array" });
    }

    // Add posted field to new posts
    const postsToAdd = newPosts.map((post) => ({
      ...post,
      posted: false,
      id: post.id || Date.now() + Math.random().toString(36),
    }));

    if (position === "before") {
      bot.posts = [...postsToAdd, ...bot.posts];
    } else if (position === "after") {
      bot.posts = [...bot.posts, ...postsToAdd];
    } else {
      // Insert and optionally sort
      bot.posts = [...bot.posts, ...postsToAdd];
      if (sortByViews) {
        bot.posts.sort((a, b) => (b.views || 0) - (a.views || 0));
      }
    }

    await bot.savePosts();
    res.json({ success: true, totalPosts: bot.posts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download posts.json
app.get("/api/download-posts", async (req, res) => {
  try {
    res.download(bot.postsFile, "posts.json");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update post content
app.post("/api/update-post", async (req, res) => {
  try {
    const { postId, content } = req.body;
    const post = bot.posts.find((p) => p.id === postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.content = content;
    await bot.savePosts();
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reschedule posts for today
app.post("/api/reschedule", async (req, res) => {
  try {
    bot.schedulePostsForToday();
    res.json({ success: true, scheduled: bot.config.scheduledPosts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Self-ping service to keep server awake
const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

function startSelfPing() {
  const baseUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.APP_URL ||
    `http://localhost:${PORT}`;

  setInterval(async () => {
    try {
      const url = `${baseUrl}/ping`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(`✓ Self-ping successful at ${data.timestamp}`);
    } catch (error) {
      console.error("✗ Self-ping failed:", error.message);
    }
  }, SELF_PING_INTERVAL);

  console.log(`⏰ Self-ping enabled: pinging every 14 minutes`);
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);

  // Start self-ping after server is running
  setTimeout(startSelfPing, 5000); // Wait 5 seconds before first ping
});
