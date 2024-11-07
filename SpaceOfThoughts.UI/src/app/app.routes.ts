import { Routes } from '@angular/router';
import { CategoryListComponent } from './features/category/category-list/category-list.component';
import { AddCategoryComponent } from './features/category/add-category/add-category.component';
import { EditCategoryComponent } from './features/category/edit-category/edit-category.component';
import { BlogpostListComponent } from './features/blog-post/blogpost-list/blogpost-list.component';
import { AddBlogpostComponent } from './features/blog-post/add-blogpost/add-blogpost.component';
import { EditBlogpostComponent } from './features/blog-post/edit-blogpost/edit-blogpost.component';
import { PublicBlogSummeryComponent } from './features/public-data/public-blog-summery/public-blog-summery.component';
import { BlogDetailsComponent } from './features/public-data/blog-details/blog-details.component';
import { LoginComponent } from './features/auth/login/login.component';
import { CreateAccountComponent } from './features/auth/create-account/create-account.component';
import { authGuard } from './features/auth/guards/auth.guard';
import { UserListComponent } from './features/auth/user-list/user-list.component';
import { userAuthGuard } from './features/auth/guards/user-auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicBlogSummeryComponent, // Route for public blog summary
  },
  {
    path: 'create-account',
    component: CreateAccountComponent, // Route for creating a new account
  },
  {
    path: 'login',
    component: LoginComponent, // Route for user login
  },
  {
    path: 'blog/:url',
    component: BlogDetailsComponent, // Route for viewing blog details
    canActivate: [userAuthGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/categories',
    component: CategoryListComponent, // Route for listing categories in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/categories/add',
    component: AddCategoryComponent, // Route for adding a new category in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/categories/:id',
    component: EditCategoryComponent, // Route for editing a category in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts',
    component: BlogpostListComponent, // Route for listing blog posts in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts/add',
    component: AddBlogpostComponent, // Route for adding a new blog post in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/blogposts/:id',
    component: EditBlogpostComponent, // Route for editing a blog post in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
  {
    path: 'admin/users',
    component: UserListComponent, // Route for listing users in admin
    canActivate: [authGuard], // Guard to check if user is authorized
  },
];
