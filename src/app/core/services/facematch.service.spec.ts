import { TestBed } from '@angular/core/testing';

import { FacematchService } from './facematch.service';

describe('FacematchService', () => {
  let service: FacematchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FacematchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
