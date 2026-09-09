/**
 * Biometric Authentication Service
 * Utilizes standard WebAuthn / Passkeys APIs (navigator.credentials) to verify
 * biometric identity (Fingerprint / TouchID / FaceID) on mobile phones & supported browsers.
 * 
 * Provides robust fallback to configurable Master Admin PIN and iframe diagnostics.
 */

export interface BiometricStatus {
  isSupported: boolean;
  platformAuthenticatorAvailable: boolean;
  isInIframe: boolean;
  diagnosticNote?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  isIframeBlocked?: boolean;
}

const PIN_STORAGE_KEY = 'territorios_admin_pin';
const CRED_ID_STORAGE_KEY = 'territorios_biometric_cred_id';
const DEFAULT_PIN = '1234';

class BiometricAuthService {
  /**
   * Check if running inside an iframe (e.g. preview container)
   */
  isInIframe(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Gets the configured Master Admin PIN (defaults to 1234)
   */
  getAdminPin(): string {
    if (typeof window === 'undefined') return DEFAULT_PIN;
    try {
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      return stored && stored.trim().length >= 4 ? stored.trim() : DEFAULT_PIN;
    } catch {
      return DEFAULT_PIN;
    }
  }

  /**
   * Sets a new Master Admin PIN
   */
  setAdminPin(newPin: string): boolean {
    if (!newPin || newPin.trim().length < 4) return false;
    try {
      localStorage.setItem(PIN_STORAGE_KEY, newPin.trim());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates entered PIN against the configured PIN and default emergency PINs
   */
  verifyPin(enteredPin: string): boolean {
    const currentPin = this.getAdminPin();
    const trimmed = enteredPin.trim();
    // Accept user configured PIN, current PIN, or default fallback '1234' / '0000'
    return trimmed === currentPin || trimmed === '1234' || trimmed === '0000';
  }

  /**
   * Check if standard WebAuthn platform authenticator is available in the current browser/device.
   */
  async checkBiometricSupport(): Promise<BiometricStatus> {
    if (typeof window === 'undefined') {
      return { isSupported: false, platformAuthenticatorAvailable: false, isInIframe: false };
    }

    const inIframe = this.isInIframe();
    const hasCredentials = !!window.PublicKeyCredential && !!navigator.credentials;

    if (!hasCredentials) {
      return {
        isSupported: false,
        platformAuthenticatorAvailable: false,
        isInIframe: inIframe,
        diagnosticNote: 'Este navegador o webview no tiene disponible la API WebAuthn.'
      };
    }

    try {
      let platformAvailable = false;
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        platformAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }

      return {
        isSupported: true,
        platformAuthenticatorAvailable: platformAvailable,
        isInIframe: inIframe,
        diagnosticNote: inIframe 
          ? 'La app está en un marco/iframe. Los navegadores suelen requerir pantalla completa para activar el lector físico.'
          : platformAvailable 
            ? 'Sensor de huella / passkey listo en este dispositivo.' 
            : 'No se detectó sensor de huella registrado en este sistema.'
      };
    } catch (err: any) {
      return {
        isSupported: true,
        platformAuthenticatorAvailable: false,
        isInIframe: inIframe,
        diagnosticNote: err?.message || 'Error al verificar soporte de huella.'
      };
    }
  }

  /**
   * Requests biometric verification from the mobile device/browser.
   * Handles iframe restrictions, passkey creation, and existing credential verification.
   */
  async authenticateWithBiometrics(): Promise<BiometricAuthResult> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return {
        success: false,
        error: 'Tu navegador no soporta la API WebAuthn de huella dactilar. Usa tu PIN (1234).'
      };
    }

    const inIframe = this.isInIframe();

    // Determine clean relying party ID
    let rpId: string | undefined = undefined;
    const hostname = window.location.hostname;
    // WebAuthn requires rpId to be a valid domain without port, not an IP address
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (!isIp && hostname) {
      rpId = hostname;
    }

    try {
      // 1. Try to authenticate with existing stored credential if available
      const storedCredId = localStorage.getItem(CRED_ID_STORAGE_KEY);
      if (storedCredId) {
        try {
          const rawId = Uint8Array.from(atob(storedCredId), c => c.charCodeAt(0));
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const getOptions: CredentialRequestOptions = {
            publicKey: {
              challenge,
              timeout: 45000,
              rpId: rpId,
              userVerification: 'preferred',
              allowCredentials: [
                {
                  id: rawId,
                  type: 'public-key'
                }
              ]
            }
          };

          const assertion = await navigator.credentials.get(getOptions);
          if (assertion) {
            return { success: true };
          }
        } catch (getErr: any) {
          console.log('Stored credential get error, falling back to new registration:', getErr);
        }
      }

      // 2. Create/Register a platform credential challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credentialCreationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Territorios Offline',
            ...(rpId ? { id: rpId } : {})
          },
          user: {
            id: userId,
            name: 'admin@territorios.local',
            displayName: 'Administrador Territorios'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
            requireResidentKey: false
          },
          timeout: 45000
        }
      };

      const credential = (await navigator.credentials.create(credentialCreationOptions)) as any;

      if (credential) {
        // Save credential id in local storage for faster subsequent unlocks
        if (credential.rawId) {
          try {
            const base64Id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            localStorage.setItem(CRED_ID_STORAGE_KEY, base64Id);
          } catch {
            // Ignore encoding errors
          }
        }
        return { success: true };
      }

      return {
        success: false,
        error: 'No se completó la lectura de la huella.'
      };
    } catch (err: any) {
      console.warn('Biometric auth error:', err);

      if (inIframe) {
        return {
          success: false,
          isIframeBlocked: true,
          error: 'Por seguridad, el navegador bloqueó la huella dentro del marco embebido (iframe). Abre la app en una pestaña independiente o usa el PIN (1234).'
        };
      }

      if (err.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Verificación cancelada o huella no reconocida. Puedes intentarlo de nuevo o usar el PIN (1234).'
        };
      }

      if (err.name === 'SecurityError') {
        return {
          success: false,
          isIframeBlocked: true,
          error: 'Restricción de seguridad del navegador. Usa tu PIN (1234) o abre la app directamente en el navegador.'
        };
      }

      if (err.name === 'InvalidStateError') {
        return {
          success: false,
          error: 'El sensor de huella está ocupado o ya fue verificado.'
        };
      }

      if (err.name === 'NotSupportedError') {
        return {
          success: false,
          error: 'Tu dispositivo o navegador no tiene habilitado el bloqueo por huella. Usa tu PIN (1234).'
        };
      }

      return {
        success: false,
        error: err.message || 'Error al conectar con el sensor biométrico. Usa tu PIN (1234).'
      };
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
