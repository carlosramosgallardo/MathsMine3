'use client';

import { useEffect, useState } from 'react';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function LearnMathPage() {
  const [phrases, setPhrases] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch('/math_phrases.json')
      .then((res) => res.json())
      .then((data) => {
        const shuffledData = shuffleArray(data);
        setPhrases(shuffledData);
      })
      .catch((err) => console.error('Error fetching JSON:', err));
  }, []);

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % phrases.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + phrases.length) % phrases.length);
  };

  if (phrases.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center h-screen text-base font-mono text-gray-200 bg-black">
        <p>Loading...</p>
      </main>
    );
  }

  const currentPhrase = phrases[currentIndex];
  const fullPhrase = currentPhrase.masked.replace('[MASK]', currentPhrase.answer);

  return (
    <main className="flex flex-col items-center w-full px-4 pt-10 pb-20 text-base font-mono text-gray-200 bg-black">
      <div className="max-w-3xl w-full">
        <section className="mb-6 flex flex-col items-center">
          <div className="p-6 bg-[#0b0f19] border border-[#22d3ee] rounded-lg shadow-lg w-full">
            <p className="mb-4 text-center">{fullPhrase}</p>
            {currentPhrase.image && (
              <img
                src={currentPhrase.image}
                alt={`Image for phrase ${currentIndex + 1}`}
                className="max-w-full h-auto"
              />
            )}
          </div>
        </section>

        <section className="flex justify-between">
          <button
            onClick={goPrev}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Previous
          </button>
          <button
            onClick={goNext}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Next
          </button>
        </section>
      </div>
    </main>
  );
}
