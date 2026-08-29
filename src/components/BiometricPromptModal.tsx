import React, { useState } from 'react';
import { Fingerprint, Lock, Unlock, KeyRound, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { biometricAuthService } from '../services/biometricAuth';

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
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPinFallback, setShowPinFallback] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');

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
    // Default master PIN for territory coordinators/admins
    if (enteredPin === '1234' || enteredPin === '0000') {
      onUnlockSuccess();
      onClose();
    } else {
      setErrorMessage('PIN de administrador incorrecto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isAdminUnlocked 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {isAdminUnlocked ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isAdminUnlocked ? 'Modo administrador' : 'Modo usuario'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdminUnlocked ? 'Edición de territorios habilitada' : 'Protección de datos y polígonos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {isAdminUnlocked ? (
            /* Unlocked State View */
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-300">Tienes acceso de edición completo</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                  Puedes dibujar polígonos, agregar letras en el mapa, importar archivos y modificar o eliminar territorios.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="btn-lock-from-modal"
                  onClick={() => {
                    onLock();
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-rose-950/80 text-rose-300 hover:text-rose-200 font-bold text-sm rounded-xl border border-slate-700 hover:border-rose-700/60 transition flex items-center justify-center gap-2 shadow"
                >
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <span>Bloquear edición 🔓</span>
                </button>
              </div>
            </div>
          ) : (
            /* Locked State View */
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-amber-400" />
                  <span>Desbloqueo seguro por Biometría</span>
                </p>
                <p className="text-slate-400">
                  Usa tu sensor de huella dactilar o reconocimiento facial de tu teléfono para habilitar herramientas de dibujo y edición.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {!showPinFallback ? (
                <div className="space-y-3 pt-1">
                  <button
                    id="btn-trigger-biometrics"
                    onClick={handleBiometricAuth}
                    disabled={isVerifying}
                    className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2.5"
                  >
                    <Fingerprint className="w-5 h-5 stroke-[2.5]" />
                    <span>{isVerifying ? 'Verificando con tu huella...' : 'Escanear Huella Dactilar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPinFallback(true);
                      setErrorMessage(null);
                    }}
                    className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>¿No tienes huella configurada? Usar PIN</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePinSubmit} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      PIN de Administrador (Coordinador)
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      autoFocus
                      placeholder="Ingresa PIN (ej. 1234)"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-amber-300 font-mono text-center tracking-widest text-lg py-2.5 px-3 rounded-xl focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPinFallback(false)}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold rounded-xl transition"
                    >
                      Volver a Huella
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
                    >
                      Desbloquear
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
