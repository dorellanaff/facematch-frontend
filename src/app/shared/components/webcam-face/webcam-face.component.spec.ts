import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebcamFaceComponent } from './webcam-face.component';

describe('WebcamFaceComponent', () => {
  let component: WebcamFaceComponent;
  let fixture: ComponentFixture<WebcamFaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebcamFaceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WebcamFaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
