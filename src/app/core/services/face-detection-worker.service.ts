import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionWorkerService {
  private worker: Worker;

  constructor() {
    // Assuming my-worker.worker.ts is in the same directory
    this.worker = new Worker(new URL('../workers/face-detection.worker', import.meta.url));
  }

  calculateFactorial(number: number): Promise<number> {
    return new Promise((resolve, reject) => {
        this.worker.postMessage(number);
        this.worker.onmessage = (event: MessageEvent) => {
            resolve(event.data);
        };
        this.worker.onerror = (error) => {
            reject(error);
        };
    });
  }
}

