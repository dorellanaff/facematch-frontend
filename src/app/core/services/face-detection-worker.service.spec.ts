import { TestBed } from '@angular/core/testing';

import { FaceDetectionWorkerService } from './face-detection-worker.service';

describe('FaceDetectionWorkerService', () => {
  let service: FaceDetectionWorkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceDetectionWorkerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
