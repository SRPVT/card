const userID = "887557388700368896";

const elements = {
	statusBox: document.querySelector(".status"),
	statusImage: document.getElementById("status-image"),
	displayName: document.querySelector(".display-name"),
	username: document.querySelector(".username"),
	customStatus: document.querySelector(".custom-status"),
	customStatusText: document.querySelector(".custom-status-text"),
	customStatusEmoji: document.getElementById("custom-status-emoji"),
	// Rich Presence Elements
	richActivity: document.getElementById("rich-activity"),
	activityHeader: document.querySelector(".activity-header"),
	activityLargeImage: document.getElementById("activity-large-image"),
	activitySmallImage: document.getElementById("activity-small-image"),
	activityName: document.getElementById("activity-name"),
	activityDetails: document.getElementById("activity-details"),
	activityState: document.getElementById("activity-state"),
	activityTimestamp: document.getElementById("activity-timestamp"),
};

/* ===============================
   WEBSOCKET & STATUS LOGIC
   =============================== */
function startWebSocket() {
	const ws = new WebSocket("wss://api.lanyard.rest/socket");
	ws.onopen = () => {
		ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userID } }));
	};
	ws.onmessage = (event) => {
		const { t, d } = JSON.parse(event.data);
		if (t === "INIT_STATE" || t === "PRESENCE_UPDATE") {
			updateStatus(d);
		}
	};
	ws.onerror = (error) => {
		console.error("Lanyard Error:", error);
		ws.close();
	};
	ws.onclose = () => {
		setTimeout(startWebSocket, 1000);
	};
}

// Initial Fetch for faster update
fetch(`https://api.lanyard.rest/v1/users/${userID}`)
	.then(res => res.json())
	.then(response => {
		if (response.success && response.data) {
			updateStatus(response.data);
		}
	});

