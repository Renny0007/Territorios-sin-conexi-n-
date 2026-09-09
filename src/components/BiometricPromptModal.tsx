import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  Lock, 
  Unlock, 
  KeyRound, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { biometricAuthService, BiometricStatus } from '../services/biometricAuth';

interface BiometricPromptModalProps {
  isOpen: boolean;
  isAdminUnlocked: boolean;
  isBiometricSupported: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  onLock: () => void;
}

export const BiometricPromptModal: React.FC<BiometricPromptModalProps> = ({
  isOpen,
  isAdminUnlocked,
  isBiometricSupported,
  onClose,
  onUnlockSuccess,
  onLock
}) => {
  const [activeTab, setActiveTab] = useState<'fingerprint' | 'pin'>('fingerprint');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setEnteredPin('');
      setIsIframeBlocked(false);
      biometricAuthService.checkBiometricSupport().then((status) => {
        setBioStatus(status);
        if (status.isInIframe) {
          setIsIframeBlocked(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBiometricAuth = async () => {
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const result = await biometricAuthService.authenticateWithBiometrics();
      if (result.success) {
        onUnlockSuccess();
        onClose();
      } else {
        if (result.isIframeBlocked) {
          setIsIframeBlocked(true);
        }
        setErrorMessage(result.error || 'Autenticación biométrica no completada.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error durante la autenticación biométrica.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPin || enteredPin.length < 4) {
      setErrorMessage('Ingresa un PIN de al menos 4 dígitos (ej. 1234).');
      return;
    }

    if (biometricAuthService.verifyPin(enteredPin)) {
      onUnlockSuccess();
      onClose();
    } else {
      setErrorMessage('PIN incorrecto. El PIN predeterminado es 1234.');
    }
  };

  const handleQuickUnlockDefaultPin = () => {
    if (biometricAuthService.verifyPin('1234')) {
      onUnlockSuccess();
      onClose();
    }
  };

  const handleOpenStandalone = () => {
    try {
      window.open(window.location.href, '_blank');
    } catch (err) {
      console.warn('Could not open new window:', err);
    }
  };

  return (
    <div 
      id="modal-biometric-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="modal-biometric-container"
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp text-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isAdminUnlocked 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {isAdminUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {isAdminUnlocked ? 'Modo Administrador' : 'Seguridad y Desbloqueo'}
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border ${
                  isAdminUnlocked 
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-950 text-amber-400 border-amber-500/30'
                }`}>
                  {isAdminUnlocked ? 'Desbloqueado' : 'Protegido'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isAdminUnlocked ? 'Edición de territorios y polígonos activa' : 'Control de acceso para dibujo y edición'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-biometric-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {isAdminUnlocked ? (
            /* Unlocked State View */
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-300">Tienes acceso de edición completo</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                  Puedes dibujar nuevos polígonos, modificar vértices, agregar letras y editar o borrar territorios.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="btn-lock-from-modal"
                  onClick={() => {
                    onLock();
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-rose-950/80 text-rose-300 hover:text-rose-200 font-bold text-xs rounded-xl border border-slate-700 hover:border-rose-700/60 transition flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>Bloquear modo edición (Volver a Modo Lectura)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Locked State View */
            <div className="space-y-4">
              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <button
                  id="tab-btn-fingerprint"
                  type="button"
                  onClick={() => {
                    setActiveTab('fingerprint');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeTab === 'fingerprint'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Huella / Touch</span>
                </button>

                <button
                  id="tab-btn-pin"
                  type="button"
                  onClick={() => {
                    setActiveTab('pin');
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeTab === 'pin'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>PIN de Seguridad</span>
                </button>
              </div>

              {/* Iframe or Security Diagnostics Notice */}
              {isIframeBlocked && activeTab === 'fingerprint' && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-xs text-amber-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-200">Aviso sobre el lector de huella:</p>
                      <p className="text-[11px] text-amber-300/90 mt-0.5">
                        Por normas de seguridad del navegador, los sensores biométricos físicos se desactivan dentro de marcos de vista previa (iframe).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      id="btn-open-in-tab-for-biometrics"
                      onClick={handleOpenStandalone}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en nueva pestaña</span>
                    </button>
                    <button
                      id="btn-switch-to-pin-quick"
                      onClick={() => setActiveTab('pin')}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Desbloquear con PIN (1234)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message Display */}
              {errorMessage && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Tab 1: Fingerprint Sensor */}
              {activeTab === 'fingerprint' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                      <Fingerprint className={`w-9 h-9 ${isVerifying ? 'animate-pulse text-amber-300' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        {isVerifying ? 'Esperando tu huella en el sensor...' : 'Toca para escanear tu huella dactilar'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Utiliza el sensor biométrico integrado en tu móvil o Passkey de tu navegador.
                      </p>
                    </div>
                  </div>

                  <button
                    id="btn-trigger-biometrics"
                    onClick={handleBiometricAuth}
                    disabled={isVerifying}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-950 transition flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Fingerprint className="w-5 h-5 stroke-[2.5]" />
                    <span>{isVerifying ? 'Escaneando...' : 'Escanear Huella Dactilar'}</span>
                  </button>

                  {/* Direct 1-Click Fallback */}
                  <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">¿Problemas con el lector?</span>
                    <button
                      id="btn-quick-unlock-1234"
                      onClick={handleQuickUnlockDefaultPin}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Desbloqueo directo (PIN 1234)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: PIN Code Input */}
              {activeTab === 'pin' && (
                <form onSubmit={handlePinSubmit} className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label htmlFor="input-admin-pin" className="block text-xs font-bold text-slate-200">
                        PIN de Administrador
                      </label>
                      <span className="text-[11px] text-amber-400 font-mono">Por defecto: 1234</span>
                    </div>

                    <input
                      id="input-admin-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      autoFocus
                      placeholder="••••"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-amber-300 font-mono text-center tracking-[0.5em] text-2xl py-3 px-3 rounded-xl focus:outline-none focus:border-amber-400 shadow-inner"
                    />

                    <p className="text-[11px] text-slate-400 text-center">
                      Ingresa el PIN de 4 a 6 dígitos para habilitar el modo edición.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleQuickUnlockDefaultPin}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Usar PIN 1234
                    </button>
                    <button
                      id="btn-submit-pin"
                      type="submit"
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-950 transition cursor-pointer"
                    >
                      Desbloquear
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>PIN maestro predeterminado: 1234</span>
          </span>
          <button
            id="btn-footer-close-bio"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
