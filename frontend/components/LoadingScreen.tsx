
import React, { useState, useEffect } from 'react';
import { SwordsIcon } from './icons';

interface LoadingScreenProps {
  summonerName: string;
  onTimeout?: () => void;
}

const loadingSteps = [
  "Connecting to Riot's Lair...",
  "Analyzing your KDA...",
  "Decoding your champion's soul...",
  "Mapping your path to victory...",
  "Consulting the AI Oracle...",
  "Forging your legend...",
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({ summonerName, onTimeout }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => (prevStep + 1) % loadingSteps.length);
    }, 750); // Change text slightly faster than the total time

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
    }, 20000); // 20 seconds timeout

    return () => clearTimeout(timeout);
  }, [onTimeout]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="relative flex items-center justify-center">
         <SwordsIcon className="w-24 h-24 text-[#CDA434] animate-spin" style={{ animationDuration: '3s' }}/>
      </div>
      <h1 className="mt-8 text-4xl md:text-5xl font-bold text-gray-200 tracking-wider">
        Analyzing <span className="text-[#CDA434]">{summonerName.split('#')[0]}</span>
      </h1>
      <p className="mt-4 text-2xl md:text-3xl text-cyan-300 transition-opacity duration-500">
        {loadingSteps[currentStep]}
      </p>
    </div>
  );
};

export default LoadingScreen;