function updateStatus(lanyardData) {
	const { discord_status, activities, discord_user } = lanyardData;

	// -- USER INFO --
	elements.displayName.innerHTML = discord_user.display_name;
	elements.username.innerHTML = discord_user.username;

	// -- STATUS ICON --
	let imagePath = "./public/status/offline.svg";
	let label = "Offline";

	// Simple status map
	const statusMap = {
		online: { path: "./public/status/online.svg", label: "Online" },
		idle: { path: "./public/status/idle.svg", label: "Idle" },
		dnd: { path: "./public/status/dnd.svg", label: "Do Not Disturb" },
		offline: { path: "./public/status/offline.svg", label: "Offline" },
	};

	if (statusMap[discord_status]) {
		imagePath = statusMap[discord_status].path;
		label = statusMap[discord_status].label;
	}

	// Check streaming
	const isStreaming = activities.some(
		(a) => a.type === 1 && (a.url.includes("twitch.tv") || a.url.includes("youtube.com"))
	);
	if (isStreaming) {
		imagePath = "./public/status/streaming.svg";
		label = "Streaming";
	}

	elements.statusImage.src = imagePath;
	elements.statusBox.setAttribute("aria-label", label);

	// -- CUSTOM STATUS (The text under name) --
	const custom = activities.find((a) => a.type === 4);
	if (custom) {
		elements.customStatus.style.display = "flex";
		elements.customStatusText.innerHTML = custom.state || "";

		if (custom.emoji?.id) {
			elements.customStatusEmoji.src = `https://cdn.discordapp.com/emojis/${custom.emoji.id}.webp?size=24&quality=lossless`;
			elements.customStatusEmoji.style.display = "block";
		} else if (custom.emoji?.name) {
			// For standard unicode emojis, Lanyard returns simply the char. 
			// We can't set .src to a char. WE need to change tag to span or handle emoji parsing.
			// For now, simpler: if it's not a custom emoji ID, try to hide or use a placeholder.
			// Or modify HTML to use text content for standard emojis. 
			// Assuming existing code logic was okay with images, I'll stick to hiding if no ID for now to avoid breaking layout.
			elements.customStatusEmoji.style.display = "none";
		} else {
			elements.customStatusEmoji.style.display = "none";
		}
	} else {
		elements.customStatus.style.display = "none";
	}

	// -- RICH PRESENCE (Spotify or Game) --
	// Find generic activity (type 0) or Spotify (id 'spotify:1')
	// We prioritizing showing the GAME if mostly playing, but if only spotify, show that.
	// Actually discord shows Game over Spotify usually.
	const richActivity = activities.find((a) => a.type === 0) || activities.find((a) => a.id === "spotify:1");

	if (richActivity) {
		elements.richActivity.style.display = "flex";

		// Clear any existing interval to prevent overlapping timers
		if (window.activityInterval) clearInterval(window.activityInterval);
		elements.activityTimestamp.innerText = "";
		elements.activityTimestamp.style.display = "none";

		// Spotify Special Handling
		if (richActivity.id === "spotify:1") {
			elements.activityHeader.innerText = "LISTENING TO SPOTIFY";
			elements.activityName.innerText = richActivity.details; // Song Title
			elements.activityDetails.innerText = "by " + richActivity.state; // Artist
			elements.activityState.innerText = "on " + richActivity.assets.large_text; // Album

			if (richActivity.assets?.large_image) {
				elements.activityLargeImage.src = `https://i.scdn.co/image/${richActivity.assets.large_image.replace("spotify:", "")}`;
			} else {
				elements.activityLargeImage.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png";
			}
			elements.activitySmallImage.style.display = "none"; // Spotify usually doesn't have a small overlay icon here

			// Spotify Timeline (Progress) - Lanyard provides timestamps.start and timestamps.end
			if (richActivity.timestamps && richActivity.timestamps.end) {
				const start = richActivity.timestamps.start;
				const end = richActivity.timestamps.end;

				elements.activityTimestamp.style.display = "block";

				// Update every second
				window.activityInterval = setInterval(() => {
					const now = Date.now();
					const total = end - start;
					const current = now - start;

					// Simple elapsed time format: 04:20 / 05:00
					const currStr = formatTime(current);
					const totalStr = formatTime(total);
					elements.activityTimestamp.innerText = `${currStr} / ${totalStr}`;

					// If song over, it usually updates via websocket, but we can stop here safely
					if (current >= total) clearInterval(window.activityInterval);
				}, 1000);
				// Run once immediately
				const now = Date.now();
				const total = end - start;
				const current = now - start;
				elements.activityTimestamp.innerText = `${formatTime(current)} / ${formatTime(total)}`;
			}

		}
		// Standard Game/App Handling
		else {
			elements.activityHeader.innerText = "PLAYING A GAME";
			elements.activityName.innerText = richActivity.name;
			elements.activityDetails.innerText = richActivity.details || "";
			elements.activityState.innerText = richActivity.state || "";

			// Images
			let largeImageSet = false;
			if (richActivity.assets?.large_image) {
				let largeImageId = richActivity.assets.large_image;
				if (largeImageId.startsWith("mp:external")) {
					// Handle external images
					elements.activityLargeImage.src = largeImageId.replace(/mp:external\/([^\/]*)\/(https?)\/([^\/]*)/, '$2://$3');
					largeImageSet = true;
				} else {
					// Discord App Assets
					elements.activityLargeImage.src = `https://cdn.discordapp.com/app-assets/${richActivity.application_id}/${largeImageId}.png`;
					largeImageSet = true;
				}
			}

			// Fallback if no image set
			if (!largeImageSet) {
				// Use the local icon we just downloaded
				elements.activityLargeImage.src = "./public/unknown.png";
				elements.activityLargeImage.onerror = () => {
					elements.activityLargeImage.src = "https://cdn.discordapp.com/embed/avatars/0.png"; // Ultimate fallback
				};
			}

			if (richActivity.assets?.small_image) {
				elements.activitySmallImage.style.display = "block";
				elements.activitySmallImage.src = `https://cdn.discordapp.com/app-assets/${richActivity.application_id}/${richActivity.assets.small_image}.png`;
			} else {
				elements.activitySmallImage.style.display = "none";
			}

			// Game Timer (Elapsed)
			if (richActivity.timestamps && richActivity.timestamps.start) {
				elements.activityTimestamp.style.display = "block";
				const start = richActivity.timestamps.start;

				const updateGameTimer = () => {
					const now = Date.now();
					const elapsed = now - start;
					// Add the Gamepad icon from FontAwesome
					elements.activityTimestamp.innerHTML = `<i class="fas fa-gamepad" style="margin-right: 5px;"></i> ${formatTime(elapsed)} elapsed`;
				};

				window.activityInterval = setInterval(updateGameTimer, 1000);
				updateGameTimer(); // Run once immediately
			}
		}
	} else {
		elements.richActivity.style.display = "none";
		if (window.activityInterval) clearInterval(window.activityInterval);
	}
}

function formatTime(ms) {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / 1000 / 60) % 60);
	const hours = Math.floor(ms / 1000 / 60 / 60);

	const s = seconds.toString().padStart(2, "0");
	const m = minutes.toString().padStart(2, "0");

	if (hours > 0) {
		return `${hours}:${m}:${s}`;
	} else {
		return `${m}:${s}`;
	}
}

