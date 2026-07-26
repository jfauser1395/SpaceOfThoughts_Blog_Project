import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category.model';
import { UpdateCategoryRequest } from '../models/update-category-request.model';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-edit-category',
  imports: [FormsModule],
  templateUrl: './edit-category.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-category.component.css',
})
export class EditCategoryComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  id: string | null = null; // ID of the category to be edited
  paramsSubscription?: Subscription; // Subscription for route parameters
  editCategorySubscription?: Subscription; // Subscription for updating the category
  readonly category = signal<Category | undefined>(undefined); // Model for the category data
  getCategoryByIdSubscription?: Subscription;

  ngOnInit(): void {
    // Subscribe to route parameters to get the category ID
    this.paramsSubscription = this.route.paramMap.subscribe({
      next: (params) => {
        this.id = params.get('id');
        if (this.id) {
          // Get the data from the API for this category ID
          this.getCategoryByIdSubscription = this.categoryService
            .getCategoryById(this.id)
            .subscribe({
              next: (response) => {
                this.category.set(response);
              },
            });
        }
      },
    });
  }

  // Handle form submission to update the category
  onFormSubmit(): void {
    const updateCategoryRequest: UpdateCategoryRequest = {
      name: this.category()?.name ?? '',
      urlHandle: this.category()?.urlHandle ?? '',
    };
    if (this.id) {
      this.editCategorySubscription = this.categoryService
        .updateCategory(this.id, updateCategoryRequest)
        .subscribe({
          next: () => {
            this.router.navigateByUrl('/admin/categories').then(() => {
              this.viewportScroller.scrollToPosition([0, 0]); // Redirect to the categories admin page on success
            });
          },
        });
    }
  }

  // Handle deletion of the category
  onDelete(): void {
    if (this.id) {
      this.categoryService.deleteCategory(this.id).subscribe({
        next: () => {
          this.router.navigateByUrl('/admin/categories'); // Redirect to categories admin page on success
        },
      });
    }
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.paramsSubscription?.unsubscribe();
    this.editCategorySubscription?.unsubscribe();
    this.getCategoryByIdSubscription?.unsubscribe();
  }
}
