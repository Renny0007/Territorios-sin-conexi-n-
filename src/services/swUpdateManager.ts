type UpdateCallback = (hasUpdate: boolean) => void;

class SWUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateCallbacks: Set<UpdateCallback> = new Set();
  private hasPendingUpdate = false;
  private checkIntervalId: number | null = null;

  init(): void {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      window.addEventListener('load', () => {
        // updateViaCache: 'none' guarantees the browser checks the server for sw.js byte changes
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            this.registration = reg;

            // Check if there is already a waiting worker from a previous background download
            if (reg.waiting) {
              this.hasPendingUpdate = true;
              this.notify();
            }

            // Listen for newly found updates
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.hasPendingUpdate = true;
                    this.notify();
                  }
                });
              }
            });

            // Set up background periodic update checking every 3 minutes
            this.checkIntervalId = window.setInterval(() => {
              this.checkForUpdates();
            }, 3 * 60 * 1000);
          })
          .catch((err) => {
            console.warn('SW registration info:', err);
          });

        // Trigger update checks when returning to app or network comes online
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkForUpdates();
          }
        });

        window.addEventListener('focus', () => {
          this.checkForUpdates();
        });

        window.addEventListener('online', () => {
          this.checkForUpdates();
        });

        // Reload page once new worker activates
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      });
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (this.registration) {
      try {
        await this.registration.update();
        if (this.registration.waiting) {
          this.hasPendingUpdate = true;
          this.notify();
          return true;
        }
      } catch (err) {
        console.log('Update check error:', err);
      }
    }
    return this.hasPendingUpdate;
  }

  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    callback(this.hasPendingUpdate);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  private notify(): void {
    this.updateCallbacks.forEach((cb) => cb(this.hasPendingUpdate));
  }

  applyUpdate(): void {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }
}

export const swUpdateManager = new SWUpdateManager();
