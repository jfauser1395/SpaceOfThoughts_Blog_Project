import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicBlogSummeryComponent } from './public-blog-summery.component';

describe('PublicBlogSummeryComponent', () => {
  let component: PublicBlogSummeryComponent;
  let fixture: ComponentFixture<PublicBlogSummeryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicBlogSummeryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PublicBlogSummeryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
