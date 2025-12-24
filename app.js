document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('box-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    
    if (!app || !canvas || !ctx) {
        console.error('Required elements not found');
        return;
    }

    const layoutHost = canvas.parentElement || document.querySelector('.container');

    // Breathing patterns configuration
    const PATTERNS = {
        box: {
            name: 'Box Breathing',
            description: 'Equal phases for balance',
            phases: [
                { name: 'Inhale', duration: 4 },
                { name: 'Hold', duration: 4 },
                { name: 'Exhale', duration: 4 },
                { name: 'Wait', duration: 4 }
            ]
        },
        relaxing: {
            name: '4-7-8 Relaxing',
            description: 'Calming breath for sleep',
            phases: [
                { name: 'Inhale', duration: 4 },
                { name: 'Hold', duration: 7 },
                { name: 'Exhale', duration: 8 },
                { name: 'Wait', duration: 0 }
            ]
        },
        energizing: {
            name: 'Energizing',
            description: 'Quick energizing breath',
            phases: [
                { name: 'Inhale', duration: 4 },
                { name: 'Hold', duration: 2 },
                { name: 'Exhale', duration: 4 },
                { name: 'Wait', duration: 0 }
            ]
        },
        calming: {
            name: 'Calming',
            description: 'Extended exhale for calm',
            phases: [
                { name: 'Inhale', duration: 4 },
                { name: 'Hold', duration: 4 },
                { name: 'Exhale', duration: 6 },
                { name: 'Wait', duration: 2 }
            ]
        }
    };

    const PHASE_COLORS = ['#f97316', '#fbbf24', '#38bdf8', '#22c55e'];
    const PHASE_FREQUENCIES = [396, 528, 639, 741]; // Solfeggio-inspired frequencies

    // State management
    const state = {
        // Session state
        isPlaying: false,
        isPaused: false,
        isStartingCountdown: false,
        startingCountdown: 3,
        currentPhase: 0,
        phaseCountdown: 0,
        totalTime: 0,
        cycleCount: 0,
        
        // Settings
        soundEnabled: true,
        hapticEnabled: true,
        timeLimit: '',
        selectedPattern: 'box',
        phaseMultiplier: 1,
        
        // Completion state
        sessionComplete: false,
        timeLimitReached: false,
        
        // Animation state
        pulseStartTime: null,
        lastCountdownValue: null,
        
        // Canvas state
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        viewportWidth: layoutHost?.clientWidth || window.innerWidth,
        viewportHeight: layoutHost?.clientHeight || window.innerHeight,
        prefersReducedMotion: false,
        
        // Stats
        stats: loadStats()
    };

    // Audio setup
    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    // Wake Lock
    let wakeLock = null;

    // Timers
    let mainInterval = null;
    let animationFrameId = null;
    let lastStateUpdate = 0;

    // Gradient cache
    let cachedGradient = null;
    let cachedGradientKey = '';

    // Icons
    const icons = {
        play: `<svg class="icon icon-large" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg class="icon icon-large" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
        stop: `<svg class="icon icon-large" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`,
        volume2: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
        volumeX: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
        vibrate: `<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line></svg>`,
        rotateCcw: `<svg class="icon icon-large" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        clock: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        flame: `<svg class="icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
        award: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`
    };

    // Utility functions
    function loadStats() {
        try {
            const saved = localStorage.getItem('boxBreathingStats');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading stats:', e);
        }
        return {
            totalSessions: 0,
            totalMinutes: 0,
            totalCycles: 0,
            currentStreak: 0,
            lastSessionDate: null,
            longestStreak: 0
        };
    }

    function saveStats() {
        try {
            localStorage.setItem('boxBreathingStats', JSON.stringify(state.stats));
        } catch (e) {
            console.error('Error saving stats:', e);
        }
    }

    function updateStreak() {
        const today = new Date().toDateString();
        const lastDate = state.stats.lastSessionDate;
        
        if (!lastDate) {
            state.stats.currentStreak = 1;
        } else if (lastDate === today) {
            // Same day, don't update streak
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toDateString()) {
                state.stats.currentStreak++;
            } else {
                state.stats.currentStreak = 1;
            }
        }
        
        state.stats.lastSessionDate = today;
        state.stats.longestStreak = Math.max(state.stats.longestStreak, state.stats.currentStreak);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function getPattern() {
        return PATTERNS[state.selectedPattern];
    }

    function getCurrentPhase() {
        const pattern = getPattern();
        return pattern.phases[state.currentPhase];
    }

    function getScaledPhaseDuration(phaseIndex) {
        const pattern = getPattern();
        const baseDuration = pattern.phases[phaseIndex].duration;
        return Math.round(baseDuration * state.phaseMultiplier);
    }

    function getTotalCycleDuration() {
        const pattern = getPattern();
        return pattern.phases.reduce((sum, phase) => sum + Math.round(phase.duration * state.phaseMultiplier), 0);
    }

    function hexToRgba(hex, alpha) {
        const normalized = hex.replace('#', '');
        const bigint = parseInt(normalized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function invalidateGradient() {
        cachedGradient = null;
        cachedGradientKey = '';
    }

    // Audio functions
    function playTone(phaseIndex = 0) {
        if (!state.soundEnabled) return;

        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(PHASE_FREQUENCIES[phaseIndex] || 440, ctx.currentTime);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.2);
        } catch (e) {
            console.error('Error playing tone:', e);
        }
    }

    // Haptic functions
    function vibrate(pattern = [50]) {
        if (!state.hapticEnabled) return;
        
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                console.error('Vibration error:', e);
            }
        }
    }

    function vibratePhaseChange() {
        vibrate([30, 50, 30]);
    }

    function vibrateSessionComplete() {
        vibrate([100, 50, 100, 50, 100]);
    }

    // Wake Lock functions
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
                console.log('Wake Lock active');
            } catch (err) {
                console.error('Wake Lock error:', err);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release().catch(console.error);
            wakeLock = null;
        }
    }

    // Re-acquire wake lock if visibility changes
    document.addEventListener('visibilitychange', async () => {
        if (state.isPlaying && document.visibilityState === 'visible') {
            await requestWakeLock();
        }
    });

    // Canvas functions
    function resizeCanvas() {
        const rect = layoutHost.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        state.viewportWidth = width;
        state.viewportHeight = height;
        state.devicePixelRatio = pixelRatio;

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);

        if (ctx) {
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }

        invalidateGradient();

        if (!state.isPlaying && !state.isStartingCountdown) {
            drawScene({ progress: state.sessionComplete ? 1 : 0, showTrail: false });
        }
    }

    function drawScene({ 
        progress = 0, 
        phase = state.currentPhase, 
        showTrail = state.isPlaying, 
        timestamp = performance.now() 
    } = {}) {
        if (!ctx) return;

        const width = state.viewportWidth;
        const height = state.viewportHeight;
        
        if (!width || !height) return;

        const scale = state.devicePixelRatio;
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (!state.isPlaying && !state.sessionComplete && !state.isStartingCountdown) {
            ctx.restore();
            return;
        }

        const clampedProgress = Math.max(0, Math.min(1, progress));
        const easedProgress = 0.5 - (Math.cos(Math.PI * clampedProgress) / 2);
        
        const baseSize = Math.min(width, height) * 0.55;
        const margin = 30;
        const sizeWithoutBreath = Math.min(baseSize, Math.min(width, height) - margin * 2);
        
        const verticalOffset = Math.min(height * 0.12, 80);
        const centerY = height / 2 + verticalOffset;
        const centerX = width / 2;
        
        const top = centerY - sizeWithoutBreath / 2;
        const left = centerX - sizeWithoutBreath / 2;

        const now = timestamp;
        const allowMotion = !state.prefersReducedMotion;
        
        // Breathing influence on size
        let breathInfluence = 0;
        const currentPhaseObj = getCurrentPhase();
        if (currentPhaseObj.name === 'Inhale') {
            breathInfluence = easedProgress;
        } else if (currentPhaseObj.name === 'Exhale') {
            breathInfluence = 1 - easedProgress;
        } else if (currentPhaseObj.name === 'Hold') {
            breathInfluence = allowMotion ? 1 + 0.02 * Math.sin(now / 300) : 1;
        } else {
            breathInfluence = allowMotion ? 0.02 * Math.sin(now / 300) : 0;
        }

        // Pulse effect on phase change
        let pulseBoost = 0;
        if (allowMotion && state.pulseStartTime !== null) {
            const pulseElapsed = (now - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.4) {
                pulseBoost = Math.sin((pulseElapsed / 0.4) * Math.PI) * 0.5;
            }
        }

        const size = sizeWithoutBreath * (1 + 0.1 * breathInfluence + 0.02 * pulseBoost);
        const adjustedLeft = left + (sizeWithoutBreath - size) / 2;
        const adjustedTop = top + (sizeWithoutBreath - size) / 2;
        
        // Box corner points (starting from bottom-left, going counter-clockwise)
        const points = [
            { x: adjustedLeft, y: adjustedTop + size },           // 0: bottom-left (Inhale start)
            { x: adjustedLeft, y: adjustedTop },                   // 1: top-left (Hold start)
            { x: adjustedLeft + size, y: adjustedTop },            // 2: top-right (Exhale start)
            { x: adjustedLeft + size, y: adjustedTop + size }      // 3: bottom-right (Wait start)
        ];

        // Current position on the path
        const startPoint = points[phase];
        const endPoint = points[(phase + 1) % 4];
        const currentX = startPoint.x + easedProgress * (endPoint.x - startPoint.x);
        const currentY = startPoint.y + easedProgress * (endPoint.y - startPoint.y);

        const accentColor = PHASE_COLORS[phase];

        // Gradient background
        const gradientKey = `${Math.round(size * 100)}-${accentColor}-${Math.round(adjustedLeft)}-${Math.round(adjustedTop)}`;
        if (!cachedGradient || cachedGradientKey !== gradientKey) {
            cachedGradient = ctx.createRadialGradient(
                adjustedLeft + size / 2,
                adjustedTop + size / 2,
                size * 0.1,
                adjustedLeft + size / 2,
                adjustedTop + size / 2,
                size * 0.9
            );
            cachedGradient.addColorStop(0, hexToRgba(accentColor, 0.15));
            cachedGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            cachedGradientKey = gradientKey;
        }
        ctx.fillStyle = cachedGradient;
        ctx.fillRect(0, 0, width, height);

        // Draw base box
        ctx.strokeStyle = hexToRgba('#fde68a', 0.15);
        ctx.lineWidth = Math.max(2, size * 0.01);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 4; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw progress trail
        if (showTrail || state.sessionComplete) {
            ctx.lineWidth = Math.max(3, size * 0.025);
            ctx.strokeStyle = hexToRgba(accentColor, 0.9);
            
            if (allowMotion) {
                ctx.shadowColor = hexToRgba(accentColor, 0.6);
                ctx.shadowBlur = 12;
            }
            
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            
            // Draw completed sides
            for (let i = 1; i <= phase; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            
            // Draw current progress
            if (!state.sessionComplete) {
                ctx.lineTo(currentX, currentY);
            } else {
                // Complete the box for session complete
                ctx.closePath();
            }
            
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Draw corner indicators
        const cornerRadius = Math.max(4, size * 0.02);
        points.forEach((point, i) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, cornerRadius, 0, Math.PI * 2);
            ctx.fillStyle = i <= phase ? hexToRgba(PHASE_COLORS[i], 0.8) : hexToRgba('#fde68a', 0.3);
            ctx.fill();
        });

        // Draw current position indicator
        if (showTrail && !state.sessionComplete) {
            const baseRadius = Math.max(8, size * 0.04);
            let radius = baseRadius * (1 + 0.3 * breathInfluence + 0.15 * pulseBoost);
            
            // Glow
            ctx.beginPath();
            ctx.arc(currentX, currentY, radius * 2, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(accentColor, 0.2);
            ctx.fill();

            // Main dot
            ctx.beginPath();
            ctx.arc(currentX, currentY, radius, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.fill();

            // Inner highlight
            ctx.beginPath();
            ctx.arc(currentX - radius * 0.2, currentY - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }

        ctx.restore();
    }

    function updateCanvasVisibility() {
        const shouldShow = state.isPlaying || state.sessionComplete || state.isStartingCountdown;
        canvas.classList.toggle('is-visible', shouldShow);
    }

    // Animation loop
    function animate() {
        if (!state.isPlaying) return;

        const now = performance.now();
        const elapsed = (now - lastStateUpdate) / 1000;
        const phaseDuration = getScaledPhaseDuration(state.currentPhase);
        const effectiveCountdown = state.phaseCountdown - elapsed;
        
        let progress = 0;
        if (phaseDuration > 0) {
            progress = (phaseDuration - effectiveCountdown) / phaseDuration;
        }
        progress = Math.max(0, Math.min(1, progress));

        drawScene({ progress, timestamp: now });
        animationFrameId = requestAnimationFrame(animate);
    }

    // Session control functions
    function startCountdown() {
        state.isStartingCountdown = true;
        state.startingCountdown = 3;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        
        updateCanvasVisibility();
        render();

        const countdownInterval = setInterval(() => {
            state.startingCountdown--;
            
            if (state.startingCountdown > 0) {
                playTone(0);
                vibrate([30]);
                render();
            } else {
                clearInterval(countdownInterval);
                state.isStartingCountdown = false;
                startSession();
            }
        }, 1000);

        playTone(0);
        vibrate([30]);
    }

    function startSession() {
        state.isPlaying = true;
        state.isPaused = false;
        state.currentPhase = 0;
        state.phaseCountdown = getScaledPhaseDuration(0);
        state.totalTime = 0;
        state.cycleCount = 0;
        state.pulseStartTime = performance.now();
        lastStateUpdate = performance.now();

        playTone(0);
        vibratePhaseChange();
        
        requestWakeLock();
        startMainInterval();
        animate();
        render();
    }

    function pauseSession() {
        if (!state.isPlaying) return;
        
        state.isPaused = true;
        state.isPlaying = false;
        
        clearInterval(mainInterval);
        cancelAnimationFrame(animationFrameId);
        releaseWakeLock();
        
        render();
    }

    function resumeSession() {
        if (!state.isPaused) return;
        
        state.isPaused = false;
        state.isPlaying = true;
        state.pulseStartTime = performance.now();
        lastStateUpdate = performance.now();
        
        requestWakeLock();
        startMainInterval();
        animate();
        render();
    }

    function stopSession() {
        state.isPlaying = false;
        state.isPaused = false;
        state.isStartingCountdown = false;
        
        clearInterval(mainInterval);
        cancelAnimationFrame(animationFrameId);
        releaseWakeLock();
        
        // Reset but don't clear time limit
        state.currentPhase = 0;
        state.phaseCountdown = getScaledPhaseDuration(0);
        state.totalTime = 0;
        state.cycleCount = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        state.pulseStartTime = null;
        
        invalidateGradient();
        updateCanvasVisibility();
        drawScene({ progress: 0, showTrail: false });
        render();
    }

    function completeSession() {
        state.isPlaying = false;
        state.sessionComplete = true;
        
        clearInterval(mainInterval);
        cancelAnimationFrame(animationFrameId);
        releaseWakeLock();
        
        // Update stats
        state.stats.totalSessions++;
        state.stats.totalMinutes += Math.round(state.totalTime / 60);
        state.stats.totalCycles += state.cycleCount;
        updateStreak();
        saveStats();
        
        vibrateSessionComplete();
        playTone(3);
        
        invalidateGradient();
        drawScene({ progress: 1, showTrail: true });
        render();
    }

    function startMainInterval() {
        clearInterval(mainInterval);
        lastStateUpdate = performance.now();

        mainInterval = setInterval(() => {
            state.totalTime++;
            
            // Check time limit
            if (state.timeLimit && !state.timeLimitReached) {
                const limitSeconds = parseInt(state.timeLimit) * 60;
                if (state.totalTime >= limitSeconds) {
                    state.timeLimitReached = true;
                }
            }

            // Phase countdown
            if (state.phaseCountdown <= 1) {
                // Advance to next phase
                const previousPhase = state.currentPhase;
                state.currentPhase = (state.currentPhase + 1) % 4;
                state.phaseCountdown = getScaledPhaseDuration(state.currentPhase);
                state.pulseStartTime = performance.now();
                
                // Cycle complete check
                if (state.currentPhase === 0) {
                    state.cycleCount++;
                    
                    if (state.timeLimitReached) {
                        completeSession();
                        return;
                    }
                }
                
                // Skip phases with 0 duration
                while (getScaledPhaseDuration(state.currentPhase) === 0) {
                    state.currentPhase = (state.currentPhase + 1) % 4;
                    state.phaseCountdown = getScaledPhaseDuration(state.currentPhase);
                    
                    if (state.currentPhase === 0) {
                        state.cycleCount++;
                        if (state.timeLimitReached) {
                            completeSession();
                            return;
                        }
                    }
                }
                
                playTone(state.currentPhase);
                vibratePhaseChange();
            } else {
                state.phaseCountdown--;
            }
            
            lastStateUpdate = performance.now();
            render();
        }, 1000);
    }

    function togglePlay() {
        if (state.isPlaying) {
            pauseSession();
        } else if (state.isPaused) {
            resumeSession();
        } else {
            // Resume audio context if needed
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            startCountdown();
        }
    }

    function resetToStart() {
        stopSession();
        state.sessionComplete = false;
        state.timeLimit = '';
        render();
    }

    function startWithPreset(minutes) {
        state.timeLimit = minutes.toString();
        
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        startCountdown();
    }

    // Motion preference
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motionQuery) {
        state.prefersReducedMotion = motionQuery.matches;
        motionQuery.addEventListener?.('change', (e) => {
            state.prefersReducedMotion = e.matches;
        });
    }

    // Resize handling
    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();

    // Render function
    function render() {
        const pattern = getPattern();
        let html = '';

        // Starting countdown
        if (state.isStartingCountdown) {
            html = `
                <div class="starting-countdown" aria-live="polite">${state.startingCountdown}</div>
                <div class="starting-text">Get ready...</div>
            `;
            app.innerHTML = html;
            updateCanvasVisibility();
            return;
        }

        // Header
        html += `<h1>Box Breathing</h1>`;

        // Playing state
        if (state.isPlaying || state.isPaused) {
            const currentPhase = getCurrentPhase();
            const phaseColor = PHASE_COLORS[state.currentPhase];
            const remainingTime = state.timeLimit 
                ? Math.max(0, parseInt(state.timeLimit) * 60 - state.totalTime) 
                : null;

            // Timer display
            html += `
                <div class="timer" aria-label="Session time">
                    ${formatTime(state.totalTime)}
                    ${remainingTime !== null ? `<span class="timer-remaining"> / ${formatTime(remainingTime)}</span>` : ''}
                </div>
                <div class="cycle-counter" aria-label="Cycle count">
                    Cycle ${state.cycleCount + 1}
                </div>
            `;

            // Instruction
            html += `
                <div class="instruction" style="color: ${phaseColor}" aria-live="polite">
                    ${currentPhase.name}
                </div>
            `;

            // Countdown with pulse class
            const countdownClass = state.phaseCountdown !== state.lastCountdownValue ? 'countdown pulse' : 'countdown';
            state.lastCountdownValue = state.phaseCountdown;
            
            html += `
                <div class="${countdownClass}" style="color: ${phaseColor}" aria-live="polite">
                    ${state.phaseCountdown}
                </div>
            `;

            // Phase tracker
            html += `<div class="phase-tracker" role="list" aria-label="Breathing phases">`;
            pattern.phases.forEach((phase, index) => {
                const phaseClr = PHASE_COLORS[index];
                const isActive = index === state.currentPhase;
                const isCompleted = index < state.currentPhase;
                const duration = getScaledPhaseDuration(index);
                
                if (duration === 0) return; // Skip phases with 0 duration
                
                html += `
                    <div class="phase-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                         style="--phase-color: ${phaseClr}"
                         role="listitem"
                         aria-current="${isActive ? 'step' : 'false'}">
                        <span class="phase-dot"></span>
                        <span class="phase-label">${phase.name}</span>
                        <span class="phase-time">${duration}s</span>
                    </div>
                `;
            });
            html += `</div>`;

            // Time limit warning
            if (state.timeLimitReached) {
                html += `
                    <div class="limit-warning" role="alert">
                        ${icons.clock} Finishing current cycle…
                    </div>
                `;
            }

            // Paused indicator
            if (state.isPaused) {
                html += `<div class="prompt">Paused</div>`;
            }

            // Control buttons
            html += `
                <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                    <button id="toggle-play" aria-label="${state.isPaused ? 'Resume' : 'Pause'}">
                        ${state.isPaused ? icons.play : icons.pause}
                        ${state.isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button id="stop-btn" class="button-secondary" aria-label="Stop">
                        ${icons.stop}
                        Stop
                    </button>
                </div>
            `;
        }
        // Session complete
        else if (state.sessionComplete) {
            html += `
                <div class="complete" aria-live="polite">
                    ${icons.award} Well Done!
                </div>
                <div class="session-summary">
                    <div class="summary-title">Session Complete</div>
                    <div class="summary-stats">
                        <div class="summary-stat">
                            <span class="summary-value">${formatTime(state.totalTime)}</span>
                            <span class="summary-label">Duration</span>
                        </div>
                        <div class="summary-stat">
                            <span class="summary-value">${state.cycleCount}</span>
                            <span class="summary-label">Cycles</span>
                        </div>
                    </div>
                </div>
                <button id="reset" aria-label="Start new session">
                    ${icons.rotateCcw}
                    New Session
                </button>
            `;
        }
        // Initial state (settings)
        else {
            // Stats bar
            if (state.stats.totalSessions > 0) {
                html += `
                    <div class="stats-bar">
                        <div class="stat-item">
                            <span class="stat-value">${state.stats.totalSessions}</span>
                            <span class="stat-label">Sessions</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${state.stats.totalMinutes}</span>
                            <span class="stat-label">Minutes</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${state.stats.currentStreak}</span>
                            <span class="stat-label">${icons.flame} Streak</span>
                        </div>
                    </div>
                `;
            } else {
                html += `<div class="subtitle">Breathe in rhythm with the box</div>`;
            }

            // Settings
            html += `<div class="settings">`;
            
            // Pattern selection
            html += `
                <div class="form-group-vertical">
                    <label class="form-label" for="pattern-select">Breathing Pattern</label>
                    <select id="pattern-select">
                        ${Object.entries(PATTERNS).map(([key, pat]) => 
                            `<option value="${key}" ${state.selectedPattern === key ? 'selected' : ''}>
                                ${pat.name}
                            </option>`
                        ).join('')}
                    </select>
                    <div class="pattern-preview">
                        ${pattern.phases.filter(p => p.duration > 0).map((p, i) => 
                            `${p.name}: ${Math.round(p.duration * state.phaseMultiplier)}s`
                        ).join(' → ')}
                    </div>
                </div>
            `;

            // Phase speed slider
            html += `
                <div class="slider-container">
                    <div class="slider-label">
                        <span>Pace</span>
                        <span class="slider-value">${state.phaseMultiplier === 1 ? 'Normal' : state.phaseMultiplier < 1 ? 'Faster' : 'Slower'}</span>
                    </div>
                    <input type="range" 
                           id="pace-slider" 
                           min="0.5" 
                           max="1.5" 
                           step="0.25" 
                           value="${state.phaseMultiplier}"
                           aria-label="Pace adjustment">
                </div>
            `;

            // Sound and haptics toggles
            html += `
                <div class="settings-row">
                    <div class="form-group">
                        <label class="switch">
                            <input type="checkbox" id="sound-toggle" ${state.soundEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <label for="sound-toggle">
                            ${state.soundEnabled ? icons.volume2 : icons.volumeX}
                            Sound
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="switch">
                            <input type="checkbox" id="haptic-toggle" ${state.hapticEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <label for="haptic-toggle">
                            ${icons.vibrate}
                            Haptic
                        </label>
                    </div>
                </div>
            `;

            // Time limit input
            html += `
                <div class="form-group-vertical">
                    <label class="form-label" for="time-limit">Duration (minutes, optional)</label>
                    <input type="number" 
                           id="time-limit" 
                           inputmode="numeric" 
                           placeholder="No limit"
                           value="${state.timeLimit}"
                           min="1"
                           max="60"
                           aria-label="Session duration in minutes">
                </div>
            `;

            html += `</div>`; // End settings

            // Prompt
            html += `<div class="prompt">Choose your settings and start</div>`;

            // Start button
            html += `
                <button id="toggle-play" aria-label="Start breathing exercise">
                    ${icons.play}
                    Start
                </button>
            `;

            // Preset buttons
            html += `
                <div class="shortcut-buttons">
                    <button id="preset-2min" class="preset-button" aria-label="Start 2 minute session">
                        ${icons.clock} 2 min
                    </button>
                    <button id="preset-5min" class="preset-button" aria-label="Start 5 minute session">
                        ${icons.clock} 5 min
                    </button>
                    <button id="preset-10min" class="preset-button" aria-label="Start 10 minute session">
                        ${icons.clock} 10 min
                    </button>
                </div>
            `;
        }

        app.innerHTML = html;
        updateCanvasVisibility();
        attachEventListeners();

        // Draw initial canvas state
        if (!state.isPlaying && !state.isStartingCountdown) {
            drawScene({ progress: state.sessionComplete ? 1 : 0, showTrail: state.sessionComplete });
        }
    }

    function attachEventListeners() {
        const togglePlayBtn = document.getElementById('toggle-play');
        const stopBtn = document.getElementById('stop-btn');
        const resetBtn = document.getElementById('reset');
        const soundToggle = document.getElementById('sound-toggle');
        const hapticToggle = document.getElementById('haptic-toggle');
        const timeLimitInput = document.getElementById('time-limit');
        const paceSlider = document.getElementById('pace-slider');
        const patternSelect = document.getElementById('pattern-select');
        const preset2 = document.getElementById('preset-2min');
        const preset5 = document.getElementById('preset-5min');
        const preset10 = document.getElementById('preset-10min');

        togglePlayBtn?.addEventListener('click', togglePlay);
        stopBtn?.addEventListener('click', stopSession);
        resetBtn?.addEventListener('click', resetToStart);

        soundToggle?.addEventListener('change', (e) => {
            state.soundEnabled = e.target.checked;
            if (state.soundEnabled) {
                playTone(0);
            }
        });

        hapticToggle?.addEventListener('change', (e) => {
            state.hapticEnabled = e.target.checked;
            if (state.hapticEnabled) {
                vibrate([30]);
            }
        });

        timeLimitInput?.addEventListener('input', (e) => {
            state.timeLimit = e.target.value.replace(/[^0-9]/g, '');
        });

        paceSlider?.addEventListener('input', (e) => {
            state.phaseMultiplier = parseFloat(e.target.value);
            render();
        });

        patternSelect?.addEventListener('change', (e) => {
            state.selectedPattern = e.target.value;
            render();
        });

        preset2?.addEventListener('click', () => startWithPreset(2));
        preset5?.addEventListener('click', () => startWithPreset(5));
        preset10?.addEventListener('click', () => startWithPreset(10));
    }

    // Initial render
    render();
});