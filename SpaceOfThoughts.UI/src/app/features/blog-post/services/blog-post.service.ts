import { Injectable } from '@angular/core';
import { AddBlogPost } from '../models/add-blog-post.model';
import { Observable, Subject } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { UpdateBlogPost } from '../models/update-blog-post.model';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root', // This service will be provided at the root level
})
export class BlogPostService {
  constructor(private http: HttpClient) {}

  // Create a new blog post
  createBlogPost(data: AddBlogPost): Observable<BlogPost> {
    return this.http.post<BlogPost>(
      `${environment.apiBaseUrl}/api/Blogposts?addAuth=true`,
      data,
    );
  }

  // Get all blog posts with optional filtering, sorting, and pagination
  getAllBlogPosts(
    query?: string,
    sortBy?: string,
    sortDirection?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Observable<BlogPost[]> {
    let params = new HttpParams();
    if (query) {
      params = params.set('query', query);
    }
    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }
    if (pageNumber) {
      params = params.set('pageNumber', pageNumber);
    }
    if (pageSize) {
      params = params.set('pageSize', pageSize);
    }
    return this.http.get<BlogPost[]>(
      `${environment.apiBaseUrl}/api/Blogposts`,
      { params: params },
    );
  }

  // Check if there are no images in any blog posts
  checkIfImagesEmpty(): Observable<boolean> {
    return this.getAllBlogPosts().pipe(map((blogs) => blogs.length === 0));
  }

  // Get the total count of blog posts
  getBlogPostCount(): Observable<number> {
    return this.http.get<number>(
      `${environment.apiBaseUrl}/api/BlogPosts/count`,
    );
  }

  // Get a single blog post by its ID
  getBlogPostById(id: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(
      `${environment.apiBaseUrl}/api/Blogposts/${id}`,
    );
  }

  // Subject to enable sorting functionality across components
  navSort = new Subject<string>();

  // Get a single blog post by its URL handle
  getBlogPostByUrlHandle(urlHandle: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(
      `${environment.apiBaseUrl}/api/Blogposts/${urlHandle}`,
    );
  }

  // Update an existing blog post
  updateBlogPost(
    id: string,
    updateBlogPost: UpdateBlogPost,
  ): Observable<BlogPost> {
    return this.http.put<BlogPost>(
      `${environment.apiBaseUrl}/api/Blogposts/${id}?addAuth=true`,
      updateBlogPost,
    );
  }

  // Delete a blog post by its ID
  deleteBlogPost(id: string): Observable<BlogPost> {
    return this.http.delete<BlogPost>(
      `${environment.apiBaseUrl}/api/blogposts/${id}?addAuth=true`,
    );
  }
}