startWebSocket();

/* ===============================
   CONTEXT MENU LOGIC
   =============================== */
const contextMenu = document.getElementById("context-menu");
const scope = document.querySelector("body");

scope.addEventListener("contextmenu", (e) => {
	// Double check loader state
	const loader = document.getElementById("loader");
	if (document.readyState !== 'complete' || (loader && !loader.classList.contains("fade-out"))) {
		e.preventDefault();
		return; // Do not show menu
	}

	e.preventDefault();

	// Position the menu
	const { clientX: mouseX, clientY: mouseY } = e;

	contextMenu.style.top = `${mouseY}px`;
	contextMenu.style.left = `${mouseX}px`;

	contextMenu.style.display = "block";

	// Add a slight animation class if you wanted
});

scope.addEventListener("click", (e) => {
	if (e.target.offsetParent !== contextMenu) {
		contextMenu.style.display = "none";
	}
});

/* ===============================
   HELPER FUNCTIONS
   =============================== */
function viewSource() {
	window.open("https://dscbmr.is-a.dev/source.html", "_blank");
}

function copyUserID() {
	navigator.clipboard.writeText(userID).then(() => {
		discordAlert("User ID copied to clipboard!");
	});
}

function discordAlert(msg) {
	const overlay = document.getElementById("discord-alert");
	const msgBox = document.getElementById("discord-alert-msg");
	msgBox.innerText = msg;
	overlay.style.display = "flex";
}

function closeDiscordAlert() {
	document.getElementById("discord-alert").style.display = "none";
}

// Close alert on click outside
document.getElementById("discord-alert").addEventListener("click", (e) => {
	if (e.target.id === "discord-alert") {
		closeDiscordAlert();
	}
});

/* ===============================
   CUSTOM RICH TOOLTIP LOGIC
   =============================== */
const tooltip = document.getElementById("custom-tooltip");
const tooltipIcon = document.getElementById("tooltip-icon");
const tooltipHeader = document.getElementById("tooltip-header");
const tooltipName = document.getElementById("tooltip-name");

document.querySelectorAll(".tooltip").forEach((el) => {
	el.addEventListener("mouseenter", () => {
		const header = el.getAttribute("data-header");
		const name = el.getAttribute("data-name");
		// Use the image inside the badge as the icon
		const img = el.querySelector("img");

		if (header && name && img) {
			tooltipHeader.innerText = header;
			tooltipName.innerText = name;
			tooltipIcon.src = img.src;
			tooltip.style.display = "flex";
		}
	});

	el.addEventListener("mousemove", (e) => {
		// Position above the cursor
		const x = e.clientX;
		const y = e.clientY;

		tooltip.style.left = `${x}px`;
		tooltip.style.top = `${y - 10}px`; // 10px above cursor
	});

	el.addEventListener("mouseleave", () => {
		tooltip.style.display = "none";
	});
});

/* ===============================
   PREVENT RIGHT CLICK ON LOAD
   =============================== */
// Ensure context menu logic respects loading state
document.addEventListener('contextmenu', event => {
	// Check if loader is still active
	const loader = document.getElementById("loader");
	if (document.readyState !== 'complete' || (loader && !loader.classList.contains("fade-out"))) {
		event.preventDefault();
		event.stopImmediatePropagation(); // Stronger stop
	}
});

/* ===============================
   LOADER LOGIC
   =============================== */
window.addEventListener('load', () => {
	setTimeout(() => {
		const loader = document.getElementById('loader');
		if (loader) {
			loader.classList.add('fade-out');
			document.body.style.overflow = 'auto'; // Re-enable scrolling
		}
	}, 3500); // 3.5s delay for the "premium" feel
});


/* ===============================
   PROFILE EFFECT LOGIC (Intro -> Loop)
   =============================== */
window.addEventListener('load', () => {
	// Timings
	const introDuration = 6900; // Adjusted: slightly shorter to catch the end of intro
	const fadeDuration = 400;   // Fast smooth fade

	const intro = document.getElementById("effect-intro");
	const loop = document.getElementById("effect-loop");

	if (intro && loop) {
		// Initialize state
		intro.style.opacity = "1";
		loop.style.opacity = "0";
		loop.style.display = "block";

		// Start the transition sequence
		setTimeout(() => {
			// Fade OUT Intro
			intro.style.opacity = "0";

			// Fade IN Loop
			loop.style.opacity = "1";

			// Cleanup
			setTimeout(() => {
				intro.style.display = "none";
			}, fadeDuration);

		}, introDuration - fadeDuration);
	}
});
