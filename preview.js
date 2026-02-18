// ==UserScript==
// @name         Jellyfin 10.11.5 - All-Seconds Config
// @version      13.0
// @match        https://jellyfin.sgriosnetwork.xyz/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- EVERYTHING HERE IS IN SECONDS ---
    const config = {
        startAtSecond: 0,      // Start 5 minutes in
        jumpEverySeconds: 1,    // How long to wait before hopping to a new scene
        jumpForwardSeconds: 60, // How many seconds to skip (10 minutes)
        hoverDelaySeconds: 0.4   // Delay before preview starts
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

    const play = (itemId, cardElement) => {
        createUI();
        const raw = localStorage.getItem("jellyfin_credentials");
        if (!raw || !staticRect) return;
        const token = JSON.parse(raw).Servers[0].AccessToken;

        currentCard = cardElement;
        currentCard.classList.add('force-no-transform');

        overlay.style.width = `${staticRect.width}px`;
        overlay.style.height = `${staticRect.height}px`;
        overlay.style.top = `${staticRect.top + window.scrollY}px`;
        overlay.style.left = `${staticRect.left + window.scrollX}px`;
        overlay.style.display = "block";

        // Internal conversion: Seconds to Ticks
        const startTimeTicks = config.startAtSecond * 10000000;
        video.src = `https://jellyfin.sgriosnetwork.xyz/Videos/${itemId}/stream?api_key=${token}&Static=true&StartTimeTicks=${startTimeTicks}`;

        video.play().then(() => {
            // Jump logic using seconds
            jumpTimer = setInterval(() => {
                video.currentTime += config.jumpForwardSeconds;
            }, config.jumpEverySeconds * 1000); // SetInterval needs milliseconds
        }).catch(() => {});
    };

    const stop = () => {
        clearTimeout(hoverTimeout);
        clearInterval(jumpTimer);
        if (currentCard) currentCard.classList.remove('force-no-transform');
        currentCard = null;
        staticRect = null;
        if (video) { video.pause(); video.src = ""; }
        if (overlay) overlay.style.display = "none";
    };

    document.addEventListener('mousemove', (e) => {
        if (!currentCard || !staticRect) return;
        const m = 10;
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
