/**
 * Modern Glassmorphic Calculator Engine
 * Features: High-precision calculation, keyboard shortcuts with visual feedback,
 * dynamic text sizing, dual-tier history display, and synthesized Web Audio click effects.
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const primaryDisplay = document.getElementById("primaryDisplay");
    const historyDisplay = document.getElementById("historyDisplay");
    const keypad = document.querySelector(".keypad");
    const soundToggle = document.getElementById("soundToggle");

    // Calculator State
    let currentValue = "0";
    let previousValue = null;
    let currentOperator = null;
    let isEvaluated = false;
    let soundEnabled = true;

    // Web Audio API Context (Lazy loaded)
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    /**
     * Synthesizes subtle, crisp mechanical UI click sounds
     */
    function playClickSound(type = "num") {
        if (!soundEnabled) return;
        try {
            initAudio();
            if (!audioCtx) return;

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const now = audioCtx.currentTime;

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === "equals") {
                osc.type = "sine";
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === "op") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(950, now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
                osc.start(now);
                osc.stop(now + 0.035);
            } else if (type === "action") {
                osc.type = "sine";
                osc.frequency.setValueAtTime(420, now);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
                osc.start(now);
                osc.stop(now + 0.035);
            } else {
                // Default number click
                osc.type = "sine";
                osc.frequency.setValueAtTime(750, now);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
                osc.start(now);
                osc.stop(now + 0.025);
            }
        } catch (e) {
            // Audio context not allowed or failed silently
        }
    }

    // Toggle Sound Button
    if (soundToggle) {
        soundToggle.addEventListener("click", () => {
            soundEnabled = !soundEnabled;
            soundToggle.classList.toggle("muted", !soundEnabled);
            soundToggle.setAttribute("aria-label", soundEnabled ? "Disable sound" : "Enable sound");
            if (soundEnabled) playClickSound("num");
        });
    }

    /**
     * Map internal operator symbols to display characters
     */
    function getOperatorSymbol(op) {
        switch (op) {
            case "+": return "+";
            case "-": return "−";
            case "*": return "×";
            case "/": return "÷";
            default: return op || "";
        }
    }

    /**
     * Update primary display font size based on input length
     */
    function adjustFontSize() {
        const length = primaryDisplay.value.length;
        if (length > 14) {
            primaryDisplay.style.fontSize = "1.45rem";
        } else if (length > 9) {
            primaryDisplay.style.fontSize = "1.85rem";
        } else {
            primaryDisplay.style.fontSize = "2.35rem";
        }
    }

    /**
     * Refresh the dual displays
     */
    function updateDisplay() {
        primaryDisplay.value = currentValue;
        adjustFontSize();

        if (previousValue !== null && currentOperator) {
            historyDisplay.textContent = `${previousValue} ${getOperatorSymbol(currentOperator)}`;
        } else if (isEvaluated) {
            // History already set on evaluate
        } else {
            historyDisplay.textContent = "";
        }

        // Highlight the currently active operator button
        document.querySelectorAll(".btn-operator").forEach(btn => {
            if (btn.dataset.value === currentOperator && !isEvaluated) {
                btn.classList.add("active-operator");
            } else {
                btn.classList.remove("active-operator");
            }
        });
    }

    /**
     * Number input handler
     */
    function handleNumber(numStr) {
        playClickSound("num");

        if (isEvaluated) {
            currentValue = numStr;
            isEvaluated = false;
            historyDisplay.textContent = "";
        } else {
            if (currentValue === "0" && numStr !== "0") {
                currentValue = numStr;
            } else if (currentValue === "0" && numStr === "0") {
                return;
            } else {
                // Limit maximum length to prevent overflow
                if (currentValue.replace("-", "").replace(".", "").length >= 16) return;
                currentValue += numStr;
            }
        }
        updateDisplay();
    }

    /**
     * Decimal point input handler
     */
    function handleDecimal() {
        playClickSound("num");

        if (isEvaluated) {
            currentValue = "0.";
            isEvaluated = false;
            historyDisplay.textContent = "";
        } else {
            if (!currentValue.includes(".")) {
                currentValue += ".";
            }
        }
        updateDisplay();
    }

    /**
     * Toggle positive / negative sign
     */
    function handleNegate() {
        playClickSound("action");
        if (currentValue === "0" || currentValue === "Cannot divide by 0") return;

        if (currentValue.startsWith("-")) {
            currentValue = currentValue.substring(1);
        } else {
            currentValue = "-" + currentValue;
        }
        updateDisplay();
    }

    /**
     * Percentage calculation
     */
    function handlePercent() {
        playClickSound("action");
        if (currentValue === "Cannot divide by 0") return;

        const current = parseFloat(currentValue);
        if (isNaN(current)) return;

        if (previousValue !== null && (currentOperator === "+" || currentOperator === "-")) {
            // E.g. 200 + 10% = 200 + (200 * 0.10)
            const prev = parseFloat(previousValue);
            const percentVal = prev * (current / 100);
            currentValue = cleanFloat(percentVal).toString();
        } else {
            // E.g. 50% = 0.5
            currentValue = cleanFloat(current / 100).toString();
        }

        updateDisplay();
    }

    /**
     * Operator handler (+, -, *, /)
     */
    function handleOperator(op) {
        playClickSound("op");
        if (currentValue === "Cannot divide by 0") {
            handleClear();
            return;
        }

        if (previousValue === null) {
            previousValue = currentValue;
            currentOperator = op;
            currentValue = "0";
        } else if (currentOperator && currentValue !== "0" && !isEvaluated) {
            // Intermediate calculation (chaining: 10 + 5 * 2)
            executeCalculation();
            previousValue = currentValue;
            currentOperator = op;
            currentValue = "0";
            isEvaluated = false;
        } else {
            // Switch operator
            currentOperator = op;
        }

        isEvaluated = false;
        updateDisplay();
    }

    /**
     * Safe float arithmetic calculation avoiding JavaScript precision pitfalls
     */
    function cleanFloat(num) {
        if (!isFinite(num)) return num;
        return parseFloat(num.toPrecision(12));
    }

    /**
     * Execute operation calculation
     */
    function executeCalculation() {
        if (previousValue === null || currentOperator === null) return;

        const prev = parseFloat(previousValue);
        const curr = parseFloat(currentValue);
        let result = 0;

        switch (currentOperator) {
            case "+":
                result = prev + curr;
                break;
            case "-":
                result = prev - curr;
                break;
            case "*":
                result = prev * curr;
                break;
            case "/":
                if (curr === 0) {
                    currentValue = "Cannot divide by 0";
                    historyDisplay.textContent = `${previousValue} ÷ 0 =`;
                    previousValue = null;
                    currentOperator = null;
                    isEvaluated = true;
                    updateDisplay();
                    return;
                }
                result = prev / curr;
                break;
            default:
                return;
        }

        const formatted = cleanFloat(result);
        historyDisplay.textContent = `${previousValue} ${getOperatorSymbol(currentOperator)} ${currentValue} =`;
        currentValue = String(formatted);
        previousValue = null;
        currentOperator = null;
        isEvaluated = true;
    }

    /**
     * Equals button handler
     */
    function handleEquals() {
        if (previousValue === null || currentOperator === null) return;
        playClickSound("equals");
        executeCalculation();
        updateDisplay();
    }

    /**
     * Delete last character (DEL)
     */
    function handleDelete() {
        playClickSound("action");
        if (isEvaluated || currentValue === "Cannot divide by 0") {
            handleClear();
            return;
        }

        if (currentValue.length > 1) {
            currentValue = currentValue.slice(0, -1);
            if (currentValue === "-" || currentValue === "-0") {
                currentValue = "0";
            }
        } else {
            currentValue = "0";
        }
        updateDisplay();
    }

    /**
     * Clear all (AC)
     */
    function handleClear() {
        playClickSound("action");
        currentValue = "0";
        previousValue = null;
        currentOperator = null;
        isEvaluated = false;
        historyDisplay.textContent = "";
        updateDisplay();
    }

    // Keypad Click Event Delegation
    keypad.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.dataset.action;
        const value = btn.dataset.value;

        switch (action) {
            case "number":
                handleNumber(value);
                break;
            case "decimal":
                handleDecimal();
                break;
            case "operator":
                handleOperator(value);
                break;
            case "calculate":
                handleEquals();
                break;
            case "clear":
                handleClear();
                break;
            case "delete":
                handleDelete();
                break;
            case "negate":
                handleNegate();
                break;
            case "percent":
                handlePercent();
                break;
        }
    });

    /**
     * Keyboard support with visual button press effect
     */
    function flashButton(selector) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.classList.add("pressed");
            setTimeout(() => btn.classList.remove("pressed"), 140);
        }
    }

    window.addEventListener("keydown", (e) => {
        // Digits 0 - 9
        if (e.key >= "0" && e.key <= "9") {
            e.preventDefault();
            handleNumber(e.key);
            flashButton(`button[data-action="number"][data-value="${e.key}"]`);
            return;
        }

        // Decimal point
        if (e.key === "." || e.key === ",") {
            e.preventDefault();
            handleDecimal();
            flashButton(`button[data-action="decimal"]`);
            return;
        }

        // Operators
        if (["+", "-", "*", "/"].includes(e.key)) {
            e.preventDefault();
            handleOperator(e.key);
            flashButton(`button[data-action="operator"][data-value="${e.key}"]`);
            return;
        }

        // Equals / Calculate (Enter or =)
        if (e.key === "Enter" || e.key === "=") {
            e.preventDefault();
            handleEquals();
            flashButton(`button[data-action="calculate"]`);
            return;
        }

        // Delete / Backspace
        if (e.key === "Backspace") {
            e.preventDefault();
            handleDelete();
            flashButton(`button[data-action="delete"]`);
            return;
        }

        // Clear All (Escape or C / c)
        if (e.key === "Escape" || e.key.toLowerCase() === "c") {
            e.preventDefault();
            handleClear();
            flashButton(`button[data-action="clear"]`);
            return;
        }

        // Percent (%)
        if (e.key === "%") {
            e.preventDefault();
            handlePercent();
            flashButton(`button[data-action="percent"]`);
            return;
        }
    });

    // Initialize display state on load
    updateDisplay();
});
