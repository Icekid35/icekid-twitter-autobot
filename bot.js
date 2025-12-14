import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import axios from "axios";

dotenv.config();

class TwitterBot {
  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    this.postsFile = path.join(process.cwd(), "posts.json");
    this.configFile = path.join(process.cwd(), "bot-config.json");
    this.posts = [];
    this.config = {
      isActive: false,
      minPostsPerDay: 7,
      maxPostsPerDay: 15,
      startTime: "08:00",
      endTime: "22:00",
      postsToday: 0,
      lastPostDate: null,
      scheduledPosts: [],
      startedAt: new Date().toISOString(),
    };
    this.scheduledTimes = [];
  }

  async initialize() {
    try {
      await this.loadPosts();
      await this.loadConfig();
      console.log("✓ Bot initialized successfully");
    } catch (error) {
      console.error("✗ Error initializing bot:", error);
      throw error;
    }
  }

  async loadPosts() {
    try {
      const data = await fs.readFile(this.postsFile, "utf8");
      this.posts = JSON.parse(data);
      console.log(`✓ Loaded ${this.posts.length} posts`);
    } catch (error) {
      console.error("✗ Error loading posts:", error);
      throw error;
    }
  }

  async savePosts() {
    try {
      await fs.writeFile(
        this.postsFile,
        JSON.stringify(this.posts, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("✗ Error saving posts:", error);
      throw error;
    }
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configFile, "utf8");
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (error) {
      // Config file doesn't exist, create it
      await this.saveConfig();
    }
  }

  async saveConfig() {
    try {
      await fs.writeFile(
        this.configFile,
        JSON.stringify(this.config, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("✗ Error saving config:", error);
      throw error;
    }
  }

  getUnpostedPosts() {
    return this.posts.filter((post) => !post.posted);
  }

  getPostedPosts() {
    return this.posts.filter((post) => post.posted);
  }

  async downloadMedia(url) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error(`✗ Error downloading media from ${url}:`, error.message);
      return null;
    }
  }

  async uploadMedia(mediaUrl) {
    try {
      const mediaBuffer = await this.downloadMedia(mediaUrl);
      if (!mediaBuffer) return null;

      const mediaId = await this.client.v1.uploadMedia(mediaBuffer, {
        mimeType: mediaUrl.includes(".mp4") ? "video/mp4" : "image/jpeg",
      });

      return mediaId;
    } catch (error) {
      console.error("✗ Error uploading media:", error.message);
      return null;
    }
  }

  async postTweet(post) {
    try {
      const tweetOptions = {};

      // Upload media if available
      if (post.media && post.media.length > 0) {
        const mediaIds = [];
        for (const mediaUrl of post.media.slice(0, 4)) {
          const mediaId = await this.uploadMedia(mediaUrl);
          if (mediaId) mediaIds.push(mediaId);
        }
        if (mediaIds.length > 0) {
          tweetOptions.media = { media_ids: mediaIds };
        }
      }

      // Post tweet
      const content = post.content || ""; // Empty string if no content
      const tweet = await this.client.v2.tweet(content, tweetOptions);

      // Mark as posted
      post.posted = true;
      post.postedAt = new Date().toISOString();
      post.tweetId = tweet.data.id;

      await this.savePosts();

      console.log(
        `✓ Posted tweet: ${content.substring(0, 50)}... (ID: ${tweet.data.id})`
      );
      return { success: true, tweet: tweet.data };
    } catch (error) {
      console.error("✗ Error posting tweet:", error);
      return { success: false, error: error.message };
    }
  }

  schedulePostsForToday() {
    if (!this.config.isActive) return;

    const now = new Date();
    const today = now.toDateString();

    // Reset daily counter if new day
    if (this.config.lastPostDate !== today) {
      this.config.postsToday = 0;
      this.config.lastPostDate = today;
      this.config.scheduledPosts = [];
    }

    // Calculate posts for today
    const { minPostsPerDay, maxPostsPerDay } = this.config;
    const postsForToday =
      Math.floor(Math.random() * (maxPostsPerDay - minPostsPerDay + 1)) +
      minPostsPerDay;

    // Smart calculation: subtract posts already made today
    const remaining = postsForToday - this.config.postsToday;

    // Filter out already scheduled/posted items
    const currentlyScheduled = this.config.scheduledPosts.filter(
      (sp) => sp.status === "scheduled"
    ).length;
    const neededPosts = Math.max(0, remaining - currentlyScheduled);

    if (neededPosts <= 0) {
      // If config reduced max posts, remove excess scheduled posts
      if (currentlyScheduled > remaining) {
        this.config.scheduledPosts = this.config.scheduledPosts
          .filter((sp) => sp.status !== "scheduled")
          .concat(
            this.config.scheduledPosts
              .filter((sp) => sp.status === "scheduled")
              .slice(0, remaining)
          );
        this.saveConfig();
      }
      return;
    }

    // Generate random times between start and end time
    const times = this.generateRandomTimes(neededPosts);
    const unpostedPosts = this.getUnpostedPosts();

    // Add new scheduled posts
    const newScheduled = times.map((time, index) => {
      const post = unpostedPosts[index];
      return {
        time: time.toISOString(),
        postId: post?.id || null,
        status: "scheduled",
      };
    });

    // Combine existing scheduled with new ones
    const existingScheduled = this.config.scheduledPosts.filter(
      (sp) => sp.status === "scheduled"
    );
    this.config.scheduledPosts = [...existingScheduled, ...newScheduled].sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );

    this.saveConfig();
  }

  generateRandomTimes(count) {
    const [startHour, startMin] = this.config.startTime.split(":").map(Number);
    const [endHour, endMin] = this.config.endTime.split(":").map(Number);

    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(now);
    endTime.setHours(endHour, endMin, 0, 0);

    // If current time is past start time, start from now
    if (now > startTime) startTime.setTime(now.getTime() + 60000);

    const times = [];
    const range = endTime - startTime;

    for (let i = 0; i < count; i++) {
      const randomTime = new Date(startTime.getTime() + Math.random() * range);
      times.push(randomTime);
    }

    return times.sort((a, b) => a - b);
  }

  async processScheduledPosts() {
    if (!this.config.isActive) return;

    const now = new Date();
    const scheduled = this.config.scheduledPosts.filter(
      (sp) => sp.status === "scheduled"
    );

    for (const scheduledPost of scheduled) {
      const postTime = new Date(scheduledPost.time);
      if (now >= postTime && scheduledPost.postId) {
        const post = this.posts.find((p) => p.id === scheduledPost.postId);
        if (post && !post.posted) {
          const result = await this.postTweet(post);
          if (result.success) {
            scheduledPost.status = "posted";
            this.config.postsToday++;
            await this.saveConfig();
          } else {
            scheduledPost.status = "failed";
            scheduledPost.error = result.error;
          }
        }
      }
    }
  }

  async start() {
    console.log("🚀 Starting Twitter Bot...");
    this.config.isActive = true;
    this.config.startedAt = new Date().toISOString();

    // Clear any old scheduled posts and start fresh
    this.config.scheduledPosts = [];

    await this.saveConfig();

    // Schedule posts for today
    this.schedulePostsForToday();

    // Check every minute
    this.interval = setInterval(async () => {
      await this.processScheduledPosts();

      // Schedule new posts if needed
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.schedulePostsForToday();
      }
    }, 60000);

    console.log("✓ Bot started successfully");
  }

  async stop() {
    console.log("⏸ Stopping Twitter Bot...");
    this.config.isActive = false;

    // Clear all scheduled posts for today
    this.config.scheduledPosts = [];
    this.config.startedAt = null;

    await this.saveConfig();

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log("✓ Bot stopped");
  }

  getStats() {
    const unposted = this.getUnpostedPosts();
    const posted = this.getPostedPosts();
    const nextScheduled = this.config.scheduledPosts.find(
      (sp) => sp.status === "scheduled"
    );

    return {
      totalPosts: this.posts.length,
      posted: posted.length,
      remaining: unposted.length,
      postsToday: this.config.postsToday,
      scheduled: this.config.scheduledPosts.filter(
        (sp) => sp.status === "scheduled"
      ).length,
      isActive: this.config.isActive,
      nextPostTime: nextScheduled?.time || null,
      scheduledToday: this.config.scheduledPosts.length,
      startedAt: this.config.startedAt,
      minPostsPerDay: this.config.minPostsPerDay,
      maxPostsPerDay: this.config.maxPostsPerDay,
      startTime: this.config.startTime,
      endTime: this.config.endTime,
    };
  }
}

export default TwitterBot;
