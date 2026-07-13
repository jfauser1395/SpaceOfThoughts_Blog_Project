import { Routes } from '@angular/router';
import { CoverPageComponent } from './features/cover-page/cover-page/cover-page.component';
import { authGuard } from './features/auth/guards/auth.guard';
import { userAuthGuard } from './features/auth/guards/user-auth.guard';

export const routes: Routes = [
  // Keep the primary cover page eager and lazy-load secondary public page bundles
  {
    path: '',
    component: CoverPageComponent, // Primary landing page is loaded eagerly
  },
  {
    path: 'blogs',
    loadComponent: () =>
      import('./features/public-data/public-blog-summery/public-blog-summery.component').then(
        (component) => component.PublicBlogSummeryComponent,
      ), // Route for public blog summary
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about-page/about-page.component').then(
        (component) => component.AboutPageComponent,
      ), // Route for static about page
  },
  {
    path: 'create-account',
    loadComponent: () =>
      import('./features/auth/create-account/create-account.component').then(
        (component) => component.CreateAccountComponent,
      ), // Route for creating a new account
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (component) => component.LoginComponent,
      ), // Route for user login
  },
  {
    path: 'blog/:url',
    loadComponent: () =>
      import('./features/public-data/blog-details/blog-details.component').then(
        (component) => component.BlogDetailsComponent,
      ), // Route for viewing blog details
  },
  // Require a signed-in user before loading personal profile code
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/auth/profile/profile.component').then(
        (component) => component.ProfileComponent,
      ), // Route for viewing and editing the current user's profile
    canActivate: [userAuthGuard],
  },
  // Keep administrative page bundles lazy and protect every entry point
  {
    path: 'admin/categories',
    loadComponent: () =>
      import('./features/category/category-list/category-list.component').then(
        (component) => component.CategoryListComponent,
      ), // Route for listing categories in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/categories/add',
    loadComponent: () =>
      import('./features/category/add-category/add-category.component').then(
        (component) => component.AddCategoryComponent,
      ), // Route for adding a new category in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/categories/:id',
    loadComponent: () =>
      import('./features/category/edit-category/edit-category.component').then(
        (component) => component.EditCategoryComponent,
      ), // Route for editing a category in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts',
    loadComponent: () =>
      import('./features/blog-post/blogpost-list/blogpost-list.component').then(
        (component) => component.BlogpostListComponent,
      ), // Route for listing blog posts in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/cover-page',
    loadComponent: () =>
      import('./features/cover-page/edit-cover-page/edit-cover-page.component').then(
        (component) => component.EditCoverPageComponent,
      ), // Route for editing the cover page
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/about-page',
    loadComponent: () =>
      import('./features/about/edit-about-page/edit-about-page.component').then(
        (component) => component.EditAboutPageComponent,
      ), // Route for editing the about page
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogs-page',
    loadComponent: () =>
      import('./features/public-data/edit-blog-summary-page/edit-blog-summary-page.component').then(
        (component) => component.EditBlogSummaryPageComponent,
      ), // Route for editing the public blogs page
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts/add',
    loadComponent: () =>
      import('./features/blog-post/add-blogpost/add-blogpost.component').then(
        (component) => component.AddBlogpostComponent,
      ), // Route for adding a new blog post in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts/:id',
    loadComponent: () =>
      import('./features/blog-post/edit-blogpost/edit-blogpost.component').then(
        (component) => component.EditBlogpostComponent,
      ), // Route for editing a blog post in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/auth/user-list/user-list.component').then(
        (component) => component.UserListComponent,
      ), // Route for listing users in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
];
