// Authentication State
let isAuthenticated = false;

// UI Elements
const authScreen = document.getElementById("authScreen");
const dashboard = document.getElementById("dashboard");
const authForm = document.getElementById("authForm");
const authFeedback = document.getElementById("authFeedback");
const authButtonText = document.getElementById("authButtonText");
const signOutBtn = document.getElementById("signOutBtn");

// Bot Controls
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Stat Elements
const botStatusEl = document.getElementById("botStatus");
const nextPostEl = document.getElementById("nextPost");
const countdownEl = document.getElementById("countdown");
const uptimeEl = document.getElementById("uptime");
const totalPostsEl = document.getElementById("totalPosts");
const postedPostsEl = document.getElementById("postedPosts");
const todayPostsEl = document.getElementById("todayPosts");
const scheduledPostsEl = document.getElementById("scheduledPosts");

// Forms
const configForm = document.getElementById("configForm");
const addPostsBtn = document.getElementById("addPostsBtn");
const viewPostsBtn = document.getElementById("viewPostsBtn");
const downloadBtn = document.getElementById("downloadBtn");

// Modals
const addPostsModal = document.getElementById("addPostsModal");
const viewPostsModal = document.getElementById("viewPostsModal");
const editTimeModal = document.getElementById("editTimeModal");
const lightbox = document.getElementById("lightbox");

// Lists
const scheduledList = document.getElementById("scheduledList");
const scheduledCount = document.getElementById("scheduledCount");
const postsList = document.getElementById("postsList");

// Countdown Timer
let countdownInterval = null;

// Check Authentication on Load
checkAuth();

// Authentication Form
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const passcode = document.getElementById("passcode").value;

  // Show verifying state
  authFeedback.className = "auth-feedback verifying";
  authFeedback.textContent = "Verifying...";
  authButtonText.textContent = "Verifying...";

  try {
    const response = await fetch("/api/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    const data = await response.json();

    if (data.success) {
      authFeedback.className = "auth-feedback success";
      authFeedback.textContent = "Success! Loading dashboard...";
      authButtonText.textContent = "Success!";

      sessionStorage.setItem("authenticated", "true");

      setTimeout(() => {
        isAuthenticated = true;
        showDashboard();
      }, 500);
    } else {
      authFeedback.className = "auth-feedback error";
      authFeedback.textContent = "Incorrect passcode";
      authButtonText.textContent = "Sign In";
    }
  } catch (error) {
    authFeedback.className = "auth-feedback error";
    authFeedback.textContent = "Connection error";
    authButtonText.textContent = "Sign In";
  }
});

// Sign Out
signOutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("authenticated");
  isAuthenticated = false;
  authScreen.style.display = "flex";
  dashboard.style.display = "none";
  document.getElementById("passcode").value = "";
  authFeedback.className = "auth-feedback";
  authFeedback.textContent = "";
  authButtonText.textContent = "Sign In";

  // Clear countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
});

// Check Auth
function checkAuth() {
  const authenticated = sessionStorage.getItem("authenticated");
  if (authenticated === "true") {
    isAuthenticated = true;
    showDashboard();
  }
}

// Show Dashboard
function showDashboard() {
  authScreen.style.display = "none";
  dashboard.style.display = "block";
  loadConfig();
  updateStats();
  updateScheduled();
  setInterval(() => {
    updateStats();
    updateScheduled();
  }, 30000);
}

// Load Configuration
async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    document.getElementById("minPosts").value = config.minPostsPerDay || 7;
    document.getElementById("maxPosts").value = config.maxPostsPerDay || 15;
    document.getElementById("startTime").value = config.startTime || "08:00";
    document.getElementById("endTime").value = config.endTime || "22:00";
  } catch (error) {
    console.error("Error loading config:", error);
  }
}

// Save Configuration
configForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const config = {
    minPostsPerDay: parseInt(document.getElementById("minPosts").value),
    maxPostsPerDay: parseInt(document.getElementById("maxPosts").value),
    startTime: document.getElementById("startTime").value,
    endTime: document.getElementById("endTime").value,
  };

  if (config.minPostsPerDay > config.maxPostsPerDay) {
    alert("Min posts cannot be greater than max posts");
    return;
  }

  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      showToast("Configuration saved successfully");
      // Update UI instantly
      await updateStats();
      await updateScheduled();
    }
  } catch (error) {
    console.error("Error saving config:", error);
    showToast("Error saving configuration", "error");
  }
});

// Start Bot
startBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/start", { method: "POST" });
    if (response.ok) {
      showToast("Bot started successfully");
      // Update UI instantly
      await updateStats();
      await updateScheduled();
    }
  } catch (error) {
    console.error("Error starting bot:", error);
    showToast("Error starting bot", "error");
  }
});

// Stop Bot
stopBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/stop", { method: "POST" });
    if (response.ok) {
      showToast("Bot stopped successfully");
      // Clear countdown
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      // Update UI instantly
      await updateStats();
      await updateScheduled();
    }
  } catch (error) {
    console.error("Error stopping bot:", error);
    showToast("Error stopping bot", "error");
  }
});

