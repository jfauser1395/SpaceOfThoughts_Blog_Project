import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  HostListener,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';
import { User } from '../../features/auth/models/user.model';
import { Subscription } from 'rxjs';

declare global {
  interface Window {
    bootstrap?: {
      Collapse?: {
        getOrCreateInstance: (
          element: Element,
          config?: { toggle?: boolean },
        ) => { hide: () => void };
      };
    };
  }
}

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  user?: User; // Holds the current user information
  isSmallScreen = false; // Flag to check if the screen size is small
  isMediumScreen = false; // Flag to check if the screen size is medium
  searchExpanded = false; // Flag to check if the search bar is expanded
  navBarExpanded = false; // Flag to check if the navbar is expanded
  brandLinkColorReset = false; // Temporarily remove focus color after pointer navigation
  // Avatar framing limits mirror the values accepted by the profile editor
  private readonly defaultAvatarPosition = '50% 50% 100%';
  private readonly defaultAvatarZoom = 100;
  private readonly minimumAvatarZoom = 85;
  private readonly maximumAvatarZoom = 170;
  private userSubscription?: Subscription; // Subscription for user authentication changes
  @ViewChild('searchInput') searchInput!: ElementRef; // Reference to the search input element

  constructor(
    private authService: AuthService, // Inject AuthService for authentication
    private router: Router, // Inject Router for navigation
  ) {}

  ngOnInit(): void {
    // Subscribe to user authentication changes
    this.userSubscription = this.authService.user().subscribe({
      next: (response) => {
        this.user = response;
      },
    });

    // Get the currently authenticated user
    this.user = this.authService.getUser();

    // Check the screen size
    this.checkScreenSize();
  }

  // Log out the user and navigate to the home page
  onLogout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
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
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.checkScreenSize();
  }

  // Check screen size to set flags for responsive behavior
  checkScreenSize() {
    const width = window.innerWidth;
    this.isSmallScreen = width < 576;
    this.isMediumScreen = width < 992;
  }

  // Monitor the navbar toggle state
  navToggled() {
    this.navBarExpanded = !this.navBarExpanded;
  }

  // Collapse mobile navigation and clear pointer-only focus styling on brand navigation
  onBrandClick(event: MouseEvent): void {
    this.collapseNavbar();

    if (event.detail > 0) {
      this.brandLinkColorReset = true;
      (event.currentTarget as HTMLElement | null)?.blur();
    }
  }

  // Restore normal brand focus styling after the click transition completes
  resetBrandLinkColor(): void {
    this.brandLinkColorReset = false;
  }

  // Close Bootstrap navigation through its API with a DOM fallback when unavailable
  collapseNavbar(): void {
    const navbar = document.getElementById('navbarSupportedContent');
    const navbarToggler =
      document.querySelector<HTMLElement>('.navbar-toggler');

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
    this.navBarExpanded = false;
  }

  // Toggle the search bar state and handle navbar collapse if necessary
  toggleSearchBar(query: string) {
    const wasExpanded = this.searchExpanded;
    this.searchExpanded = !this.searchExpanded;

    // If the search bar is expanded, collapse the navbar
    if (this.navBarExpanded) {
      const navbarToggler = document.querySelector('.navbar-toggler');
      if (navbarToggler) {
        navbarToggler.classList.toggle('collapsed');
      }
      const navbar = document.getElementById('navbarSupportedContent');
      if (navbar && navbar.classList.contains('show')) {
        navbar.classList.remove('show');
      }
      this.navBarExpanded = false;
    }

    if (wasExpanded && query.trim()) {
      this.submitSearch(query);
    }
  }

  // Collapse the search bar and clear the search input
  collapseSearch(query: string) {
    this.searchExpanded = false;
    this.searchInput.nativeElement.value = '';
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
