import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { MegaMenuComponent } from './mega-menu.component';

describe('MegaMenuComponent language changes', () => {
  it('updates category labels on EN/VI switches without recreating the menu', async () => {
    await TestBed.configureTestingModule({
      imports: [MegaMenuComponent],
      providers: [provideRouter([]), provideTranslateService()],
    }).compileComponents();
    const translation = TestBed.inject(TranslateService);
    translation.setTranslation('vi', { nav: { maritimeSafety: 'An toàn hàng hải' } });
    translation.setTranslation('en', { nav: { maritimeSafety: 'Maritime safety' } });
    translation.use('vi');
    const fixture = TestBed.createComponent(MegaMenuComponent);
    fixture.componentInstance.showMenu();
    fixture.detectChanges();
    const safety = () => fixture.nativeElement.querySelector('a[href="/courses/an-toan-hang-hai"]').textContent.trim();
    expect(safety()).toBe('An toàn hàng hải');
    translation.use('en');
    fixture.detectChanges();
    expect(safety()).toBe('Maritime safety');
    translation.use('vi');
    fixture.detectChanges();
    expect(safety()).toBe('An toàn hàng hải');
  });
});
