import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-category-list',
  imports: [RouterModule],
  templateUrl: './category-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './category-list.component.css',
})
export class CategoryListComponent implements OnInit, OnDestroy {
  private readonly categoryService = inject(CategoryService);

  categoryQuant$?: Subscription; // Subscription for getting the total category count
  categoriesSubscription$?: Subscription; // Subscription for getting category rows
  readonly pageNumber = signal(1); // Current page number
  readonly pageSize = 8; // Number of categories per page
  readonly query = signal(''); // Current search query
  readonly sortedBy = signal(''); // Current sorted column
  readonly sortDirection = signal<'asc' | 'desc'>('asc'); // Current sort direction
  private readonly allCategories = signal<Category[]>([]);

  // Derive sorted rows and pagination once per relevant signal update
  private readonly matchingCategories = computed(() => {
    const normalizedQuery = this.query().toLowerCase();
    const sortedBy = this.sortedBy();
    const sortDirection = this.sortDirection();
    let categories = [...this.allCategories()];

    if (normalizedQuery) {
      categories = categories.filter((category) =>
        category.name.toLowerCase().includes(normalizedQuery),
      );
    }

    if (sortedBy) {
      categories.sort((first, second) => {
        const firstValue = this.getSortValue(first, sortedBy);
        const secondValue = this.getSortValue(second, sortedBy);
        const result = firstValue.localeCompare(secondValue);
        return sortDirection === 'asc' ? result : -result;
      });
    }

    return categories;
  });
  readonly totalCount = computed(() => this.matchingCategories().length);
  readonly list = computed(
    () => new Array(Math.ceil(this.totalCount() / this.pageSize)),
  );
  readonly categories = computed(() => {
    const skip = (this.pageNumber() - 1) * this.pageSize;
    return this.matchingCategories().slice(skip, skip + this.pageSize);
  });

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
              this.allCategories.set(categories);
            },
          });
      },
    });
  }

  // Search for categories by query
  onSearch(query: string): void {
    this.query.set(query.trim());
    this.pageNumber.set(1);
  }

  // Sort the category list
  sort(sortBy: string): void {
    if (this.sortedBy() === sortBy) {
      this.sortDirection.update((direction) =>
        direction === 'asc' ? 'desc' : 'asc',
      );
    } else {
      this.sortedBy.set(sortBy);
      this.sortDirection.set('asc');
    }

    this.pageNumber.set(1);
  }

  // Check whether a table column owns the active sort state
  isSortedBy(sortBy: string): boolean {
    return this.sortedBy() === sortBy;
  }

  // Expose the active direction for accessible sortable table headers
  getSortAria(sortBy: string): 'ascending' | 'descending' | null {
    if (!this.isSortedBy(sortBy)) {
      return null;
    }

    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  // Describe the direction that clicking a sortable header will apply next
  getSortLabel(label: string, sortBy: string): string {
    const nextDirection =
      this.isSortedBy(sortBy) && this.sortDirection() === 'asc'
        ? 'descending'
        : 'ascending';

    return `Sort ${label} ${nextDirection}`;
  }

  // Get a specific page of categories
  getPage(pageNumber: number): void {
    this.pageNumber.set(pageNumber);
  }

  // Get the next page of categories
  getNextPage(): void {
    if (this.pageNumber() + 1 > this.list().length) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber + 1);
  }

  // Get the previous page of categories
  getPrevPage(): void {
    if (this.pageNumber() - 1 < 1) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber - 1);
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
