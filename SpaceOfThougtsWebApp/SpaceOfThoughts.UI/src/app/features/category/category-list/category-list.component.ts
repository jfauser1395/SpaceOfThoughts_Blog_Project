import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category.model';
import { Observable, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.css',
})
export class CategoryListComponent implements OnInit, OnDestroy {
  categories$?: Observable<Category[]>; // Observable for the list of categories
  categoryQuant$?: Subscription; // Subscription for getting the total category count
  totalCount!: number; // Total number of categories
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 4; // Number of categories per page

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
     // Scroll to the top of the page smoothly on component initialization
     window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
    
    // Get the total category count
    this.categoryQuant$ = this.categoryService.getCategoryCount().subscribe({
      next: (value) => {
        this.totalCount = value;
        this.list = new Array(Math.ceil(value / this.pageSize));
        // Get all categories from the API
        this.categories$ = this.categoryService.getAllCategories(
          undefined,
          undefined,
          undefined,
          this.pageNumber,
          this.pageSize,
        );
      },
    });
  }

  // Search for categories by query
  onSearch(query: string) {
    this.categories$ = this.categoryService.getAllCategories(query);
  }

  // Sort the category list
  sort(sortBy: string, sortDirection: string) {
    this.categories$ = this.categoryService.getAllCategories(
      undefined,
      sortBy,
      sortDirection,
    );
  }

  // Get a specific page of categories
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.categories$ = this.categoryService.getAllCategories(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the next page of categories
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.categories$ = this.categoryService.getAllCategories(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the previous page of categories
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.categories$ = this.categoryService.getAllCategories(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.categoryQuant$?.unsubscribe();
  }
}
