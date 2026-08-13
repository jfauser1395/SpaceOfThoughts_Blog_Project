import {
  Component,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddCategoryRequest } from '../models/add-category-request.model';
import { CategoryService } from '../services/category.service';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-add-category',
  imports: [FormsModule, RouterModule],
  templateUrl: './add-category.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./add-category.component.css'],
})
export class AddCategoryComponent implements OnDestroy {
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  model: AddCategoryRequest; // Model for the add category request
  private addCategorySubscription?: Subscription; // Subscription for the add category request

  constructor() {
    // Initialize the model with default values
    this.model = {
      name: '',
    };
  }

  // Handle form submission to add a new category
  onFormSubmit(): void {
    this.addCategorySubscription = this.categoryService
      .addCategory(this.model)
      .subscribe({
        next: () => {
          this.router.navigateByUrl('admin/categories').then(() => {
            this.viewportScroller.scrollToPosition([0, 0]); // Redirect to the categories admin page on success
          });
        },
      });
  }

  // Unsubscribe from the add category request to prevent memory leaks
  ngOnDestroy(): void {
    this.addCategorySubscription?.unsubscribe();
  }
}
