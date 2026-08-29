import { GPSState } from '../types';

type GPSListener = (state: GPSState) => void;

class GPSService {
  private watchId: number | null = null;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private listeners: Set<GPSListener> = new Set();
  private currentState: GPSState = {
    active: false,
    latitude: null,
    longitude: null,
    accuracy: null,
    altitude: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    simulated: false
  };

  private simulationInterval: number | null = null;

  getState(): GPSState {
    return { ...this.currentState };
  }

  subscribe(listener: GPSListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.currentState }));
  }

  startTracking(onPermissionError?: () => void): void {
    if (this.currentState.active && this.watchId !== null) return;

    if (!('geolocation' in navigator)) {
      this.currentState = {
        ...this.currentState,
        active: false,
        error: 'Geolocalización no soportada en este navegador'
      };
      this.notify();
      return;
    }

    this.currentState = {
      ...this.currentState,
      active: true,
      error: null
    };
    this.notify();

    // 1. Immediate single-shot fetch for rapid map centering
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePositionUpdate(position);
      },
      (err) => {
        console.warn('Initial fast GPS fetch warning:', err.message);
        // If high-accuracy times out, retry immediate fetch with low accuracy
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (pos) => this.handlePositionUpdate(pos),
            () => {},
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );

    // 2. Start continuous geolocation watcher
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000
    };

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.handlePositionUpdate(position);
        },
        (err) => {
          let msg = 'Error obteniendo posición GPS';
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'Permiso de ubicación denegado por el usuario';
            if (onPermissionError) onPermissionError();
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Señal GPS no disponible temporalmente';
          } else if (err.code === err.TIMEOUT) {
            msg = 'Buscando señal GPS...';
          }

          this.currentState = {
            ...this.currentState,
            error: msg
          };
          this.notify();
        },
        options
      );
    } catch (e) {
      console.error('Error starting watchPosition:', e);
    }

    // Setup device orientation for tactical compass
    this.initCompass();
  }

  private handlePositionUpdate(position: GeolocationPosition) {
    this.currentState = {
      active: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading !== null && !isNaN(position.coords.heading) 
        ? position.coords.heading 
        : this.currentState.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
      error: null,
      simulated: false
    };
    this.notify();
  }

  private initCompass() {
    if (window.DeviceOrientationEvent) {
      this.orientationListener = (event: DeviceOrientationEvent) => {
        let compassHeading: number | null = null;
        
        // iOS WebKit
        if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
          compassHeading = (event as any).webkitCompassHeading;
        } else if (event.alpha !== null && event.absolute) {
          // Android standard absolute
          compassHeading = 360 - event.alpha;
        }

        if (compassHeading !== null && !isNaN(compassHeading)) {
          this.currentState = {
            ...this.currentState,
            heading: Math.round(compassHeading)
          };
          this.notify();
        }
      };

      try {
        window.addEventListener('deviceorientationabsolute', this.orientationListener as any, true);
      } catch {
        window.addEventListener('deviceorientation', this.orientationListener, true);
      }
    }
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.orientationListener) {
      window.removeEventListener('deviceorientationabsolute', this.orientationListener as any, true);
      window.removeEventListener('deviceorientation', this.orientationListener, true);
      this.orientationListener = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.currentState = {
      ...this.currentState,
      active: false,
      error: null
    };
    this.notify();
  }

  // Simulated GPS for testing or demo in areas without GPS
  startSimulation(centerLat = 18.48517, centerLng = -69.30083): void {
    this.stopTracking();

    this.currentState = {
      active: true,
      latitude: centerLat,
      longitude: centerLng,
      accuracy: 3.5,
      altitude: 650,
      heading: 45,
      speed: 1.3, // ~4.7 km/h walking speed
      timestamp: Date.now(),
      error: null,
      simulated: true
    };
    this.notify();

    let step = 0;
    this.simulationInterval = window.setInterval(() => {
      step += 0.05;
      const dLat = Math.sin(step) * 0.00015;
      const dLng = Math.cos(step) * 0.0002;
      const heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

      this.currentState = {
        active: true,
        latitude: centerLat + dLat,
        longitude: centerLng + dLng,
        accuracy: 2.8 + Math.random() * 2,
        altitude: 650 + Math.sin(step) * 5,
        heading: Math.round(heading),
        speed: 1.2 + Math.random() * 0.3,
        timestamp: Date.now(),
        error: null,
        simulated: true
      };
      this.notify();
    }, 1500);
  }
}

export const gpsService = new GPSService();
