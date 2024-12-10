import { Component, ElementRef, inject, OnInit, ViewChild, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';
import { User } from '../../features/auth/models/user.model';
import { PublicBlogSummeryComponent } from '../../features/public-data/public-blog-summery/public-blog-summery.component';
import { Subscription } from 'rxjs';
import { BlogPostService } from '../../features/blog-post/services/blog-post.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, PublicBlogSummeryComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  user?: User; // Holds the current user information
  userName: string = ''; // Stores the username derived from the user's email
  isSmallScreen = false; // Flag to check if the screen size is small
  isMediumScreen = false; // Flag to check if the screen size is medium
  searchExpanded = false; // Flag to check if the search bar is expanded
  navBarExpanded = false; // Flag to check if the navbar is expanded
  private userSubscription?: Subscription; // Subscription for user authentication changes
  blogPostService = inject(BlogPostService); // Inject BlogPostService to be used in the HTML
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
        if (this.user) {
          this.userName = this.user.email.split('@')[0]; // Extract username from email
        }
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

  // Toggle the search bar state and handle navbar collapse if necessary
  toggleSearchBar(query: string) {
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

    this.blogPostService.navSort.next(query); // Trigger the search with the query
  }

  // Collapse the search bar and clear the search input
  collapseSearch(query: string) {
    this.searchExpanded = false;
    this.searchInput.nativeElement.value = '';
    this.blogPostService.navSort.next(query); // Trigger the search with the query
  }

  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }
}
