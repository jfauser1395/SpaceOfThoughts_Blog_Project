import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddCategoryRequest } from '../models/add-category-request.model';
import { CategoryService } from '../services/category.service';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-add-category',
  standalone: true,
  imports: [FormsModule, AddCategoryComponent, RouterModule],
  templateUrl: './add-category.component.html',
  styleUrls: ['./add-category.component.css'],
})
export class AddCategoryComponent implements OnDestroy {
  model: AddCategoryRequest; // Model for the add category request
  private addCategorySubscription?: Subscription; // Subscription for the add category request

  constructor(
    private categoryService: CategoryService, // Inject CategoryService for category operations
    private router: Router, // Inject Router for navigation
    private viewportScroller: ViewportScroller, // Inject viewportScroller for scroll control
  ) {
    // Initialize the model with default values
    this.model = {
      name: '',
      urlHandle: '',
    };
  }

  // Handle form submission to add a new category
  onFormSubmit() {
    this.addCategorySubscription = this.categoryService
      .addCategory(this.model)
      .subscribe({
        next: (response) => {
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
