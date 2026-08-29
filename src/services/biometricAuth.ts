/**
 * Biometric Authentication Service
 * Utilizes standard WebAuthn / Passkeys APIs (navigator.credentials) to verify
 * biometric identity (Fingerprint / TouchID / FaceID) on mobile phones & supported browsers.
 * 
 * Complies strictly with zero biometric storage constraints:
 * No fingerprint/biometric data is stored in the app or sent to any server.
 */

export interface BiometricStatus {
  isSupported: boolean;
  platformAuthenticatorAvailable: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

class BiometricAuthService {
  private isCheckingSupported = false;

  /**
   * Check if standard WebAuthn platform authenticator is available in the current browser/device.
   */
  async checkBiometricSupport(): Promise<BiometricStatus> {
    if (typeof window === 'undefined') {
      return { isSupported: false, platformAuthenticatorAvailable: false };
    }

    const hasCredentials = !!window.PublicKeyCredential && !!navigator.credentials;
    if (!hasCredentials) {
      return { isSupported: false, platformAuthenticatorAvailable: false };
    }

    try {
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return {
          isSupported: true,
          platformAuthenticatorAvailable: available
        };
      }
      return { isSupported: true, platformAuthenticatorAvailable: false };
    } catch {
      return { isSupported: false, platformAuthenticatorAvailable: false };
    }
  }

  /**
   * Requests real biometric verification from the mobile device/browser
   * using standard WebAuthn challenge creation or credential getter.
   */
  async authenticateWithBiometrics(): Promise<BiometricAuthResult> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return {
        success: false,
        error: 'Tu navegador o dispositivo no soporta la API WebAuthn de autenticación biométrica.'
      };
    }

    try {
      // Generate a cryptographic random challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      // WebAuthn request configured specifically for platform biometric authenticators (fingerprint / face ID)
      const credentialCreationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Territorios Offline Admin',
            id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
          },
          user: {
            id: userId,
            name: 'admin@territorios.local',
            displayName: 'Administrador de Territorios'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Strictly use the device's native fingerprint/face biometric sensor
            userVerification: 'required',        // Mandate user verification (Biometrics / device PIN)
            requireResidentKey: false
          },
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.create(credentialCreationOptions);

      if (credential) {
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Autenticación biométrica cancelada o no completada.'
        };
      }
    } catch (err: any) {
      console.warn('Biometric auth error or cancelled:', err);

      if (err.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Autenticación cancelada por el usuario o no se detectó la huella/rostro.'
        };
      }

      if (err.name === 'InvalidStateError') {
        return {
          success: false,
          error: 'El sensor biométrico ya está en uso o no respondió.'
        };
      }

      if (err.name === 'NotSupportedError') {
        return {
          success: false,
          error: 'El sensor biométrico no está habilitado o configurado en este teléfono.'
        };
      }

      return {
        success: false,
        error: err.message || 'Error durante la autenticación biométrica.'
      };
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
