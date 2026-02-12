/**
 * Cheltenham Maths Sprint
 * Pure front-end game state with deterministic tick/update loop.
 */
(() => {
  const UI = {
    question: document.getElementById("questionText"),
    answerForm: document.getElementById("answerForm"),
    answerInput: document.getElementById("answerInput"),
    submitBtn: document.getElementById("submitBtn"),
    startBtn: document.getElementById("startBtn"),
    restartBtn: document.getElementById("restartBtn"),
    status: document.getElementById("statusText"),
    difficulty: document.getElementById("difficultyText"),
    time: document.getElementById("timeText"),
    horses: {
      player: document.getElementById("horse-player"),
      "ai-1": document.getElementById("horse-ai-1"),
      "ai-2": document.getElementById("horse-ai-2"),
      "ai-3": document.getElementById("horse-ai-3"),
    },
  };

  const config = {
    finishDistance: 100,
    aiTickMs: 500,
    playerMoveBase: 8,
    playerFastBonusMax: 5,
    playerWrongPenalty: 1.5,
    aiRacers: [
      { id: "ai-1", name: "AI Blaze", base: 2.9, variance: 1.6 },
      { id: "ai-2", name: "AI Comet", base: 2.6, variance: 1.9 },
      { id: "ai-3", name: "AI Thunder", base: 3.0, variance: 1.4 },
    ],
  };

  const state = {
    running: false,
    over: false,
    winner: null,
    currentQuestion: null,
    questionStartTime: null,
    aiTimerId: null,
    distances: {
      player: 0,
      "ai-1": 0,
      "ai-2": 0,
      "ai-3": 0,
    },
  };

  function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
  }

  function getProgressPercent() {
    return (state.distances.player / config.finishDistance) * 100;
  }

  function getDifficultyByProgress() {
    const progress = getProgressPercent();
    if (progress < 30) {
      return "Easy";
    }
    if (progress <= 70) {
      return "Medium";
    }
    return "Hard";
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateQuestion() {
    const difficulty = getDifficultyByProgress();
    let a;
    let b;
    let operator;

    if (difficulty === "Easy") {
      operator = Math.random() < 0.5 ? "+" : "-";
      a = randomInt(1, 20);
      b = randomInt(1, 20);
    } else if (difficulty === "Medium") {
      operator = Math.random() < 0.55 ? "+" : "-";
      a = randomInt(10, 60);
      b = randomInt(5, 45);
    } else {
      const roll = Math.random();
      operator = roll < 0.4 ? "+" : roll < 0.75 ? "-" : "×";
      if (operator === "×") {
        a = randomInt(3, 12);
        b = randomInt(2, 12);
      } else {
        a = randomInt(20, 95);
        b = randomInt(10, 70);
      }
    }

    if (operator === "-" && b > a) {
      [a, b] = [b, a];
    }

    let answer;
    if (operator === "+") answer = a + b;
    else if (operator === "-") answer = a - b;
    else answer = a * b;

    return {
      text: `${a} ${operator} ${b} = ?`,
      answer,
      difficulty,
    };
  }

  function renderHorses() {
    Object.entries(state.distances).forEach(([id, distance]) => {
      const percent = clamp((distance / config.finishDistance) * 100, 0, 100);
      UI.horses[id].style.transform = `translate(${percent}%, -50%)`;
    });
  }

  function setStatus(message, type = "neutral") {
    UI.status.textContent = message;
    UI.status.classList.remove("status-correct", "status-wrong");
    if (type === "correct") {
      UI.status.classList.add("status-correct");
    }
    if (type === "wrong") {
      UI.status.classList.add("status-wrong");
    }
  }

  function setQuestion() {
    state.currentQuestion = generateQuestion();
    state.questionStartTime = performance.now();
    UI.question.textContent = state.currentQuestion.text;
    UI.difficulty.textContent = state.currentQuestion.difficulty;
    UI.answerInput.value = "";
    UI.answerInput.focus();
  }

  function disableAnswerInput(disabled) {
    UI.answerInput.disabled = disabled;
    UI.submitBtn.disabled = disabled;
  }

  function stopRace(winnerId) {
    state.running = false;
    state.over = true;
    state.winner = winnerId;
    clearInterval(state.aiTimerId);
    state.aiTimerId = null;

    disableAnswerInput(true);
    UI.startBtn.disabled = true;
    UI.restartBtn.disabled = false;

    if (winnerId === "player") {
      setStatus("🏆 You win! Incredible sprint!", "correct");
    } else {
      const aiName = config.aiRacers.find((r) => r.id === winnerId)?.name || "AI";
      setStatus(`🏁 ${aiName} wins this race. Try again!`, "wrong");
    }
  }

  function maybeFinishRace() {
    for (const [id, distance] of Object.entries(state.distances)) {
      if (distance >= config.finishDistance) {
        stopRace(id);
        return true;
      }
    }
    return false;
  }

  function moveAIs() {
    if (!state.running || state.over) return;

    config.aiRacers.forEach((ai) => {
      const randomSwing = (Math.random() - 0.5) * ai.variance * 2;
      const moveAmount = clamp(ai.base + randomSwing, 0.8, 5.2);
      state.distances[ai.id] += moveAmount;
    });

    renderHorses();
    maybeFinishRace();
  }

  function handleAnswerSubmit(event) {
    event.preventDefault();
    if (!state.running || state.over || !state.currentQuestion) return;

    const submitted = Number(UI.answerInput.value);
    if (Number.isNaN(submitted)) return;

    const elapsedMs = performance.now() - state.questionStartTime;
    const elapsedSec = elapsedMs / 1000;
    UI.time.textContent = `${elapsedSec.toFixed(2)}s`;

    if (submitted === state.currentQuestion.answer) {
      // Speed bonus: answers at <=1s get full bonus, then linearly decay down to 0 by 6s.
      const speedFactor = clamp((6 - elapsedSec) / 5, 0, 1);
      const moveAmount = config.playerMoveBase + speedFactor * config.playerFastBonusMax;
      state.distances.player += moveAmount;
      setStatus(`Correct! +${moveAmount.toFixed(1)} distance`, "correct");
    } else {
      // Gentle penalty keeps gameplay fun but encourages accuracy.
      state.distances.player = Math.max(0, state.distances.player - config.playerWrongPenalty);
      setStatus(`Oops! Correct was ${state.currentQuestion.answer}. -${config.playerWrongPenalty} distance`, "wrong");
    }

    renderHorses();
    if (!maybeFinishRace()) {
      setQuestion();
    }
  }

  function startRace() {
    if (state.running) return;

    state.running = true;
    state.over = false;
    state.winner = null;

    UI.startBtn.disabled = true;
    UI.restartBtn.disabled = false;
    disableAnswerInput(false);
    UI.time.textContent = "—";
    setStatus("Race on! Solve quickly for speed bonus.");

    setQuestion();
    renderHorses();

    state.aiTimerId = setInterval(moveAIs, config.aiTickMs);
  }

  function resetRace() {
    clearInterval(state.aiTimerId);
    state.aiTimerId = null;

    state.running = false;
    state.over = false;
    state.winner = null;
    state.currentQuestion = null;
    state.questionStartTime = null;

    Object.keys(state.distances).forEach((key) => {
      state.distances[key] = 0;
    });

    renderHorses();
    UI.question.innerHTML = 'Press <strong>Start Race</strong> to begin!';
    UI.difficulty.textContent = "Easy";
    UI.time.textContent = "—";
    setStatus("Race reset. Ready when you are.");

    UI.startBtn.disabled = false;
    UI.restartBtn.disabled = true;
    disableAnswerInput(true);
  }

  UI.answerForm.addEventListener("submit", handleAnswerSubmit);
  UI.startBtn.addEventListener("click", startRace);
  UI.restartBtn.addEventListener("click", resetRace);

  // Ensure Enter key works naturally for submission on focused input.
  UI.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      UI.answerForm.requestSubmit();
    }
  });

  resetRace();
})();
