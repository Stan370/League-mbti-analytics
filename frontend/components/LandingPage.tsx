import React, { useState, useEffect } from 'react';

interface LandingPageProps {
  onAnalyze: (summonerName: string, useMock: boolean) => void;
  error: string | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onAnalyze, error }) => {
  const [summonerName, setSummonerName] = useState('');
  const [useMockData, setUseMockData] = useState(false);

  // --- restore previous values ---
  useEffect(() => {
    const savedName = localStorage.getItem('summonerName');
    if (savedName) setSummonerName(savedName);
  }, []);

  // --- persist values on change ---
  useEffect(() => {
    localStorage.setItem('summonerName', summonerName);
  }, [summonerName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze(summonerName, useMockData);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-gradient-to-b from-[#010A13] via-[#0A1428] to-[#0E1E33] text-center text-gray-200">
      {/* faint rune pattern overlay */}
      <div className="absolute inset-0 bg-[url('/assets/runes-bg.png')] bg-cover bg-center opacity-10 pointer-events-none" />
      {/* subtle moving gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#CDA434]/10 via-transparent to-[#00C8FF]/10 animate-pulse pointer-events-none" />

      <div className="relative z-10 max-w-2xl px-4 animate-fadeIn">
        <h1 className="text-6xl md:text-8xl font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#CDA434] via-[#F9EBC8] to-[#CDA434] shimmer">
          League-MBTI
        </h1>

        <h2 className="mt-4 text-2xl md:text-3xl text-gray-300 italic tracking-wide">
          Your <span className="text-[#CDA434] font-semibold">AI Coach</span> & Chronicler —  
          <br className="hidden md:block" />  
          Turning your ranked grind into a saga of triumph and chaos.
        </h2>

        <form onSubmit={handleSubmit} className="mt-12 w-full max-w-lg mx-auto">
          <div className="relative border-2 border-transparent p-[2px] bg-gradient-to-r from-[#0E3955] to-[#2D899B] rounded-sm">
            <input
              type="text"
              value={summonerName}
              onChange={(e) => setSummonerName(e.target.value)}
              placeholder="SummonerName#TAG"
              disabled={useMockData}
              className="w-full bg-[#010A13] text-gray-200 text-2xl px-6 py-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#CDA434] transition-all duration-300 disabled:bg-gray-800/50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="mt-5 flex items-center justify-center gap-3">
            <input
              id="mock-data-checkbox"
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              className="w-5 h-5 accent-[#CDA434] bg-gray-700 border-gray-600 rounded focus:ring-[#CDA434] focus:ring-2"
            />
            <label htmlFor="mock-data-checkbox" className="text-lg md:text-xl text-gray-300 select-none">
              Use Mock Data (No API Key needed)
            </label>
          </div>

          {error && <p className="text-red-400 mt-4 text-xl">{error}</p>}

          
          <button
            type="submit"
            className="group relative mt-8 w-full text-3xl font-bold uppercase tracking-widest text-[#CDA434] bg-transparent px-8 py-4 border-2 border-[#CDA434] transition-all duration-300 ease-in-out overflow-hidden"
            style={{ clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)' }}
          >
            <span className="relative z-10 group-hover:text-[#010A13] transition-colors duration-300">Generate My Story</span>
            <div className="absolute inset-0 bg-[#CDA434] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-0"></div>
          </button>
        </form>

        <footer className="mt-10 text-gray-500 text-lg">
          Not affiliated with Riot Games.
        </footer>
      </div>

      {/* --- animations --- */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }

        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        .shimmer {
          background-size: 400px 100%;
          animation: shimmer 5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
