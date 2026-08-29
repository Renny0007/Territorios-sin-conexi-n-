import React, { useState, useEffect, useRef } from 'react';
import { Type, MapPin, X } from 'lucide-react';
import { LabelFontSize } from '../types';

interface LetterModalProps {
  isOpen: boolean;
  initialText?: string;
  initialSize?: LabelFontSize;
  onStartPlacing: (text: string, size: LabelFontSize) => void;
  onClose: () => void;
}

export const LetterModal: React.FC<LetterModalProps> = ({
  isOpen,
  initialText = 'A',
  initialSize = 'md',
  onStartPlacing,
  onClose
}) => {
  const [text, setText] = useState<string>(initialText);
  const [size, setSize] = useState<LabelFontSize>(initialSize);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText || 'A');
      setSize(initialSize || 'md');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, initialText, initialSize]);

  if (!isOpen) return null;

  const quickLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', '1', '2', '3'];

  const handlePlaceOnMap = () => {
    const finalText = text.trim().toUpperCase() || 'A';
    // Blur to dismiss mobile keyboard
    if (inputRef.current) {
      inputRef.current.blur();
    }
    onStartPlacing(finalText, size);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlaceOnMap();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="modal-letter-input"
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all transform animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
              <Type className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Agregar Letra al Mapa
              </h3>
              <p className="text-[11px] text-slate-400">
                Escribe la letra o número para colocarla en el mapa
              </p>
            </div>
          </div>

          <button
            id="btn-close-letter-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            title="Salir"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Main Input + Map Badge Preview */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Texto o Letra:
              </label>
              <input
                ref={inputRef}
                id="input-dialog-letter"
                type="text"
                value={text}
                maxLength={10}
                placeholder="Ej: A, B, 1"
                onChange={(e) => setText(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 text-amber-300 font-mono font-black text-xl sm:text-2xl px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-center tracking-widest uppercase transition"
                autoFocus
              />
            </div>

            {/* Live Visual Preview on Map Background */}
            <div className="flex flex-col items-center justify-center">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Vista previa
              </label>
              <div className="w-20 h-14 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-center p-1 relative overflow-hidden shadow-inner">
                <div 
                  className={`font-mono font-black border-2 rounded-lg text-center flex items-center justify-center ${
                    size === 'sm' ? 'text-xs px-1.5 py-0.5 min-w-[22px]' :
                    size === 'md' ? 'text-sm px-2 py-0.5 min-w-[28px]' :
                    size === 'lg' ? 'text-lg px-2.5 py-1 min-w-[36px]' :
                    'text-2xl px-3 py-1 min-w-[46px]'
                  }`}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    color: '#fbbf24',
                    borderColor: 'rgba(251, 191, 36, 0.8)',
                    boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
                  }}
                >
                  {text || 'A'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick letter presets */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Selección rápida:
            </span>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {quickLetters.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setText(l)}
                  className={`h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center transition active:scale-95 ${
                    text === l
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-lg scale-105'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Selector */}
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Tamaño de la etiqueta en el mapa:
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'sm', label: 'Pequeño (S)' },
                { id: 'md', label: 'Normal (M)' },
                { id: 'lg', label: 'Grande (L)' },
                { id: 'xl', label: 'Extra (XL)' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSize(item.id as LabelFontSize)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition text-center ${
                    size === item.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <span className="text-amber-400 text-base font-bold">💡</span>
            <span>Al pulsar <strong>Colocar en el mapa</strong>, podrás tocar en cualquier punto o dentro de cualquier polígono para fijarla.</span>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-col-reverse sm:flex-row gap-2.5 sm:items-center sm:justify-end">
          <button
            id="btn-modal-letter-cancel"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-700 transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Salir</span>
          </button>

          <button
            id="btn-modal-letter-place"
            type="button"
            onClick={handlePlaceOnMap}
            className="w-full sm:flex-1 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm sm:text-base rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5 stroke-[2.5]" />
            <span>Colocar en el mapa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
