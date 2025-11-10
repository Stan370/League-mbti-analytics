
import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoadingScreen from './components/LoadingScreen';
import ResultsPage from './components/ResultsPage';
import { analyzePlayer } from './services/riotApiService';
import { analyzePlayerMock } from './services/mockAnalyticsService';
import type { AnalysisResult } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'loading' | 'results'>('landing');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summonerName, setSummonerName] = useState<string>('');

  const handleAnalysis = async (summoner: string, useMock: boolean) => {
    if (!useMock && (!summoner.trim() || !summoner.includes('#'))) {
        setError('Please enter a valid Summoner Name#Tag for live analysis.');
        return;
    }
    setSummonerName(useMock ? 'Prototype#NA1' : summoner);
    setView('loading');
    setError(null);
    try {
      const result = useMock
        ? await analyzePlayerMock(summoner)
        : await analyzePlayer(summoner);
        
      setAnalysis(result);
      setTimeout(() => setView('results'), 1000); // Small delay to appreciate loading screen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setView('landing');
    }
  };

  const handleTimeout = () => {
    setError('Request timed out. Please try again.');
    setView('landing');
  };

  const handleReset = () => {
    setView('landing');
    setAnalysis(null);
    setError(null);
    setSummonerName('');
  };

  const renderContent = () => {
    switch (view) {
      case 'loading':
        return <LoadingScreen summonerName={summonerName} onTimeout={handleTimeout} />;
      case 'results':
        return analysis ? <ResultsPage analysis={analysis} onReset={handleReset} /> : <LoadingScreen summonerName={summonerName} onTimeout={handleTimeout} />;
      case 'landing':
      default:
        return <LandingPage onAnalyze={handleAnalysis} error={error} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#010A13] text-gray-200">
      <div className="relative isolate min-h-screen">
        <div 
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat" 
          style={{backgroundImage: "url('https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt845c476de86f39e3/637e73501f2f2510b64e53de/112422_Summoners_Rift_Update_Banner.jpg')"}}
        ></div>
        <div className="absolute inset-0 -z-10 bg-black/70 backdrop-blur-sm"></div>
        {renderContent()}
      </div>
    </div>
  );
};

export default App;
