import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";

dotenv.config();

async function postTweet() {
  try {
    // Initialize Twitter client with OAuth 1.0a credentials (required for posting)
    const twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    // Post the tweet
    const tweet = await twitterClient.v2.tweet("Hello World");

    console.log("✓ Tweet posted successfully!");
    console.log("Tweet ID:", tweet.data.id);
    console.log("Tweet text:", tweet.data.text);
  } catch (error) {
    console.error("✗ Error posting tweet:", error);
    if (error.data) {
      console.error("Error details:", JSON.stringify(error.data, null, 2));
    }
  }
}

postTweet();
