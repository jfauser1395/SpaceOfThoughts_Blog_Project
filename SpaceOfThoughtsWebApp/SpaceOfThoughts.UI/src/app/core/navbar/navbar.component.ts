import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';
import { User } from '../../features/auth/models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Navbar signals notify the OnPush view about authentication and responsive state
  readonly user = signal<User | undefined>(undefined); // Holds the current user information
  readonly isSmallScreen = signal(false); // Flag to check if the screen size is small
  readonly isMediumScreen = signal(false); // Flag to check if the screen size is medium
  readonly searchExpanded = signal(false); // Flag to check if the search bar is expanded
  readonly navBarExpanded = signal(false); // Flag to check if the navbar is expanded
  readonly isPageInteractionLocked = signal(false); // Keeps routed content inert while mobile navigation is moving
  readonly brandLinkColorReset = signal(false); // Temporarily remove focus color after pointer navigation
  // Avatar framing limits mirror the values accepted by the profile editor
  private readonly defaultAvatarPosition = '50% 50% 100%';
  private readonly defaultAvatarZoom = 100;
  private readonly minimumAvatarZoom = 85;
  private readonly maximumAvatarZoom = 170;
  private userSubscription?: Subscription; // Subscription for user authentication changes
  private pageUnlockTimeoutId?: number;
  private readonly mobileSearchInput =
    viewChild<ElementRef<HTMLInputElement>>('mobileSearchInput');
  private readonly mobileSearchToggle =
    viewChild<ElementRef<HTMLElement>>('mobileSearchToggle');
  readonly searchInput = viewChild.required<ElementRef>('searchInput');

  ngOnInit(): void {
    // Subscribe to user authentication changes
    this.userSubscription = this.authService.user().subscribe({
      next: (response) => {
        this.user.set(response);
      },
    });

    // Get the currently authenticated user
    this.user.set(this.authService.getUser());

    // Check the screen size
    this.checkScreenSize();
  }

  // Return a stable fallback initial when a user has no profile image
  getUserInitial(user?: User): string {
    const userName = user?.userName?.trim();
    return userName ? userName.charAt(0).toUpperCase() : '?';
  }

  // Convert the stored avatar framing value into a CSS object-position
  getProfileImagePosition(user?: User): string {
    const position = this.parseAvatarPosition(user?.profileImagePosition);
    return `${position.x}% ${position.y}%`;
  }

  // Expose the normalized avatar zoom for template sizing
  getProfileImageZoom(user?: User): number {
    return this.parseAvatarPosition(user?.profileImagePosition).zoom;
  }

  // Translate a zoomed avatar so its selected focal point remains centered
  getProfileImageTransform(user?: User): string {
    return this.getAvatarTransformFromPosition(user?.profileImagePosition);
  }

  // Check the screen size dynamically
  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  // Close the expanded mobile search after a click outside its controls
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isSmallScreen() || !this.searchExpanded()) {
      return;
    }

    const clickedElement = event.target as Node | null;

    if (!clickedElement) {
      return;
    }

    const clickedInput =
      this.mobileSearchInput()?.nativeElement.contains(clickedElement) ?? false;
    const clickedToggle =
      this.mobileSearchToggle()?.nativeElement.contains(clickedElement) ??
      false;

    if (!clickedInput && !clickedToggle) {
      this.searchExpanded.set(false);
    }
  }

  // Check screen size to set flags for responsive behavior
  checkScreenSize(): void {
    const width = window.innerWidth;
    this.isSmallScreen.set(width < 576);
    this.isMediumScreen.set(width < 992);

    if (!this.isMediumScreen()) {
      this.navBarExpanded.set(false);
      this.unlockPageInteraction();
    }
  }

  // Monitor the navbar toggle state
  navToggled(): void {
    this.navBarExpanded.update((expanded) => !expanded);

    if (this.navBarExpanded() && this.isMediumScreen()) {
      this.lockPageInteraction();
    } else {
      this.unlockPageInteraction(true);
    }
  }

  // Collapse mobile navigation and clear pointer-only focus styling on brand navigation
  onBrandClick(event: MouseEvent): void {
    this.collapseNavbar();

    if (event.detail > 0) {
      this.brandLinkColorReset.set(true);
      (event.currentTarget as HTMLElement | null)?.blur();
    }
  }

  // Restore normal brand focus styling after the click transition completes
  resetBrandLinkColor(): void {
    this.brandLinkColorReset.set(false);
  }

  // Close Bootstrap navigation through its API with a DOM fallback when unavailable
  collapseNavbar(): void {
    const navbar = document.getElementById('navbarSupportedContent');
    const navbarToggler =
      document.querySelector<HTMLElement>('.navbar-toggler');
    const wasExpanded =
      this.navBarExpanded() ||
      !!navbar?.classList.contains('show') ||
      !!navbar?.classList.contains('collapsing');

    if (navbar?.classList.contains('show')) {
      const collapse = window.bootstrap?.Collapse?.getOrCreateInstance(navbar, {
        toggle: false,
      });

      if (collapse) {
        collapse.hide();
      } else {
        navbar.classList.remove('show');
      }
    }

    navbarToggler?.classList.add('collapsed');
    navbarToggler?.setAttribute('aria-expanded', 'false');
    this.navBarExpanded.set(false);
    this.unlockPageInteraction(wasExpanded && this.isMediumScreen());
  }

  // Toggle the search bar state and handle navbar collapse if necessary
  toggleSearchBar(query: string): void {
    const wasExpanded = this.searchExpanded();
    this.searchExpanded.update((expanded) => !expanded);

    // If the search bar is expanded, collapse the navbar
    if (this.navBarExpanded()) {
      this.collapseNavbar();
    }

    if (wasExpanded && query.trim()) {
      this.submitSearch(query);
    }
  }

  // Collapse the search bar and clear the search input
  collapseSearch(query: string): void {
    this.searchExpanded.set(false);
    this.searchInput().nativeElement.value = '';
    this.submitSearch(query);
  }

  // Navigate to the public blogs route with an optional normalized search query
  submitSearch(query: string): void {
    const searchQuery = query.trim();

    this.router.navigate(['/blogs'], {
      queryParams: searchQuery ? { query: searchQuery } : {},
    });
  }

  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.unlockPageInteraction();
  }

  // Prevent pointer, keyboard, and scroll interaction with routed content under mobile navigation
  private lockPageInteraction(): void {
    if (this.pageUnlockTimeoutId !== undefined) {
      window.clearTimeout(this.pageUnlockTimeoutId);
      this.pageUnlockTimeoutId = undefined;
    }

    this.applyPageInteractionLock(true);
  }

  // Keep the page locked until Bootstrap's collapse animation has fully retracted
  private unlockPageInteraction(afterCollapse = false): void {
    if (this.pageUnlockTimeoutId !== undefined) {
      window.clearTimeout(this.pageUnlockTimeoutId);
      this.pageUnlockTimeoutId = undefined;
    }

    if (afterCollapse) {
      this.pageUnlockTimeoutId = window.setTimeout(() => {
        this.pageUnlockTimeoutId = undefined;
        this.applyPageInteractionLock(false);
      }, 360);
      return;
    }

    this.applyPageInteractionLock(false);
  }

  // Native inert handles focus and clicks while the body class prevents background scrolling
  private applyPageInteractionLock(locked: boolean): void {
    this.isPageInteractionLocked.set(locked);
    document.body.classList.toggle('mobile-navbar-open', locked);
    document.getElementById('main-content')?.toggleAttribute('inert', locked);
  }

  // Calculate the translation required to preserve a focal point at the selected zoom
  private getAvatarTransformFromPosition(position?: string | null): string {
    const avatarPosition = this.parseAvatarPosition(position);
    const maxOffset = Math.max(
      0,
      ((avatarPosition.zoom - 100) / (2 * avatarPosition.zoom)) * 100,
    );
    const offsetX = (((50 - avatarPosition.x) / 50) * maxOffset).toFixed(2);
    const offsetY = (((50 - avatarPosition.y) / 50) * maxOffset).toFixed(2);

    return `translate(${offsetX}%, ${offsetY}%)`;
  }

  // Parse persisted avatar framing and apply safe defaults for malformed values
  private parseAvatarPosition(position?: string | null): {
    x: number;
    y: number;
    zoom: number;
  } {
    const [xText, yText, zoomText] = (
      position ?? this.defaultAvatarPosition
    ).split(' ');
    const x = this.parsePercent(xText);
    const y = this.parsePercent(yText);
    const zoom = this.parseZoom(zoomText);

    return { x, y, zoom };
  }

  // Clamp avatar focal-point coordinates to the visible percentage range
  private parsePercent(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));

    if (Number.isNaN(parsed)) {
      return 50;
    }

    return Math.min(100, Math.max(0, parsed));
  }

  // Clamp avatar zoom to the range supported by the profile controls
  private parseZoom(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));

    if (Number.isNaN(parsed)) {
      return this.defaultAvatarZoom;
    }

    return Math.min(
      this.maximumAvatarZoom,
      Math.max(this.minimumAvatarZoom, Math.round(parsed)),
    );
  }
}
