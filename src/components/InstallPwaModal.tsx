import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Share2, 
  PlusSquare, 
  CheckCircle2, 
  X, 
  Sparkles,
  Layers,
  WifiOff,
  Zap,
  ArrowRight
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstallSuccess?: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess
}) => {
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installComplete, setInstallComplete] = useState<boolean>(false);

  useEffect(() => {
    // Check if running inside standalone PWA mode
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(checkStandalone);

    // Detect iOS devices (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (window.navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
    setIsIOS(isAppleDevice);
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallComplete(true);
          if (onInstallSuccess) onInstallSuccess();
        }
      } catch (err) {
        console.error('Error during native PWA installation:', err);
      } finally {
        setIsInstalling(false);
      }
    }
  };

  return (
    <div 
      id="modal-install-pwa-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="modal-install-pwa-container"
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp text-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Instalar Aplicación
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  PWA
                </span>
              </h2>
              <p className="text-xs text-slate-400">Territorios Offline en tu dispositivo</p>
            </div>
          </div>

          <button
            id="btn-close-install-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {/* App Badge Banner */}
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <img 
              src="/icon-192.png" 
              alt="Territorios Logo" 
              className="w-14 h-14 rounded-2xl border border-slate-700 shadow-md shrink-0" 
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-100 text-sm truncate">Territorios Offline</h3>
              <p className="text-xs text-slate-400 line-clamp-2">
                Cartografía táctica, polígonos, manzanas y navegación GPS sin conexión.
              </p>
            </div>
          </div>

          {/* Value propositions */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center gap-1">
              <WifiOff className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-200 text-[11px]">100% Offline</span>
            </div>
            <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center gap-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-200 text-[11px]">Carga Instantánea</span>
            </div>
            <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center gap-1">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200 text-[11px]">Pantalla Completa</span>
            </div>
          </div>

          {/* Already installed state */}
          {isStandalone ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">¡Ya estás usando la versión instalada!</p>
                <p className="text-[11px] text-emerald-400/80 mt-1">
                  La aplicación está funcionando como app nativa independiente con acceso total sin conexión.
                </p>
              </div>
            </div>
          ) : installComplete ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">¡Instalación iniciada con éxito!</p>
                <p className="text-[11px] text-emerald-400/80 mt-1">
                  Revisa tu pantalla de inicio o cajón de aplicaciones para abrirla en cualquier momento.
                </p>
              </div>
            </div>
          ) : isIOS ? (
            /* iOS / Safari Step-by-step instructions */
            <div className="space-y-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs pb-1 border-b border-slate-800">
                <Smartphone className="w-4 h-4" />
                <span>Instrucciones para iPhone / iPad (Safari)</span>
              </div>

              <ol className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold font-mono text-xs shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-200">
                      Toca el botón <strong className="text-cyan-300">Compartir</strong> <Share2 className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" /> en la barra inferior de Safari.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold font-mono text-xs shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-200">
                      Desplázate hacia abajo en el menú y pulsa <strong className="text-cyan-300">"Añadir a pantalla de inicio"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" />.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold font-mono text-xs shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-200">
                      Pulsa <strong className="text-emerald-400">"Añadir"</strong> en la esquina superior derecha para finalizar.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            /* Android / Chrome / Edge Native Install Button */
            <div className="space-y-3">
              <button
                id="btn-confirm-native-install"
                onClick={handleNativeInstall}
                disabled={isInstalling}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>{isInstalling ? 'Instalando...' : 'Instalar en este Dispositivo'}</span>
              </button>
              <p className="text-[11px] text-center text-slate-400">
                Se añadirá un icono a tu pantalla de inicio o escritorio para acceso directo sin barras de navegador.
              </p>
            </div>
          ) : (
            /* Fallback instructions for desktop or general browsers */
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Monitor className="w-4 h-4" />
                <span>Instalación en Chrome, Edge o PC</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Haz clic en el icono de instalación <Download className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> ubicado en la barra de direcciones de tu navegador o abre el menú (tres puntos ⋮) y selecciona <strong>"Instalar Territorios Offline"</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            id="btn-close-install-modal-footer"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
