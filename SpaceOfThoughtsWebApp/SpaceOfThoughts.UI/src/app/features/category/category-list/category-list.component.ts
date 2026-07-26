import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category.model';
import { Observable, of, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-category-list',
  imports: [RouterModule, CommonModule],
  templateUrl: './category-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './category-list.component.css',
})
export class CategoryListComponent implements OnInit, OnDestroy {
  categories$?: Observable<Category[]>; // Observable for the list of categories
  categoryQuant$?: Subscription; // Subscription for getting the total category count
  categoriesSubscription$?: Subscription; // Subscription for getting category rows
  totalCount!: number; // Total number of categories
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 8; // Number of categories per page
  query = ''; // Current search query
  sortedBy = ''; // Current sorted column
  sortDirection: 'asc' | 'desc' = 'asc'; // Current sort direction
  private allCategories: Category[] = [];

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
        this.categoriesSubscription$ = this.categoryService
          .getAllCategories(
            undefined,
            undefined,
            undefined,
            1,
            Math.max(value, this.pageSize),
          )
          .subscribe({
            next: (categories) => {
              this.allCategories = categories;
              this.loadCategories();
            },
          });
      },
    });
  }

  // Search for categories by query
  onSearch(query: string) {
    this.query = query.trim();
    this.pageNumber = 1;
    this.loadCategories();
  }

  // Sort the category list
  sort(sortBy: string) {
    if (this.sortedBy === sortBy) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortedBy = sortBy;
      this.sortDirection = 'asc';
    }

    this.pageNumber = 1;
    this.loadCategories();
  }

  // Check whether a table column owns the active sort state
  isSortedBy(sortBy: string): boolean {
    return this.sortedBy === sortBy;
  }

  // Expose the active direction for accessible sortable table headers
  getSortAria(sortBy: string): 'ascending' | 'descending' | null {
    if (!this.isSortedBy(sortBy)) {
      return null;
    }

    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  // Describe the direction that clicking a sortable header will apply next
  getSortLabel(label: string, sortBy: string): string {
    const nextDirection =
      this.isSortedBy(sortBy) && this.sortDirection === 'asc'
        ? 'descending'
        : 'ascending';

    return `Sort ${label} ${nextDirection}`;
  }

  // Get a specific page of categories
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.loadCategories();
  }

  // Get the next page of categories
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.loadCategories();
  }

  // Get the previous page of categories
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.loadCategories();
  }

  // Apply search, sorting, and pagination to the cached category collection
  private loadCategories(): void {
    let categories = [...this.allCategories];
    const normalizedQuery = this.query.toLowerCase();

    if (normalizedQuery) {
      categories = categories.filter((category) =>
        category.name.toLowerCase().includes(normalizedQuery),
      );
    }

    if (this.sortedBy) {
      categories.sort((first, second) => {
        const firstValue = this.getSortValue(first, this.sortedBy);
        const secondValue = this.getSortValue(second, this.sortedBy);
        const result = firstValue.localeCompare(secondValue);

        return this.sortDirection === 'asc' ? result : -result;
      });
    }

    this.totalCount = categories.length;
    this.list = new Array(Math.ceil(this.totalCount / this.pageSize));

    if (this.pageNumber > this.list.length && this.list.length > 0) {
      this.pageNumber = this.list.length;
    }

    const skip = (this.pageNumber - 1) * this.pageSize;
    this.categories$ = of(categories.slice(skip, skip + this.pageSize));
  }

  // Normalize category fields before comparing values in the active sort column
  private getSortValue(category: Category, sortBy: string): string {
    if (sortBy === 'urlHandle') {
      return category.urlHandle.toLowerCase();
    }

    return category.name.toLowerCase();
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.categoryQuant$?.unsubscribe();
    this.categoriesSubscription$?.unsubscribe();
  }
}