// Update Stats
async function updateStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();

    // Update status
    const isActive = stats.isActive;
    const statusBadge = document.getElementById("statusBadge");
    botStatusEl.textContent = isActive ? "Active" : "Inactive";
    if (statusBadge) {
      statusBadge.className = isActive ? "status-badge active" : "status-badge";
    }

    // Show/hide buttons
    startBtn.style.display = isActive ? "none" : "block";
    stopBtn.style.display = isActive ? "block" : "none";

    // Update next post
    const nextPostItem = document.getElementById("nextPostItem");
    const countdownItem = document.getElementById("countdownItem");
    const uptimeItem = document.getElementById("uptimeItem");

    if (stats.nextScheduledPost) {
      const nextTime = new Date(stats.nextScheduledPost);
      nextPostEl.textContent = nextTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      nextPostItem.style.display = "flex";

      // Start or update countdown
      if (isActive) {
        startCountdown(nextTime);
        countdownItem.style.display = "flex";
      } else {
        // Clear countdown when bot is not active
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        countdownItem.style.display = "none";
      }
    } else {
      nextPostItem.style.display = "none";
      countdownItem.style.display = "none";
      // Clear countdown if no next post
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    // Update uptime
    if (stats.startedAt && isActive) {
      const uptime = Date.now() - new Date(stats.startedAt).getTime();
      uptimeEl.textContent = formatUptime(uptime);
      uptimeItem.style.display = "flex";
    } else {
      uptimeItem.style.display = "none";
    }

    // Update stat cards
    totalPostsEl.textContent = stats.totalPosts || 0;
    postedPostsEl.textContent = stats.posted || 0;
    todayPostsEl.textContent = stats.today || 0;
    scheduledPostsEl.textContent = stats.scheduled || 0;
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

// Start Countdown
function startCountdown(targetTime) {
  // Clear existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      countdownEl.textContent = "Posting...";
      clearInterval(countdownInterval);
      countdownInterval = null;
      setTimeout(updateStats, 2000);
    } else {
      countdownEl.textContent = formatCountdown(diff);
    }
  }, 1000);
}

// Format Countdown
function formatCountdown(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Format Uptime
function formatUptime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Update Scheduled Posts
async function updateScheduled() {
  try {
    const response = await fetch("/api/scheduled");
    const scheduled = await response.json();

    scheduledCount.textContent = scheduled.length;

    if (scheduled.length === 0) {
      scheduledList.innerHTML =
        '<div class="empty-state">No posts scheduled</div>';
    } else {
      scheduledList.innerHTML = scheduled
        .map((post) => {
          const time = new Date(post.time);
          const timeStr = time.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          let mediaHtml = "";
          if (post.post.media && post.post.media.length > 0) {
            mediaHtml = `
                        <div class="scheduled-media">
                            ${post.post.media
                              .map((url) => {
                                if (!url) return "";
                                const isVideo =
                                  url.includes(".mp4") || url.includes(".mov");
                                if (isVideo) {
                                  return `<video src="${url}" class="media-thumbnail" onclick="openLightbox('${url}', 'video')" onerror="this.style.display='none'"></video>`;
                                } else {
                                  return `<img src="${url}" class="media-thumbnail" onclick="openLightbox('${url}', 'image')" onerror="this.style.display='none'">`;
                                }
                              })
                              .join("")}
                        </div>
                    `;
          }

          return `
                    <div class="scheduled-item">
                        <div class="scheduled-content">
                            <div class="scheduled-time">${timeStr}</div>
                            <div class="scheduled-text">${
                              post.post.content || ""
                            }</div>
                            ${mediaHtml}
                        </div>
                        <div class="scheduled-actions">
                            <button class="btn btn-primary btn-sm" onclick="editPostTime('${
                              post.postId
                            }', '${post.time}')">
                                Edit Time
                            </button>
                            <button class="btn btn-success btn-sm" onclick="postNow('${
                              post.postId
                            }')">
                                Post Now
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="skipPost('${
                              post.postId
                            }')">
                                Skip
                            </button>
                        </div>
                    </div>
                `;
        })
        .join("");
    }
  } catch (error) {
    console.error("Error updating scheduled posts:", error);
  }
}

// Edit Post Time
function editPostTime(postId, currentTime) {
  const modal = document.getElementById("editTimeModal");
  const postIdInput = document.getElementById("editPostId");
  const timeInput = document.getElementById("editPostTime");

  // Convert to datetime-local format
  const date = new Date(currentTime);
  const dateStr = date.toISOString().slice(0, 16);

  postIdInput.value = postId;
  timeInput.value = dateStr;
  modal.classList.add("show");
}

// Close Edit Time Modal
function closeEditTimeModal() {
  const modal = document.getElementById("editTimeModal");
  modal.classList.remove("show");
}

// Edit Time Form
document
  .getElementById("editTimeForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const postId = document.getElementById("editPostId").value;
    const newTime = document.getElementById("editPostTime").value;

    try {
      const response = await fetch("/api/update-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          newTime: new Date(newTime).toISOString(),
        }),
      });

      if (response.ok) {
        showToast("Post time updated successfully");
        closeEditTimeModal();
        await updateStats();
        await updateScheduled();
      } else {
        showToast("Error updating post time", "error");
      }
    } catch (error) {
      console.error("Error updating post time:", error);
      showToast("Error updating post time", "error");
    }
  });

