// content.js - Runs inside Telegram Web

console.log("🛡️ AI Phishing Defender active on Telegram Web!");

// ======================================================================
// 1. URL SCANNER IN TELEGRAM
// ======================================================================
function scanTelegramLinks() {
    // Find all HTTP/HTTPS links that haven't been scanned yet
    const links = document.querySelectorAll('a[href^="http"]:not(.ai-scanned)');

    links.forEach(link => {
        link.classList.add('ai-scanned');

        // Skip empty links (links without any visible text)
        if (!link.innerText.trim()) return;

        // 🔥 Skip duplicate links hidden inside Telegram's large link preview boxes 
        // If the link contains an image or a div element, it's a preview box, not the main chat text.
        if (link.querySelector('img') ||
            link.querySelector('div') ||
            link.closest('.WebPage') ||
            link.closest('.web-page') ||
            link.closest('.LinkPreview') ||
            link.closest('.link-preview-wrapper') ||
            link.closest('.message-media') ||
            link.closest('.is-webpage')) {
            return;
        }

        const url = link.href;

        // Create a small, clean loading indicator next to the actual text link
        const tag = document.createElement('span');
        tag.className = 'ai-defender-tag ai-loading';
        tag.innerText = '⏳ Loading...';
        link.parentNode.insertBefore(tag, link.nextSibling);

        // Send the extracted URL to our background script for AI analysis
        chrome.runtime.sendMessage({ action: "check_url", url: url }, (response) => {
            // Handle extension errors or missing responses gracefully
            if (chrome.runtime.lastError || !response) {
                tag.style.display = 'none';
                return;
            }

            // Update the UI tag based on the AI Model's prediction
            if (response.status === "SAFE") {
                tag.className = 'ai-defender-tag ai-safe';
                tag.innerText = `✅ Safe`;
            } else if (response.status === "PHISHING") {
                tag.className = 'ai-defender-tag ai-phish';
                tag.innerText = `🚨 Phishing`;
                link.style.color = '#e74c3c'; // Turn the malicious link red
                link.style.textDecoration = 'line-through'; // Cross out the malicious link
            } else if (response.status === "LOADING") {
                // If the AI model is still warming up, keep the loading state
                tag.className = 'ai-defender-tag ai-loading';
                tag.innerText = `⏳ Loading...`;
                // Remove the tag after 2 seconds so the observer can rescan it automatically
                setTimeout(() => {
                    tag.remove();
                    link.classList.remove('ai-scanned');
                }, 2000);
            } else {
                tag.style.display = 'none';
            }
        });
    });
}

// ======================================================================
// 2. VOICE MESSAGE SCANNER IN TELEGRAM
// ======================================================================
function scanTelegramVoiceMessages() {
    // Locate audio elements or voice message containers in the chat DOM
    const voiceContainers = document.querySelectorAll('.audio, .voice-message, audio');

    voiceContainers.forEach(container => {
        // Prevent injecting multiple scan buttons into the same voice message
        if (container.classList.contains('ai-voice-scanned')) return;
        container.classList.add('ai-voice-scanned');

        // Create the custom AI Scan button
        const scanBtn = document.createElement('button');
        scanBtn.innerText = '🎤 AI Scan';
        scanBtn.className = 'ai-defender-tag';
        scanBtn.style.backgroundColor = '#e67e22';
        scanBtn.style.border = 'none';
        scanBtn.style.cursor = 'pointer';
        scanBtn.style.marginTop = '5px';

        // Insert the button just below the voice message UI
        container.parentNode.insertBefore(scanBtn, container.nextSibling);

        // Handle the user clicking the scan button
        scanBtn.addEventListener('click', (e) => {
            e.preventDefault();
            scanBtn.innerText = 'Listening (7s)...';
            scanBtn.style.backgroundColor = '#95a5a6';

            // Command background.js to trigger the Meyda.js hidden microphone recording
            chrome.runtime.sendMessage({ action: "start_voice_scan" });
        });
    });
}

// Listen for the final voice analysis results coming back from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "voice_result_ready") {
        // Find the specific button that is currently in the "Listening" state
        const activeBtns = document.querySelectorAll('.ai-defender-tag');
        activeBtns.forEach(btn => {
            if (btn.innerText.includes('Listening')) {
                // Update button UI based on AI prediction
                if (request.status === "SAFE") {
                    btn.innerText = `✅ Safe Voice`;
                    btn.style.backgroundColor = '#27ae60';
                } else if (request.status === "PHISHING") {
                    btn.innerText = `🚨 Phishing Scam!`;
                    btn.style.backgroundColor = '#e74c3c';
                }
            }
        });
    }
});

// ======================================================================
// 3. QR CODE IMAGE SCANNER IN TELEGRAM
// ======================================================================
function scanTelegramImagesForQR() {
    // Find all raw images in the chat that haven't been checked for QR codes yet
    const images = document.querySelectorAll('img:not(.ai-qr-scanned)');

    images.forEach(img => {
        img.classList.add('ai-qr-scanned');

        // Wait for the image to fully render in the browser before scanning
        img.onload = () => {
            chrome.runtime.sendMessage({
                action: "decode_and_check_qr",
                imageUrl: img.src
            }, (response) => {
                // If a malicious URL is found inside the QR code
                if (response && response.status === "PHISHING") {
                    img.style.border = "5px solid #e74c3c"; // Apply a red warning border
                    img.style.filter = "blur(5px)"; // Obscure the malicious QR code

                    // Inject a warning tag directly above the image
                    const warning = document.createElement('div');
                    warning.className = 'ai-defender-tag ai-phish';
                    warning.innerText = `🚨 Phishing QR!`;
                    img.parentNode.insertBefore(warning, img);
                }
            });
        };
    });
}

// ======================================================================
// 4. MASTER MUTATION OBSERVER (Performance Optimized)
// ======================================================================
// Instead of multiple observers, use a single master observer to monitor DOM changes
const masterObserver = new MutationObserver((mutations) => {
    // Use debouncing/throttling to prevent freezing the browser when scrolling fast
    clearTimeout(window.masterScanTimeout);
    window.masterScanTimeout = setTimeout(() => {
        scanTelegramLinks();
        scanTelegramVoiceMessages();
        scanTelegramImagesForQR();
    }, 500);
});

// Attach the observer to the main document body to watch for new incoming chat messages
masterObserver.observe(document.body, { childList: true, subtree: true });

// Run the initial scan immediately when the page loads
scanTelegramLinks();
scanTelegramVoiceMessages();
scanTelegramImagesForQR();