import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import axios from "axios";
import { supabase } from "./supabase.js";

dotenv.config();

class TwitterBot {
  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

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
      startedAt: null,
    };
    this.scheduledTimes = [];
    this.configId = 1; // Default config ID
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
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("views", { ascending: false });

      if (error) throw error;

      this.posts = data || [];
      console.log(`✓ Loaded ${this.posts.length} posts from Supabase`);
    } catch (error) {
      console.error("✗ Error loading posts:", error);
      throw error;
    }
  }

  async savePosts() {
    // Posts are updated individually, no need for bulk save
    return true;
  }

  async updatePost(postId, updates) {
    try {
      const { error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", postId);

      if (error) throw error;

      // Update local cache
      const post = this.posts.find((p) => p.id === postId);
      if (post) {
        Object.assign(post, updates);
      }
    } catch (error) {
      console.error("✗ Error updating post:", error);
      throw error;
    }
  }

  async loadConfig() {
    try {
      const { data, error } = await supabase
        .from("bot_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        this.configId = data.id;
        this.config = {
          isActive: data.is_active || false,
          minPostsPerDay: data.min_posts_per_day || 7,
          maxPostsPerDay: data.max_posts_per_day || 15,
          startTime: data.start_time || "08:00",
          endTime: data.end_time || "22:00",
          postsToday: data.posts_today || 0,
          lastPostDate: data.last_post_date || null,
          startedAt: data.started_at || null,
          scheduledPosts: [],
        };

        // Load scheduled posts
        await this.loadScheduledPosts();
        console.log(
          `✓ Loaded config: ${this.config.minPostsPerDay}-${this.config.maxPostsPerDay} posts, ${this.config.startTime}-${this.config.endTime}`
        );
      } else {
        // Create default config if it doesn't exist
        await this.saveConfig();
      }
    } catch (error) {
      console.error("✗ Error loading config:", error);
      // Create default config if it doesn't exist
      await this.saveConfig();
    }
  }

  async loadScheduledPosts() {
    try {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_time", { ascending: true });

      if (error) throw error;

      this.config.scheduledPosts = (data || []).map((sp) => ({
        time: sp.scheduled_time,
        postId: sp.post_id,
        status: sp.status,
        id: sp.id,
      }));
    } catch (error) {
      console.error("✗ Error loading scheduled posts:", error);
    }
  }

  async saveConfig() {
    try {
      const configData = {
        is_active: this.config.isActive,
        min_posts_per_day: this.config.minPostsPerDay,
        max_posts_per_day: this.config.maxPostsPerDay,
        start_time: this.config.startTime,
        end_time: this.config.endTime,
        posts_today: this.config.postsToday,
        last_post_date: this.config.lastPostDate,
        started_at: this.config.startedAt,
      };

      const { data, error } = await supabase
        .from("bot_config")
        .upsert(configData, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;
      if (data) this.configId = data.id;
    } catch (error) {
      console.error("✗ Error saving config:", error);
      throw error;
    }
  }

  async saveScheduledPosts() {
    try {
      // Delete all existing scheduled posts
      await supabase.from("scheduled_posts").delete().eq("status", "scheduled");

      // Insert new scheduled posts
      if (this.config.scheduledPosts.length > 0) {
        const scheduledData = this.config.scheduledPosts
          .filter((sp) => sp.status === "scheduled")
          .map((sp) => ({
            post_id: sp.postId,
            scheduled_time: sp.time,
            status: sp.status,
          }));

        if (scheduledData.length > 0) {
          const { error } = await supabase
            .from("scheduled_posts")
            .insert(scheduledData);

          if (error) throw error;
        }
      }
    } catch (error) {
      console.error("✗ Error saving scheduled posts:", error);
    }
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
      const content = post.content || "";
      const tweet = await this.client.v2.tweet(content, tweetOptions);

      // Update post in Supabase
      await this.updatePost(post.id, {
        posted: true,
        posted_at: new Date().toISOString(),
        tweet_id: tweet.data.id,
      });

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
        this.saveScheduledPosts();
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
    this.saveScheduledPosts();
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

  async start() {
    console.log("🚀 Starting Twitter Bot...");
    this.config.isActive = true;
    this.config.startedAt = new Date().toISOString();
    this.config.scheduledPosts = []; // Clear old schedule
    await this.saveConfig();

    // Schedule posts for today
    this.schedulePostsForToday();

    // Check for posts to tweet every minute
    this.interval = setInterval(() => {
      this.checkScheduledPosts();
    }, 60000);

    console.log("✓ Bot started successfully");
  }

  async stop() {
    console.log("⏸ Stopping Twitter Bot...");
    this.config.isActive = false;
    this.config.startedAt = null;
    this.config.scheduledPosts = []; // Clear scheduled posts
    await this.saveConfig();
    await this.saveScheduledPosts();

    if (this.interval) {
      clearInterval(this.interval);
    }

    console.log("✓ Bot stopped");
  }

  async checkScheduledPosts() {
    if (!this.config.isActive) return;

    const now = new Date();
    const scheduledPosts = this.config.scheduledPosts.filter(
      (sp) => sp.status === "scheduled"
    );

    for (const scheduled of scheduledPosts) {
      const scheduledTime = new Date(scheduled.time);

      if (now >= scheduledTime) {
        const post = this.posts.find((p) => p.id === scheduled.postId);

        if (post && !post.posted) {
          await this.postTweet(post);
          scheduled.status = "posted";
          this.config.postsToday++;
          await this.saveConfig();
          await this.saveScheduledPosts();
        }
      }
    }
  }

  getUnpostedPosts() {
    return this.posts.filter((p) => !p.posted);
  }

  getPostedPosts() {
    return this.posts.filter((p) => p.posted);
  }

  getStats() {
    const totalPosts = this.posts.length;
    const posted = this.getPostedPosts().length;
    const remaining = this.getUnpostedPosts().length;
    const scheduled = this.config.scheduledPosts.filter(
      (sp) => sp.status === "scheduled"
    ).length;

    const nextScheduledPost = this.config.scheduledPosts
      .filter((sp) => sp.status === "scheduled")
      .sort((a, b) => new Date(a.time) - new Date(b.time))[0];

    return {
      totalPosts,
      posted,
      remaining,
      today: this.config.postsToday,
      scheduled,
      isActive: this.config.isActive,
      nextScheduledPost: nextScheduledPost?.time || null,
      startedAt: this.config.startedAt,
    };
  }
}

export default TwitterBot;
