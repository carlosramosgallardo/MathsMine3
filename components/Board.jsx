'use client';

import { useState, useEffect, useRef } from 'react';

export default function Board({ account, setGameMessage, setGameCompleted, setGameData }) {
  const [problem, setProblem] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [preGameCountdown, setPreGameCountdown] = useState(3);
  const [isDisabled, setIsDisabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameCompleted, setLocalGameCompleted] = useState(false);
  const [gameMessage, setLocalGameMessage] = useState(null);
  const [isFading, setIsFading] = useState(false);
  const inputRef = useRef(null);

  const PARTICIPATION_PRICE = parseFloat(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE);
  const preGameIntervalRef = useRef(null);
  const solveIntervalRef = useRef(null);

  const generateRandomMathProblem = () => {
    const operators = ['+', '-', '*', '/'];
    const op = operators[Math.floor(Math.random() * operators.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;

    if (op === '/' && b !== 0) {
      a = a * b; 
    }

    let answer;
    switch (op) {
      case '+': answer = a + b; break;
      case '-': answer = a - b; break;
      case '*': answer = a * b; break;
      case '/': answer = a / b; break;
    }

    return {
      type: 'math',
      question: `${a} ${op} ${b} =`,
      answer: answer.toString(),
      masked: `${a} ${op} ${b} = [MASK]`,
    };
  };

  const fetchPhrase = async () => {
    setIsRefreshing(true);
    try {
      const useMath = Math.random() < 0.5; 
      if (useMath) {
        const generated = generateRandomMathProblem();
        setProblem(generated);
      } else {
        const res = await fetch('/math_phrases.json');
        const phrases = await res.json();
        const chosen = phrases[Math.floor(Math.random() * phrases.length)];
        setProblem({ ...chosen, type: 'text' });
      }

      setUserAnswer('');
      setElapsedTime(0);
      setPreGameCountdown(3);
      setIsDisabled(true);
      setLocalGameCompleted(false);
      setGameCompleted(false);
      setLocalGameMessage(null);

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
    } catch (error) {
      console.error('Error fetching phrase:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
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
    if (!isDisabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isDisabled]);

  useEffect(() => {
    if (!gameMessage) return;
    setIsFading(false);
    const fadeTimer = setTimeout(() => setIsFading(true), 3500);
    const removeTimer = setTimeout(() => setLocalGameMessage(null), 4000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [gameMessage]);

  const showMessage = (msg, type = 'info', isToastOnly = false) => {
    if (!isToastOnly) setGameMessage(msg);
    setLocalGameMessage({ msg, type });
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
        finalizeGame(false, 0);
      }
    }, 100);
  };

  const checkAnswer = () => {
    if (!problem || isDisabled) return;
    clearInterval(solveIntervalRef.current);
    const totalTime = elapsedTime;
    const correct = userAnswer.trim().toLowerCase() === problem.answer.trim().toLowerCase();
    let miningAmount = 0;

    if (correct) {
      if (totalTime <= 5000) {
        miningAmount = PARTICIPATION_PRICE * ((5000 - totalTime) / 5000);
      } else {
        const overTime = Math.min(totalTime - 5000, 5000);
        const penaltyRatio = overTime / 5000;
        miningAmount = -PARTICIPATION_PRICE * 0.10 * penaltyRatio;
      }
      const displayAmount = Math.abs(miningAmount) < 0.00000001 ? '< 0.00000001' : miningAmount.toFixed(8);
      const message = account
        ? `Inject MM3 now: ${displayAmount}`
        : `Connect your wallet to proceed with injecting MM3: ${displayAmount}.`;
      showMessage(message, 'success');
    } else {
      showMessage('Incorrect! No mining reward.', 'error', true);
    }

    finalizeGame(correct, miningAmount);
  };

  const finalizeGame = (isCorrect, miningAmount) => {
    setIsDisabled(true);
    setLocalGameCompleted(true);
    setGameCompleted(true);
    setGameData({
      wallet: account,
      problem: problem.masked,
      user_answer: userAnswer,
      is_correct: isCorrect,
      time_ms: elapsedTime,
      mining_reward: miningAmount,
    });
  };

  return (
    <>
      <div className="w-full mt-10 bg-gray-900 p-4 rounded-xl shadow-lg text-center">
        <div className="bg-[#0b0f19] p-4 rounded-xl">
          {problem && (
            <>
              <div className="text-base font-mono text-[#22d3ee] flex flex-wrap justify-center items-center gap-1 text-center max-w-screen-sm mx-auto">
                {problem.type === 'math' ? (
                  <>
                    <span>{problem.question}</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isDisabled) checkAnswer();
                      }}
                      className="inline-block w-full max-w-[8rem] ml-2 px-2 py-1 border-b-2 border-yellow-400 text-center font-mono text-yellow-200 bg-white/10 backdrop-blur-md placeholder-[#64748b] italic tracking-wider transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:shadow-[0_0_15px_rgba(253,224,71,0.4)] animate-pulse hover:scale-105"
                      placeholder="?"
                      disabled={isDisabled}
                    />
                  </>
                ) : (
                  problem.masked.split('[MASK]').map((part, index, arr) => (
                    <span key={index} className="flex items-center gap-1 flex-wrap justify-center text-center">
                      <span>{part}</span>
                      {index < arr.length - 1 && (
                        <span className="whitespace-nowrap flex items-center gap-1">
                          <input
                            ref={inputRef}
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isDisabled) checkAnswer();
                            }}
                            className="inline-block w-full max-w-[8rem] px-2 py-1 border-b-2 border-yellow-400 text-center font-mono text-yellow-200 bg-white/10 backdrop-blur-md placeholder-[#64748b] italic tracking-wider transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:shadow-[0_0_15px_rgba(253,224,71,0.4)] animate-pulse hover:scale-105"
                            placeholder="fill the gap"
                            disabled={isDisabled}
                          />
                        </span>
                      )}
                    </span>
                  ))
                )}
              </div>

              <p className="text-sm text-[#22d3ee] mt-2">
                Time elapsed: <span className="text-yellow-300">{preGameCountdown > 0 ? 0 : elapsedTime} ms</span>
              </p>

              {preGameCountdown > 0 && (
                <p className="mt-2 text-[#22d3ee]">
                  Please wait {preGameCountdown} second(s)...
                </p>
              )}

              <div className="flex justify-center items-center gap-2 mt-4">
                <button
                  onClick={checkAnswer}
                  className={`px-4 py-1 rounded-xl font-mono text-sm transition-all duration-300 ease-in-out border-2 ${
                    isDisabled
                      ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-300 text-[#0b0f19] border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.4)] hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-105'
                  }`}
                  disabled={isDisabled}
                >
                  Submit
                </button>
                {gameCompleted && (
                  <button
                    onClick={fetchPhrase}
                    disabled={isRefreshing}
                    className={`w-8 h-8 flex items-center justify-center text-lg ${
                      isRefreshing ? 'animate-spin opacity-50 cursor-wait' : 'hover:text-yellow-300'
                    }`}
                    title="Try a new phrase"
                  >
                    🔄
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {gameMessage && (
        <div
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl font-mono text-sm z-50 shadow-xl transition-all duration-500 ${
            isFading ? 'opacity-0 translate-y-2' : 'opacity-100'
          } ${
            gameMessage.type === 'success'
              ? 'bg-green-800 border border-green-400 text-green-200'
              : gameMessage.type === 'error'
              ? 'bg-red-800 border border-red-400 text-red-200'
              : 'bg-[#0f172a] border border-yellow-400 text-yellow-300'
          }`}
        >
          <span className="mr-2">
            {gameMessage.type === 'success'
              ? '✅'
              : gameMessage.type === 'error'
              ? '❌'
              : '⏳'}
          </span>
          {gameMessage.msg}
        </div>
      )}
    </>
  );
}