// Post Now
async function postNow(postId) {
  if (!confirm("Post this immediately?")) return;

  try {
    const response = await fetch("/api/post-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });

    if (response.ok) {
      showToast("Post published successfully");
      await updateStats();
      await updateScheduled();
    }
  } catch (error) {
    console.error("Error posting now:", error);
    showToast("Error posting", "error");
  }
}

// Skip Post
async function skipPost(postId) {
  if (!confirm("Skip this scheduled post?")) return;

  try {
    const response = await fetch("/api/skip-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });

    if (response.ok) {
      showToast("Post skipped successfully");
      await updateStats();
      await updateScheduled();
    }
  } catch (error) {
    console.error("Error skipping post:", error);
    showToast("Error skipping post", "error");
  }
}

// Add Posts Modal
addPostsBtn.addEventListener("click", () => {
  addPostsModal.classList.add("show");
});

function closeAddPostsModal() {
  addPostsModal.classList.remove("show");
  document.getElementById("addPostsForm").reset();
}

document
  .getElementById("addPostsForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const postsJson = document.getElementById("newPosts").value;
      const posts = JSON.parse(postsJson);

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts }),
      });

      if (response.ok) {
        showToast("Posts added successfully");
        closeAddPostsModal();
        updateStats();
      }
    } catch (error) {
      console.error("Error adding posts:", error);
      showToast("Error adding posts. Check JSON format.", "error");
    }
  });

// View Posts Modal
viewPostsBtn.addEventListener("click", async () => {
  viewPostsModal.classList.add("show");
  postsList.innerHTML = '<div class="loading">Loading posts...</div>';

  try {
    const response = await fetch("/api/posts");
    const posts = await response.json();

    postsList.innerHTML = posts
      .map((post) => {
        const status = post.posted ? "posted" : "pending";
        const statusText = post.posted ? "Posted" : "Pending";

        let mediaHtml = "";
        if (post.media && post.media.length > 0) {
          mediaHtml = `
                    <div class="scheduled-media">
                        ${post.media
                          .map((url) => {
                            if (!url) return "";
                            const isVideo =
                              url.includes(".mp4") || url.includes(".mov");
                            if (isVideo) {
                              return `<video src="${url}" class="media-thumbnail" onclick="openLightbox('${url}', 'video')" onerror="this.style.display='none'"></video>`;
                            } else {
                              return `<img src="${url}" class="media-thumbnail" onclick="openLightbox('${url}', 'image')" onerror="this.style.display='none'">`;
                            }
                          })
                          .join("")}
                    </div>
                `;
        }

        return `
                <div class="post-item">
                    <div class="post-meta">
                        <span class="post-status ${status}">${statusText}</span>
                        <span class="post-views">${post.views || 0} views</span>
                    </div>
                    <div class="post-text">${post.content || ""}</div>
                    ${mediaHtml}
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading posts:", error);
    postsList.innerHTML = '<div class="empty-state">Error loading posts</div>';
  }
});

function closeViewPostsModal() {
  viewPostsModal.classList.remove("show");
}

// Download Data
downloadBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/posts");
    const posts = await response.json();

    const dataStr = JSON.stringify(posts, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `twitter-posts-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast("Data downloaded successfully");
  } catch (error) {
    console.error("Error downloading data:", error);
    showToast("Error downloading data", "error");
  }
});

// Lightbox
function openLightbox(url, type) {
  if (!url) return;

  const img = document.getElementById("lightboxImage");
  const video = document.getElementById("lightboxVideo");

  if (type === "image") {
    img.src = url;
    img.style.display = "block";
    video.style.display = "none";
  } else if (type === "video") {
    video.src = url;
    video.style.display = "block";
    img.style.display = "none";
  }

  lightbox.classList.add("show");
}

function closeLightbox() {
  lightbox.classList.remove("show");
  document.getElementById("lightboxImage").src = "";
  document.getElementById("lightboxVideo").src = "";
}

// Toast Notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === "success" ? "#10B981" : "#EF4444"};
        color: white;
        border: 4px solid #1F2937;
        box-shadow: 6px 6px 0 #1F2937;
        font-weight: 900;
        text-transform: uppercase;
        font-size: 14px;
        z-index: 10000;
        max-width: 300px;
    `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Close modals on outside click
addPostsModal.addEventListener("click", (e) => {
  if (e.target === addPostsModal) closeAddPostsModal();
});

viewPostsModal.addEventListener("click", (e) => {
  if (e.target === viewPostsModal) closeViewPostsModal();
});

editTimeModal.addEventListener("click", (e) => {
  if (e.target === editTimeModal) closeEditTimeModal();
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
