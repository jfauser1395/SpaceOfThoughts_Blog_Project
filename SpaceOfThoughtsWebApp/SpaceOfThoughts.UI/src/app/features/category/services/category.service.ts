import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AddCategoryRequest } from '../models/add-category-request.model';
import { Observable } from 'rxjs';
import { Category } from '../models/category.model';
import { environment } from '../../../../environments/environment';
import { UpdateCategoryRequest } from '../models/update-category-request.model';

@Injectable({
  providedIn: 'root', // This service will be provided at the root level
})
export class CategoryService {
  constructor(private http: HttpClient) {}

  // Add a new category
  addCategory(model: AddCategoryRequest): Observable<void> {
    return this.http.post<void>(
      `${environment.apiBaseUrl}/api/Categories?addAuth=true`,
      model,
    );
  }

  // Get all categories with optional filtering, sorting, and pagination
  getAllCategories(
    query?: string,
    sortBy?: string,
    sortDirection?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Observable<Category[]> {
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
    return this.http.get<Category[]>(
      `${environment.apiBaseUrl}/api/Categories`,
      { params: params },
    );
  }

  // Get a single category by its ID
  getCategoryById(id: string): Observable<Category> {
    return this.http.get<Category>(
      `${environment.apiBaseUrl}/api/Categories/${id}`,
    );
  }

  // Get the total count of categories
  getCategoryCount(): Observable<number> {
    return this.http.get<number>(
      `${environment.apiBaseUrl}/api/Categories/count`,
    );
  }

  // Update an existing category
  updateCategory(
    id: string,
    updateCategoryRequest: UpdateCategoryRequest,
  ): Observable<Category> {
    return this.http.put<Category>(
      `${environment.apiBaseUrl}/api/Categories/${id}?addAuth=true`,
      updateCategoryRequest,
    );
  }

  // Delete a category by its ID
  deleteCategory(id: string): Observable<Category> {
    return this.http.delete<Category>(
      `${environment.apiBaseUrl}/api/Categories/${id}?addAuth=true`,
    );
  }
}
