
import React, { useState, useEffect } from 'react';

const PHRASES = [
  { text: "Sejam sempre dedicados a obra do Senhor", highlight: "Senhor" },
  { text: "O maior entre vocês deverá ser servo", highlight: "servo" },
  { text: "E tudo quanto fizerem, façam com amor", highlight: "amor" }
];

export const TypewriterBackground: React.FC = () => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentTextLength, setCurrentTextLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentPhraseObj = PHRASES[currentPhraseIndex];
    const fullText = currentPhraseObj.text;

    const typeSpeed = 80;
    const deleteSpeed = 40;
    const pauseTime = 2500;

    if (isPaused) return;

    const handleType = () => {
      if (!isDeleting) {
        if (currentTextLength < fullText.length) {
          setCurrentTextLength((prev) => prev + 1);
        } else {
          setIsPaused(true);
          setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseTime);
        }
      } else {
        if (currentTextLength > 0) {
          setCurrentTextLength((prev) => prev - 1);
        } else {
          setIsDeleting(false);
          setCurrentPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        }
      }
    };

    const timer = setTimeout(handleType, isDeleting ? deleteSpeed : typeSpeed);
    return () => clearTimeout(timer);
  }, [currentTextLength, isDeleting, isPaused, currentPhraseIndex]);

  const renderText = () => {
    const currentPhraseObj = PHRASES[currentPhraseIndex];
    const fullText = currentPhraseObj.text;
    const highlightWord = currentPhraseObj.highlight;

    const highlightIndex = fullText.indexOf(highlightWord);
    
    // Normal rendering if highlight not reached or not found
    if (highlightIndex === -1 || currentTextLength <= highlightIndex) {
      return <span className="text-zinc-400 drop-shadow-sm">{fullText.substring(0, currentTextLength)}</span>;
    }

    // Split text logic
    const partBefore = fullText.substring(0, highlightIndex);
    const highlightEndIndex = highlightIndex + highlightWord.length;
    const visibleHighlightLength = Math.min(currentTextLength, highlightEndIndex) - highlightIndex;
    const partHighlight = highlightWord.substring(0, visibleHighlightLength);
    
    let partAfter = "";
    if (currentTextLength > highlightEndIndex) {
      partAfter = fullText.substring(highlightEndIndex, currentTextLength);
    }

    return (
      <>
        <span className="text-zinc-400 drop-shadow-sm">{partBefore}</span>
        <span className="text-teal-400 font-bold drop-shadow-md glow-text">{partHighlight}</span>
        <span className="text-zinc-400 drop-shadow-sm">{partAfter}</span>
      </>
    );
  };

  return (
    <div className="w-full flex justify-center pointer-events-none select-none">
      {/* Matches Login Card Width (max-w-[400px]) and Rounding */}
      <div className="w-full max-w-[400px] h-14 flex items-center justify-center bg-[#0F0F11]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] shadow-xl ring-1 ring-white/5 transition-all relative overflow-hidden">
        {/* Subtle inner reflection */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        
        <p className="font-mono text-[11px] md:text-xs text-center tracking-wide px-4 whitespace-nowrap overflow-hidden text-ellipsis">
          {renderText()}
          <span className="animate-pulse text-teal-500 ml-0.5 font-bold inline-block align-middle">|</span>
        </p>
      </div>
    </div>
  );
};
