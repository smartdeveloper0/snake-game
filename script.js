const apiKey = ""; // Runtime provided
       
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('gameContainer');
        const scoreEl = document.getElementById('scoreVal');
        const highEl = document.getElementById('highScoreVal');
        const overlay = document.getElementById('overlay');
        const startBtn = document.getElementById('startBtn');
        const titleEl = document.getElementById('mainTitle');
        const pauseEl = document.getElementById('pause-indicator');
        const aiMessageEl = document.getElementById('ai-message');

        const GRID = 25;
        const COLS = Math.floor(canvas.width / GRID);
        const ROWS = Math.floor(canvas.height / GRID);
       
        let snake = [];
        let bombs = [];
        let food = {x: 0, y: 0};
        let velocity = {x: 0, y: 0};
        let nextVelocity = {x: 0, y: 0};
        let score = 0;
        let highScore = localStorage.getItem('snakeMineHigh') || 0;
        let speed = 110;
        let lastFrame = 0;
        let isRunning = false;
        let isPaused = false;
        let frameCount = 0;
        let lastActionTime = 0;

        highEl.innerText = highScore;

        // --- Sound System ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
       
        function playPCM16(base64Data) {
            if (!base64Data) return;
            try {
                const binaryString = window.atob(base64Data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
               
                const int16 = new Int16Array(bytes.buffer);
                const float32 = new Float32Array(int16.length);
                for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

                const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
                audioBuffer.getChannelData(0).set(float32);

                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
               
                const gain = audioCtx.createGain();
                gain.gain.value = 1.0;
               
                source.connect(gain);
                gain.connect(audioCtx.destination);
                source.start();
            } catch (e) { console.error("Audio Decode Error", e); }
        }

        function playTone(type) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const t = audioCtx.currentTime;
            const masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.6;
            masterGain.connect(audioCtx.destination);

            if (type === 'eat') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(1600, t + 0.1);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.1);
            } else if (type === 'process') {
                // Computing sound
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(2000, t);
                osc.frequency.linearRampToValueAtTime(800, t + 0.1);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.1);
            } else if (type === 'pop') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, t);
                osc.frequency.exponentialRampToValueAtTime(300, t + 0.15);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.15);
                osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.15);
            } else if (type === 'start') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, t);
                osc.frequency.exponentialRampToValueAtTime(880, t + 0.5);
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(200, t);
                filter.frequency.linearRampToValueAtTime(3000, t + 0.4);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
                gain.gain.linearRampToValueAtTime(0, t + 0.5);
                osc.connect(filter); filter.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.5);
            } else if (type === 'gameover') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(50, t + 0.6);
                const lfo = audioCtx.createOscillator();
                lfo.frequency.value = 20;
                const lfoGain = audioCtx.createGain();
                lfoGain.gain.value = 50;
                lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start(t); lfo.stop(t + 0.6);
                gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0, t + 0.6);
                osc.connect(gain); gain.connect(masterGain); osc.start(t); osc.stop(t + 0.6);
            } else if (type === 'explode') {
                const bufferSize = audioCtx.sampleRate * 1.0;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
                const noiseFilter = audioCtx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.setValueAtTime(1200, t); noiseFilter.frequency.exponentialRampToValueAtTime(50, t + 0.8);
                const noiseGain = audioCtx.createGain(); noiseGain.gain.setValueAtTime(1.5, t); noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
                noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterGain); noise.start(t);
                const boom = audioCtx.createOscillator(); boom.type = 'sine'; boom.frequency.setValueAtTime(150, t); boom.frequency.exponentialRampToValueAtTime(30, t + 0.6);
                const boomGain = audioCtx.createGain(); boomGain.gain.setValueAtTime(1.5, t); boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
                boom.connect(boomGain); boomGain.connect(masterGain); boom.start(t); boom.stop(t + 0.6);
                const crack = audioCtx.createOscillator(); crack.type = 'sawtooth'; crack.frequency.setValueAtTime(200, t); crack.frequency.exponentialRampToValueAtTime(50, t + 0.2);
                const crackGain = audioCtx.createGain(); crackGain.gain.setValueAtTime(0.8, t); crackGain.gain.linearRampToValueAtTime(0, t + 0.15);
                crack.connect(crackGain); crackGain.connect(masterGain); crack.start(t); crack.stop(t + 0.2);
            }
        }

        // --- GEMINI AI SERVICE (OPTIMIZED) ---
        const ViperAI = {
            async analyzeDeath(score, reason) {
                // Show box only when dead
                aiMessageEl.style.display = 'block';
                aiMessageEl.innerText = "CALCULATING FAILURE...";
                aiMessageEl.classList.add('cursor');
                playTone('process');

                try {
                    // Optimization: Shorter prompt, strict max tokens
                    const prompt = `Player died in Snake. Reason: ${reason}. Roast them in max 5 words.`;
                   
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { maxOutputTokens: 15, temperature: 0.9 }
                        })
                    });
                   
                    const data = await response.json();
                    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "SYSTEM FAILURE.";
                    text = text.replace(/^(AI|ViperOS):/i, "").trim().toUpperCase();
                   
                    // Show text immediately
                    this.typeWriter(text);
                    // Fetch audio immediately
                    this.speak(text);
                   
                } catch (e) {
                    console.error(e);
                    aiMessageEl.innerText = "CONNECTION LOST.";
                }
            },

            async speak(text) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: text }] }],
                            generationConfig: {
                                responseModalities: ["AUDIO"],
                                speechConfig: {
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } }
                                }
                            }
                        })
                    });
                    const data = await response.json();
                    const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    if (audioContent) playPCM16(audioContent);
                } catch (e) { console.error("TTS Error", e); }
            },

            typeWriter(text) {
                aiMessageEl.innerText = "";
                let i = 0;
                const typeInterval = setInterval(() => {
                    aiMessageEl.innerText += text.charAt(i);
                    i++;
                    if (i >= text.length) {
                        clearInterval(typeInterval);
                        aiMessageEl.classList.remove('cursor');
                    }
                }, 20);
            }
        };

        // --- Game Logic ---

        function initGame() {
            snake = [{x: 5, y: 10}, {x: 5, y: 11}, {x: 5, y: 12}];
            bombs = [];
            velocity = {x: 0, y: -1};
            nextVelocity = {x: 0, y: -1};
            score = 0;
            speed = 110;
            scoreEl.innerText = 0;
            isRunning = true;
            isPaused = false;
           
            overlay.style.display = 'none';
            pauseEl.style.display = 'none';
           
            // HIDE AI BOX ON START
            aiMessageEl.style.display = 'none';
            aiMessageEl.innerText = "";
           
            spawnFood();
            playTone('start');
           
            container.focus();
            lastActionTime = Date.now();
            lastFrame = performance.now();
            draw();
            requestAnimationFrame(loop);
        }

        startBtn.addEventListener('click', () => {
            if (!isRunning) initGame();
        });

        document.querySelectorAll('.m-btn').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const dir = btn.getAttribute('data-dir');
                input(dir);
            });
        });

        function loop(timestamp) {
            if (!isRunning) return;
            if (isPaused) {
                requestAnimationFrame(loop);
                return;
            }

            frameCount++;
            if (!lastFrame) lastFrame = timestamp;

            if (timestamp - lastFrame < speed) {
                requestAnimationFrame(loop);
                return;
            }
            lastFrame = timestamp;

            update();
            draw();
            requestAnimationFrame(loop);
        }

        function update() {
            velocity = {...nextVelocity};
            const head = {x: snake[0].x + velocity.x, y: snake[0].y + velocity.y};

            // 1. Update Bombs
            for (let i = bombs.length - 1; i >= 0; i--) {
                bombs[i].life--;
                if (bombs[i].life <= 0) {
                    playTone('pop');
                    bombs.splice(i, 1);
                }
            }

            // 2. Collisions
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
                gameOver("WALL COLLISION");
                return;
            }
            if (snake.some(p => p.x === head.x && p.y === head.y)) {
                gameOver("SELF-CANNIBALISM");
                return;
            }

            if (bombs.some(b => b.x === head.x && b.y === head.y)) {
                playTone('explode');
                gameOver("EXPLOSIVE DETONATION");
                return;
            }

            snake.unshift(head);

            // 3. Eat Food
            if (head.x === food.x && head.y === food.y) {
                score += 10;
                scoreEl.innerText = score;
                playTone('eat');
                if (score % 50 === 0 && speed > 50) speed -= 5;
                spawnFood();
                spawnBomb();
            } else {
                snake.pop();
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            bombs.forEach(drawCyberBomb);
            drawRealisticApple(food.x, food.y);
            drawRealisticSnake();
        }

        // --- Render Functions ---
        function drawCyberBomb(bomb) {
            const gx = bomb.x;
            const gy = bomb.y;
            const cx = gx * GRID + GRID/2;
            const cy = gy * GRID + GRID/2;
            const r = GRID/2 - 2;

            const lifePct = bomb.life / bomb.maxLife;
            const pulseRate = lifePct < 0.3 ? 0.8 : 0.2;
            const pulse = Math.sin(frameCount * pulseRate) * 0.5 + 0.5;

            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.roundRect(cx - r, cy - r, r*2, r*2, 5);
            ctx.fill();
           
            const glowIntensity = 0.3 + (pulse * 0.4);
            const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
            grad.addColorStop(0, `rgba(255, 50, 50, ${glowIntensity + 0.2})`);
            grad.addColorStop(0.6, `rgba(100, 0, 0, ${glowIntensity})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
           
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI*2);
            ctx.fill();

            ctx.strokeStyle = lifePct < 0.3 ? '#fff' : '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const endAngle = -Math.PI/2 + (Math.PI * 2 * lifePct);
            ctx.arc(cx, cy, r - 4, -Math.PI/2, endAngle, false);
            ctx.stroke();

            ctx.fillStyle = lifePct < 0.2 && frameCount % 4 === 0 ? '#fff' : '#ff0000';
            ctx.beginPath();
            ctx.rect(cx - 3, cy - 3, 6, 6);
            ctx.fill();

            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - r, cy); ctx.lineTo(cx - 5, cy);
            ctx.moveTo(cx + r, cy); ctx.lineTo(cx + 5, cy);
            ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - 5);
            ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy + 5);
            ctx.stroke();
        }

        function drawRealisticApple(gx, gy) {
            const cx = gx * GRID + GRID/2;
            const cy = gy * GRID + GRID/2;
            const r = GRID/2 - 2;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.ellipse(cx, cy + r - 2, r, r/3, 0, 0, Math.PI*2); ctx.fill();

            const grad = ctx.createRadialGradient(cx - r/3, cy - r/3, r/5, cx, cy, r);
            grad.addColorStop(0, '#ff5555'); grad.addColorStop(0.3, '#cc0000'); grad.addColorStop(1, '#660000');
            ctx.fillStyle = grad;
           
            ctx.beginPath();
            const topDip = r * 0.3;
            ctx.moveTo(cx, cy - r + topDip);
            ctx.bezierCurveTo(cx - r, cy - r, cx - r, cy + r, cx, cy + r);
            ctx.bezierCurveTo(cx + r, cy + r, cx + r, cy - r, cx, cy - r + topDip);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath(); ctx.ellipse(cx + r/3, cy - r/3, r/4, r/6, Math.PI/4, 0, Math.PI*2); ctx.fill();

            ctx.strokeStyle = '#654321'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx, cy - r + topDip); ctx.quadraticCurveTo(cx + 2, cy - r - 5, cx + 5, cy - r - 8); ctx.stroke();

            ctx.fillStyle = '#44aa44';
            ctx.beginPath(); ctx.ellipse(cx + 5, cy - r - 8, 6, 3, Math.PI/4, 0, Math.PI*2); ctx.fill();
        }

        function drawRealisticSnake() {
            snake.forEach((part, i) => {
                const cx = part.x * GRID + GRID/2;
                const cy = part.y * GRID + GRID/2;
                const r = GRID/2;
                const isHead = i === 0;

                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.ellipse(cx, cy + 2, r * 0.8, r * 0.8, 0, 0, Math.PI*2); ctx.fill();

                const grad = ctx.createRadialGradient(cx - r/4, cy - r/4, r/4, cx, cy, r);
                if (isHead) {
                    grad.addColorStop(0, '#aaffaa'); grad.addColorStop(0.4, '#00cc00'); grad.addColorStop(1, '#004400');
                } else {
                    grad.addColorStop(0, '#88ff88'); grad.addColorStop(0.4, '#009900'); grad.addColorStop(1, '#003300');
                }

                ctx.fillStyle = grad;
                if (isHead) drawHead(cx, cy, r);
                else { ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI*2); ctx.fill(); }
            });
        }

        function drawHead(x, y, r) {
            ctx.save();
            ctx.translate(x, y);
            let angle = 0;
            if (velocity.x === 1) angle = 0;
            if (velocity.x === -1) angle = Math.PI;
            if (velocity.y === 1) angle = Math.PI/2;
            if (velocity.y === -1) angle = -Math.PI/2;
            ctx.rotate(angle);
            ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r, 0, 0, Math.PI*2); ctx.fill();
            const eyeX = r * 0.4; const eyeY = r * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(eyeX, -eyeY, r*0.3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeX, eyeY, r*0.3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(eyeX + 1, -eyeY, r*0.15, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(eyeX + 1, eyeY, r*0.15, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.arc(r, -2, 1, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(r, 2, 1, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        function spawnFood() {
            let safe = false;
            while (!safe) {
                let f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
                if (!snake.some(p => p.x === f.x && p.y === f.y) && !bombs.some(b => b.x === f.x && b.y === f.y)) {
                    food = f; safe = true;
                }
            }
        }

        function spawnBomb() {
            let safe = false;
            let attempts = 0;
            while (!safe && attempts < 100) {
                let b = {
                    x: Math.floor(Math.random() * COLS),
                    y: Math.floor(Math.random() * ROWS),
                    maxLife: 80 + Math.floor(Math.random() * 70),
                    life: 0
                };
                b.life = b.maxLife;

                const distToHead = Math.abs(b.x - snake[0].x) + Math.abs(b.y - snake[0].y);
                const onSnake = snake.some(p => p.x === b.x && p.y === b.y);
                const onFood = (b.x === food.x && b.y === food.y);
                const onBomb = bombs.some(existing => existing.x === b.x && existing.y === b.y);

                if (!onSnake && !onFood && !onBomb && distToHead > 3) {
                    bombs.push(b);
                    safe = true;
                }
                attempts++;
            }
        }

        function gameOver(reason) {
            isRunning = false;
           
            if (reason !== "EXPLOSIVE DETONATION") {
                playTone('gameover');
            }

            if (score > highScore) {
                highScore = score;
                localStorage.setItem('snakeMineHigh', highScore);
            }
            titleEl.innerText = reason || "GAME OVER";
            startBtn.innerText = "PRESS SPACE TO RETRY";
           
            // --- VIPER OS INTEGRATION ---
            ViperAI.analyzeDeath(score, reason);
           
            overlay.style.display = 'flex';
        }

        function input(dir) {
            if (!isRunning) return;
            if (dir === 'UP' && velocity.y === 0) nextVelocity = {x: 0, y: -1};
            if (dir === 'DOWN' && velocity.y === 0) nextVelocity = {x: 0, y: 1};
            if (dir === 'LEFT' && velocity.x === 0) nextVelocity = {x: -1, y: 0};
            if (dir === 'RIGHT' && velocity.x === 0) nextVelocity = {x: 1, y: 0};
        }

        // --- Master Control: Spacebar & Movement ---
        function handleInput(e) {
            // Spacebar: Start / Retry / Pause
            if (e.code === 'Space') {
                e.preventDefault();
               
                // Add Cooldown to prevent "Double Tap" accidental pausing
                const now = Date.now();
                if (now - lastActionTime < 400) return;
                lastActionTime = now;

                if (!isRunning) {
                    initGame(); // Start or Retry
                } else {
                    isPaused = !isPaused; // Toggle Pause
                    pauseEl.style.display = isPaused ? 'block' : 'none';
                }
                return;
            }

            // Directional Controls
            if (['ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); input('UP'); }
            if (['ArrowDown','KeyS'].includes(e.code)) { e.preventDefault(); input('DOWN'); }
            if (['ArrowLeft','KeyA'].includes(e.code)) { e.preventDefault(); input('LEFT'); }
            if (['ArrowRight','KeyD'].includes(e.code)) { e.preventDefault(); input('RIGHT'); }
        }

        // Attach listener to both container and window for robust focus
        container.addEventListener('keydown', handleInput);
        window.addEventListener('keydown', e => {
            // Prevent page scroll for arrows/space
            if(['ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
            handleInput(e);
        });
