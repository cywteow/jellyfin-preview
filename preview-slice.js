// ==UserScript==
// @name         Jellyfin 10.11.5 - Perfect 10-Slice Preview
// @version      16.0
// @match        *://jellyfin.sgriosnetwork.xyz/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        totalSlices: 10,         // Exactly 10 snapshots
        playTimePerSlice: 1.0,   // Each snapshot lasts 1 second
        hoverDelaySeconds: 0.4
    };

    let hoverTimeout = null;
    let jumpTimer = null;
    let overlay, video;
    let currentCard = null;
    let staticRect = null;

    const style = document.createElement('style');
    style.innerHTML = `.force-no-transform { transform: none !important; transition: none !important; }`;
    document.head.appendChild(style);

    const createUI = () => {
        if (overlay) return;
        overlay = document.createElement("div");
        overlay.style.cssText = "position:absolute; pointer-events:none; background:black; z-index:10000; display:none; border-radius:4px; overflow:hidden; border: 1px solid #00a4dc;";
        video = document.createElement("video");
        video.muted = true;
        video.style.cssText = "width:100%; height:100%; object-fit:cover;";
        overlay.appendChild(video);
        document.body.appendChild(overlay);
    };

    const getAuth = () => {
        const raw = localStorage.getItem("jellyfin_credentials");
        if (!raw) return null;
        const data = JSON.parse(raw);
        return {
            token: data.Servers[0].AccessToken,
            userId: data.Servers[0].UserId
        };
    };

    const play = async (itemId, cardElement) => {
        createUI();
        const auth = getAuth();
        if (!auth || !staticRect) return;

        currentCard = cardElement;
        currentCard.classList.add('force-no-transform');

        const itemUrl = `https://jellyfin.sgriosnetwork.xyz/Users/${auth.userId}/Items/${itemId}`;
        try {
            const response = await fetch(itemUrl, { headers: { 'X-Emby-Token': auth.token } });
            const itemData = await response.json();

            // Get total duration and calculate exact jump gap
            const totalRuntimeTicks = itemData.RunTimeTicks || 0;
            const totalSeconds = totalRuntimeTicks / 10000000;
            const jumpGapSeconds = totalSeconds / config.totalSlices;

            overlay.style.width = `${staticRect.width}px`;
            overlay.style.height = `${staticRect.height}px`;
            overlay.style.top = `${staticRect.top + window.scrollY}px`;
            overlay.style.left = `${staticRect.left + window.scrollX}px`;
            overlay.style.display = "block";

            // START FROM 0 (The absolute beginning)
            video.src = `https://jellyfin.sgriosnetwork.xyz/Videos/${itemId}/stream?api_key=${auth.token}&Static=true&StartTimeTicks=0`;

            video.play().then(() => {
                let currentSlice = 0;
                jumpTimer = setInterval(() => {
                    currentSlice++;
                    if (currentSlice < config.totalSlices) {
                        // Move to the next slice: (1st jump = 10% in, 2nd = 20% in, etc.)
                        video.currentTime = currentSlice * jumpGapSeconds;
                    } else {
                        // Optional: Reset to 0 if they keep hovering after 10 seconds
                        video.currentTime = 0;
                        currentSlice = 0;
                    }
                }, config.playTimePerSlice * 1000);
            });

        } catch (e) {
            console.error("Failed to fetch movie duration", e);
        }
    };

    const stop = () => {
        clearTimeout(hoverTimeout);
        if (jumpTimer) clearInterval(jumpTimer);
        if (currentCard) currentCard.classList.remove('force-no-transform');
        currentCard = null;
        staticRect = null;
        if (video) { video.pause(); video.src = ""; }
        if (overlay) overlay.style.display = "none";
    };

    document.addEventListener('mousemove', (e) => {
        if (!currentCard || !staticRect) return;
        const m = 15;
        const x = e.clientX, y = e.clientY;
        if (x < staticRect.left - m || x > staticRect.right + m || y < staticRect.top - m || y > staticRect.bottom + m) {
            stop();
        }
    });

    setInterval(() => {
        document.querySelectorAll('.card, .cardContent, .cardImageContainer').forEach(card => {
            if (card.closest('.cardOverlayButton') || card.closest('.cardOverlayFab')) return;
            if (card.dataset.hooked) return;
            const id = card.getAttribute('data-id') || card.closest('[data-id]')?.getAttribute('data-id');
            if (!id) return;
            card.dataset.hooked = "true";
            card.addEventListener("mouseenter", (e) => {
                if (e.target.closest('.cardOverlayButton, .btnMarkRead, .btnPlay')) return;
                if (currentCard) stop();
                staticRect = card.getBoundingClientRect();
                hoverTimeout = setTimeout(() => play(id, card), config.hoverDelaySeconds * 1000);
            });
        });
    }, 1000);
})();
