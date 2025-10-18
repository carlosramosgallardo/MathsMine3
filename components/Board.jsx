'use client';

import { useState, useEffect, useRef } from 'react';

export default function Board({ account, setGameMessage, setGameCompleted, setGameData }) {
  // --- game state ---
  const [problem, setProblem] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [preGameCountdown, setPreGameCountdown] = useState(3);
  const [isDisabled, setIsDisabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameCompleted, setLocalGameCompleted] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type }
  const [isFading, setIsFading] = useState(false);

  // --- orb color (solo en sesión) + highlight de casilla correcta ---
  const [orbColor, setOrbColor] = useState('#000000');
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [highlightColor, setHighlightColor] = useState(null);

  const PARTICIPATION_PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;
  const preGameIntervalRef = useRef(null);
  const solveIntervalRef = useRef(null);

  // ---------- utilities ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // contraste de texto sobre fondo
  const hexToRgb = (hex) => {
    const h = (hex || '').replace('#','');
    if (h.length !== 6) return [0,0,0];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const getContrastText = (bgHex) => {
    const [r,g,b] = hexToRgb(bgHex || '#000000');
    // luminancia relativa simple
    const yiq = (r*299 + g*587 + b*114) / 1000;
    return yiq >= 150 ? '#0b0f19' : '#e2e8f0';
  };

  // ---------- generators ----------
  const genArith2 = () => {
    const ops = ['+', '-', '*', '/'];
    let op = ops[Math.floor(Math.random() * ops.length)];
    let a = randInt(6, 99);
    let b = randInt(2, 99);
    if (op === '/') { b = randInt(2, 12); a = b * randInt(2, 12); }
    let answer;
    switch (op) {
      case '+': answer = a + b; break;
      case '-': answer = a - b; break;
      case '*': answer = a * b; break;
      case '/': answer = a / b; break;
    }
    const correct = String(answer);
    const near = new Set();
    while (near.size < 5) {
      const delta = randInt(1, 12) * (Math.random() < 0.5 ? -1 : 1);
      const cand = String(answer + delta);
      if (cand !== correct) near.add(cand);
    }
    const choices = shuffle([correct, ...Array.from(near).slice(0, 3)]);
    return {
      type: 'arith2',
      question: `${a} ${op} ${b} =`,
      answer: correct,
      masked: `${a} ${op} ${b} = [MASK]`,
      placeholder: '?',
      choices
    };
  };

  const genOperatorFix = () => {
    const ops = ['+', '-', '*', '/'];
    let op = ops[Math.floor(Math.random() * ops.length)];
    let a = randInt(3, 40);
    let b = randInt(2, 20);
    if (op === '/') { b = randInt(2, 12); a = b * randInt(2, 12); }
    let c;
    switch (op) {
      case '+': c = a + b; break;
      case '-': c = a - b; break;
      case '*': c = a * b; break;
      case '/': c = a / b; break;
    }
    const validOps = ops.filter(o => {
      let val;
      switch (o) {
        case '+': val = a + b; break;
        case '-': val = a - b; break;
        case '*': val = a * b; break;
        case '/': val = b !== 0 ? a / b : NaN; break;
      }
      return val === c;
    });
    if (validOps.length !== 1) return genOperatorFix();
    const correct = op;
    const distractors = shuffle(ops.filter(o => o !== correct)).slice(0, 3);
    const choices = shuffle([correct, ...distractors]);
    return {
      type: 'opfix',
      question: `${a} ? ${b} = ${c}`,
      answer: correct,
      masked: `${a} [MASK] ${b} = ${c}`,
      placeholder: 'operator',
      choices
    };
  };

  const genDigitFix = () => {
    const op = Math.random() < 0.5 ? '+' : '-';
    let X = randInt(10, 98);
    let Y = randInt(2, 60);
    let Z = op === '+' ? X + Y : X - Y;
    const hideTens = Math.random() < 0.5;
    const xT = Math.floor(X / 10);
    const xU = X % 10;
    let maskedX, answerDigit;
    if (hideTens) { maskedX = `?${xU}`; answerDigit = xT; }
    else { maskedX = `${xT}?`; answerDigit = xU; }
    const candidates = [];
    for (let d = 0; d <= 9; d++) {
      const testX = hideTens ? d * 10 + xU : xT * 10 + d;
      const lhs = op === '+' ? testX + Y : testX - Y;
      if (lhs === Z) candidates.push(d);
    }
    if (candidates.length !== 1) return genDigitFix();
    const correct = String(answerDigit);
    const pool = new Set();
    while (pool.size < 3) {
      const d = String(randInt(0, 9));
      if (d !== correct) pool.add(d);
    }
    const choices = shuffle([correct, ...Array.from(pool)]);
    return {
      type: 'digitfix',
      question: `${maskedX} ${op} ${Y} = ${Z}`,
      answer: correct,
      masked: `${maskedX} ${op} ${Y} = ${Z}`,
      placeholder: 'digit',
      choices
    };
  };

  const generateProblem = () => {
    const pick = Math.random();
    if (pick < 0.34) return genOperatorFix();
    if (pick < 0.67) return genDigitFix();
    return genArith2();
  };

  // ---------- orb color listener ----------
  useEffect(() => {
    // escucha color actual del orbe (se emite en Page al cambiar)
    const onOrbColor = (ev) => {
      const next = ev?.detail?.color;
      if (typeof next === 'string') setOrbColor(next);
    };
    window.addEventListener('mm3-orb-color', onOrbColor);
    return () => window.removeEventListener('mm3-orb-color', onOrbColor);
  }, []);

  // ---------- flow ----------
  const fetchPhrase = async () => {
    setIsRefreshing(true);
    try {
      const generated = generateProblem();
      setProblem(generated);
      setElapsedTime(0);
      setPreGameCountdown(3);
      setIsDisabled(true);
      setLocalGameCompleted(false);
      setGameCompleted(false);
      setToast(null);
      // reset highlight
      setHighlightIdx(null);
      setHighlightColor(null);

      preGameIntervalRef.current = setInterval(() => {
        setPreGameCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(preGameIntervalRef.current);
            startSolveTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      console.error('Error starting round:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    fetchPhrase();
    return () => {
      clearInterval(preGameIntervalRef.current);
      clearInterval(solveIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    setIsFading(false);
    const fadeTimer = setTimeout(() => setIsFading(true), 3500);
    const removeTimer = setTimeout(() => setToast(null), 4000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);

  const showMessage = (msg, type = 'info', isToastOnly = false) => {
    if (!isToastOnly) setGameMessage(msg);
    setToast({ msg, type });
  };

  const startSolveTimer = () => {
    setIsDisabled(false);
    const startTime = Date.now();
    solveIntervalRef.current = setInterval(() => {
      const timePassed = Date.now() - startTime;
      setElapsedTime(timePassed);
      if (timePassed >= 10000) {
        clearInterval(solveIntervalRef.current);
        showMessage('Time exceeded! No mining reward.', 'info', true);
        finalizeGame(false, 0, null);
      }
    }, 100);
  };

  const checkAnswer = async (choice, idx) => {
    if (!problem || isDisabled) return;
    clearInterval(solveIntervalRef.current);

    const totalTime = elapsedTime;
    const correct = String(choice).trim().toLowerCase() === problem.answer.trim().toLowerCase();

    let miningAmount = 0;
    if (correct) {
      if (totalTime <= 5000) {
        miningAmount = PARTICIPATION_PRICE * ((5000 - totalTime) / 5000);
      } else {
        const overTime = Math.min(totalTime - 5000, 5000);
        const penaltyRatio = overTime / 5000;
        miningAmount = -PARTICIPATION_PRICE * 0.10 * penaltyRatio;
      }

      // pintar la casilla con el MISMO color del orbe:
      // 1) esperamos el próximo 'mm3-orb-color' (que Page emite tras calcular/persistir)
      // 2) fallback en 250ms al último color conocido, por si el evento tarda un pelo
      let settled = false;
      const applyHighlight = (color) => {
        if (settled) return;
        settled = true;
        setHighlightIdx(idx);
        setHighlightColor(color || orbColor || '#22d3ee');
      };

      const oneShot = (ev) => {
        applyHighlight(ev?.detail?.color);
        window.removeEventListener('mm3-orb-color', oneShot);
      };
      window.addEventListener('mm3-orb-color', oneShot);

      setTimeout(() => {
        window.removeEventListener('mm3-orb-color', oneShot);
        applyHighlight(orbColor);
      }, 250);

      // Notifica a Page (que calculará y persistirá el color y emitirá 'mm3-orb-color')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mm3-correct', { detail: { reward: miningAmount } }));
      }

      const displayAmount =
        Math.abs(miningAmount) < 1e-8 ? '< 0.00000001' : miningAmount.toFixed(8);

      const message = account
        ? `Inject MM3 now: ${displayAmount}`
        : `Connect your wallet to proceed with injecting MM3: ${displayAmount}.`;

      showMessage(message, 'success');
    } else {
      showMessage('Incorrect! No mining reward.', 'error', true);
    }

    finalizeGame(correct, miningAmount, choice);
  };

  const finalizeGame = (isCorrect, miningAmount, choice) => {
    setIsDisabled(true);
    setLocalGameCompleted(true);
    setGameCompleted(true);
    setGameData({
      wallet: account,
      problem: problem.masked,
      user_answer: String(choice ?? ''),
      is_correct: isCorrect,
      time_ms: elapsedTime,
      mining_reward: miningAmount,
    });
  };

  // ---------- UI ----------
  return (
    <>
      <div className="w-full mt-10 bg-gray-900 p-4 rounded-xl shadow-lg text-center">
        <div className="bg-[#0b0f19] p-4 rounded-xl">
          {problem && (
            <>
              {/* Statement */}
              <div className="text-base font-mono text-[#22d3ee] flex flex-wrap justify-center items-center gap-1 text-center max-w-screen-sm mx-auto">
                <span>{problem.question}</span>
              </div>

              {/* Timer */}
              <p className="text-sm text-[#22d3ee] mt-2">
                Time elapsed:{' '}
                <span className="text-yellow-300">
                  {preGameCountdown > 0 ? 0 : elapsedTime} ms
                </span>
              </p>

              {preGameCountdown > 0 && (
                <p className="mt-2 text-[#22d3ee]">
                  Please wait {preGameCountdown} second(s)...
                </p>
              )}

              {/* Choices */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
                {problem.choices.map((choice, idx) => {
                  const isHighlighted = idx === highlightIdx && highlightColor;
                  const bg = isHighlighted ? highlightColor : null;
                  const fg = isHighlighted ? getContrastText(highlightColor) : null;
                  return (
                    <button
                      key={idx}
                      onClick={() => checkAnswer(choice, idx)}
                      disabled={isDisabled}
                      className={`px-4 py-3 rounded-2xl font-mono text-lg transition-all border-2
                        ${isDisabled
                          ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                          : isHighlighted
                            ? 'border-transparent shadow-[0_0_18px_rgba(34,211,238,0.25)] scale-[1.01]'
                            : 'bg-[#0b1222] border-[#22d3ee]/50 text-[#e2e8f0] hover:scale-105 hover:shadow-[0_0_18px_rgba(34,211,238,0.45)] hover:border-[#22d3ee]'
                        }`}
                      style={isHighlighted ? {
                        backgroundColor: bg,
                        color: fg
                      } : undefined}
                      title="Pick your answer"
                    >
                      <span className={`${/^[+\-*/]$/.test(choice) ? 'text-2xl leading-none' : ''}`}>
                        {choice}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="flex justify-center items-center gap-2 mt-5">
                <button
                  className={`px-4 py-1 rounded-xl font-mono text-sm border-2
                    ${isDisabled
                      ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-300 text-[#0b0f19] border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.4)] hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-105'
                    }`}
                  disabled
                >
                  Submit
                </button>
                {gameCompleted && (
                  <button
                    onClick={fetchPhrase}
                    disabled={isRefreshing}
                    className={`w-8 h-8 flex items-center justify-center text-lg ${isRefreshing ? 'animate-spin opacity-50 cursor-wait' : 'hover:text-yellow-300'}`}
                    title="Try a new round"
                  >
                    🔄
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl font-mono text-sm z-50 shadow-xl transition-all duration-500 ${
            isFading ? 'opacity-0 translate-y-2' : 'opacity-100'
          } ${
            toast.type === 'success'
              ? 'bg-green-800 border border-green-400 text-green-200'
              : toast.type === 'error'
              ? 'bg-red-800 border border-red-400 text-red-200'
              : 'bg-[#0f172a] border border-yellow-400 text-yellow-300'
          }`}
        >
          <span className="mr-2">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⏳'}
          </span>
          {toast.msg}
        </div>
      )}
    </>
  );
}
