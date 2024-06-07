import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeButtonsComponent } from './home-buttons.component';

describe('HomeButtonsComponent', () => {
  let component: HomeButtonsComponent;
  let fixture: ComponentFixture<HomeButtonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeButtonsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HomeButtonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
