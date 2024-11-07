import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { Observable } from 'rxjs';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { StyleService } from '../../../../services/style.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-blog-details',
  standalone: true,
  imports: [CommonModule, DatePipe, MarkdownComponent, RouterModule],
  templateUrl: './blog-details.component.html',
  styleUrl: './blog-details.component.css',
})
export class BlogDetailsComponent implements OnInit {
  url: string | null = null; // URL handle of the blog post
  blogPost$?: Observable<BlogPost>; // Observable for the blog post
  isUp = false; // Flag to indicate if the view is scrolled up
  

  constructor(
    private route: ActivatedRoute, // Inject ActivatedRoute to access route parameters
    private blogPostService: BlogPostService, // Inject BlogPostService for blog post operations
  ) {}

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Subscribe to route parameters to get the URL handle of the blog post
    this.route.paramMap.subscribe({
      next: (params) => {
        this.url = params.get('url');
      },
    });

    // Fetch blog details by URL handle if the URL is available
    if (this.url) {
      this.blogPost$ = this.blogPostService.getBlogPostByUrlHandle(this.url);
    }
  }
}
