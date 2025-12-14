# Twitter Bot Dashboard 🤖

A professional, feature-rich Twitter bot with a beautiful admin dashboard for automated posting.

## ✨ Features

### Bot Functionality
- 🤖 **Automated Posting**: Posts 7-15 tweets per day at random intervals
- 📸 **Media Support**: Automatically uploads images and videos with tweets
- ⏰ **Smart Scheduling**: Random posting times between configurable hours
- 🔄 **Auto-Restart**: Self-pings to stay active on Render (free tier)
- 💾 **State Management**: Tracks posted tweets with timestamps
- 🛡️ **Error Handling**: Advanced error handling and recovery

### Dashboard Features
- 📊 **Real-time Stats**: View total, posted, and remaining posts
- 🎯 **Today's Schedule**: See all scheduled posts for the day
- ▶️ **Bot Control**: Start/Stop the bot from the dashboard
- ⚙️ **Configuration**: Adjust min/max posts per day and posting hours
- 📝 **Post Management**: View, edit, skip, or post immediately
- 🔄 **Manual Actions**: Post now, skip posts, or reschedule the day
- ➕ **Add Posts**: Bulk add new posts with flexible positioning
- 💾 **Export**: Download your posts.json file
- 🔄 **Swap Posts**: Reorder scheduled posts by dragging
- 🌓 **Dark/Light Mode**: Beautiful themes following Apple design principles
- 📱 **Mobile Optimized**: Fully responsive, mobile-first design
- ⏱️ **Live Countdown**: Real-time countdown to next post
- 📈 **Uptime Tracker**: Monitor how long the bot has been running

## 🚀 Quick Start

### Local Development

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your Twitter API credentials**
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Create an app with "Read and Write" permissions
   - Copy `.env.example` to `.env` and add your credentials:
   ```bash
   cp .env.example .env
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the dashboard**
   - Navigate to `http://localhost:3000`
   - The bot is OFF by default - click "Start Bot" to begin

## 🌐 Deploy to Render

### Step 1: Prepare Your Repository

1. Push this code to a GitHub repository
2. Make sure `.env` is in `.gitignore` (it already is)

### Step 2: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `twitter-bot` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### Step 3: Add Environment Variables

In the Render dashboard, add these environment variables:

```
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
RENDER_EXTERNAL_URL=https://your-app-name.onrender.com
```

### Step 4: Deploy

- Click "Create Web Service"
- Wait for deployment (2-3 minutes)
- Your dashboard will be live at `https://your-app-name.onrender.com`

### Step 5: Configure Auto-Ping

The bot automatically pings itself every 14 minutes to stay awake on Render's free tier. This is already configured in the code.

## 📖 Usage Guide

### Starting the Bot

1. Open the dashboard
2. Configure your settings:
   - Min/Max posts per day
   - Start time (e.g., 08:00)
   - End time (e.g., 22:00)
3. Click "Save Configuration"
4. Click "Start Bot"

### Managing Posts

**View All Posts**
- Click "View All Posts" to see your entire post library
- Filter by: All, Posted, or Unposted
- See post content, views, and status

**Add New Posts**
- Click the ➕ button
- Paste JSON array of posts
- Choose position: Before All, After All, or Merge & Sort
- Click "Add Posts"

**Scheduled Posts**
- View today's scheduled posts in the dashboard
- Post Now: Immediately post a scheduled tweet
- Skip: Remove from today's schedule
- Reschedule: Generate new random times for today

### Post Format

Posts in `posts.json` should follow this structure:

```json
[
  {
    "id": "unique_id",
    "content": "Tweet text here",
    "timestamp": "Mon, 01 Jan 2024 12:00:00 GMT",
    "views": 1000,
    "media": [
      "https://example.com/image.jpg"
    ],
    "posted": false
  }
]
```

The bot will automatically add `posted`, `postedAt`, and `tweetId` fields when tweets are posted.

## 🎨 Dashboard Features in Detail

### Status Card
- Shows if bot is Active or Inactive
- Start/Stop buttons
- Uptime counter

### Stats Grid
- **Total Posts**: All posts in your library
- **Posted**: Successfully posted tweets
- **Remaining**: Unposted tweets
- **Today**: Posts published today

### Next Scheduled Post
- Shows time of next scheduled tweet
- Live countdown timer
- Updates in real-time

### Configuration
- **Min Posts/Day**: Minimum tweets per day (1-50)
- **Max Posts/Day**: Maximum tweets per day (1-50)
- **Start Time**: When to start posting each day
- **End Time**: When to stop posting each day

### Scheduled Posts Today
- List of all posts scheduled for today
- Time each post will be published
- Post content preview
- Action buttons (Post Now, Skip)
- Status badges (Scheduled, Posted, Skipped)

## 🛠️ API Endpoints

The bot exposes these REST API endpoints:

### Stats & Info
- `GET /api/stats` - Get bot statistics
- `GET /api/posts?filter=all|posted|unposted` - Get posts
- `GET /api/scheduled` - Get today's scheduled posts
- `GET /health` - Health check
- `GET /ping` - Ping endpoint

### Bot Control
- `POST /api/start` - Start the bot
- `POST /api/stop` - Stop the bot
- `POST /api/config` - Update configuration
- `POST /api/reschedule` - Reschedule today's posts

### Post Actions
- `POST /api/post-now` - Post immediately
- `POST /api/skip-post` - Skip a scheduled post
- `POST /api/update-schedule` - Change post time
- `POST /api/swap-posts` - Swap two posts
- `POST /api/add-posts` - Add new posts
- `POST /api/update-post` - Update post content

### File Operations
- `GET /api/download-posts` - Download posts.json

## 🔧 Configuration Files

### bot-config.json
Auto-generated file that stores:
- Bot active state
- Min/max posts per day
- Start/end times
- Daily post count
- Scheduled posts
- Start time

### posts.json
Your post library. Each post gets these fields added:
- `posted`: Boolean indicating if posted
- `postedAt`: ISO timestamp when posted
- `tweetId`: Twitter ID of the posted tweet

## 🎨 Theming

The dashboard includes beautiful light and dark themes:
- Automatically detects system preference
- Manual toggle in header
- Saves preference to localStorage
- Smooth transitions
- Apple-inspired design

## 📱 Mobile Support

The dashboard is fully responsive:
- Optimized layouts for mobile
- Touch-friendly buttons
- Smooth animations
- Native app-like experience
- Works on all screen sizes

## 🐛 Troubleshooting

### Bot won't start
- Check Twitter API credentials in `.env`
- Ensure app has "Read and Write" permissions
- Verify `posts.json` exists and is valid JSON

### Posts not publishing
- Check if bot is active (green status badge)
- Verify scheduled times are in the future
- Check console for error messages
- Ensure posts have content or media

### Dashboard not loading
- Check if server is running (`npm start`)
- Verify port 3000 is available
- Check browser console for errors

### Render deployment issues
- Verify all environment variables are set
- Check Render logs for errors
- Ensure `RENDER_EXTERNAL_URL` is correct
- Wait 2-3 minutes for first deployment

## 📝 License

MIT License - feel free to use and modify!

## 🙏 Support

For issues or questions, please open a GitHub issue.

---

Built with ❤️ using Node.js, Express, Twitter API v2, and vanilla JavaScript.
