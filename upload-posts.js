import fs from "fs/promises";
import { supabase } from "./supabase.js";

async function uploadPosts() {
  try {
    console.log("📖 Reading posts.json...");
    const data = await fs.readFile("./posts.json", "utf8");
    const posts = JSON.parse(data);

    console.log(`📊 Found ${posts.length} posts to upload`);

    // Remove duplicates - keep first occurrence of each ID
    const uniquePosts = [];
    const seenIds = new Set();

    for (const post of posts) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        uniquePosts.push(post);
      }
    }

    console.log(
      `✨ Removed ${posts.length - uniquePosts.length} duplicate posts`
    );
    console.log(`📤 Uploading ${uniquePosts.length} unique posts...`);

    // Upload in batches of 100 to avoid timeout
    const batchSize = 100;
    let uploaded = 0;

    for (let i = 0; i < uniquePosts.length; i += batchSize) {
      const batch = uniquePosts.slice(i, i + batchSize);

      console.log(
        `⬆️  Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          uniquePosts.length / batchSize
        )}...`
      );

      const { data: insertedData, error } = await supabase
        .from("posts")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`❌ Error uploading batch:`, error);
        throw error;
      }

      uploaded += batch.length;
      console.log(`✅ Uploaded ${uploaded}/${uniquePosts.length} posts`);
    }

    console.log("🎉 All posts uploaded successfully!");

    // Verify upload
    const { count, error: countError } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Error counting posts:", countError);
    } else {
      console.log(`✅ Total posts in database: ${count}`);
    }
  } catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
  }
}

// Run the upload
uploadPosts();
