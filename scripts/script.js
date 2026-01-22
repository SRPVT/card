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
	const richActivity = activities.find((a) => a.type === 0 || a.id === "spotify:1");

	if (richActivity) {
		elements.richActivity.style.display = "flex";

		// Spotify Special Handling
		if (richActivity.id === "spotify:1") {
			elements.activityHeader.innerText = "LISTENING TO SPOTIFY";
			elements.activityName.innerText = richActivity.details; // Song Title
			elements.activityDetails.innerText = "by " + richActivity.state; // Artist
			elements.activityState.innerText = "on " + richActivity.assets.large_text; // Album

			if (richActivity.assets?.large_image) {
				elements.activityLargeImage.src = `https://i.scdn.co/image/${richActivity.assets.large_image.replace("spotify:", "")}`;
			}
			elements.activitySmallImage.style.display = "none"; // Spotify usually doesn't have a small overlay icon here
		}
		// Standard Game/App Handling
		else {
			elements.activityHeader.innerText = "PLAYING A GAME";
			elements.activityName.innerText = richActivity.name;
			elements.activityDetails.innerText = richActivity.details || "";
			elements.activityState.innerText = richActivity.state || "";

			// Images
			if (richActivity.assets?.large_image) {
				let largeImageId = richActivity.assets.large_image;
				if (largeImageId.startsWith("mp:external")) {
					// Handle external images
					elements.activityLargeImage.src = largeImageId.replace(/mp:external\/([^\/]*)\/(https?)\/([^\/]*)/, '$2://$3');
				} else {
					// Discord App Assets
					elements.activityLargeImage.src = `https://cdn.discordapp.com/app-assets/${richActivity.application_id}/${largeImageId}.png`;
				}
			} else {
				// Fallback if no large image
				elements.activityLargeImage.src = `https://dcdn.dstn.to/app-icons/${richActivity.application_id}`;
			}

			if (richActivity.assets?.small_image) {
				elements.activitySmallImage.style.display = "block";
				elements.activitySmallImage.src = `https://cdn.discordapp.com/app-assets/${richActivity.application_id}/${richActivity.assets.small_image}.png`;
			} else {
				elements.activitySmallImage.style.display = "none";
			}
		}
	} else {
		elements.richActivity.style.display = "none";
	}
}

startWebSocket();

/* ===============================
   CONTEXT MENU LOGIC
   =============================== */
const contextMenu = document.getElementById("context-menu");
const scope = document.querySelector("body");

scope.addEventListener("contextmenu", (e) => {
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
	window.open("https://github.com/SRPVT/card-6", "_blank");
}

function copyUserID() {
	navigator.clipboard.writeText(userID).then(() => {
		alert("User ID copied to clipboard!");
	});
}
