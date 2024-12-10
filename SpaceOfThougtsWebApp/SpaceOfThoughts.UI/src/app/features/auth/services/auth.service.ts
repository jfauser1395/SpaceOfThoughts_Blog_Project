import { Injectable } from '@angular/core';
import { LoginRequest } from '../models/login-request.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginResponse } from '../models/login-response.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { User } from '../models/user.model';
import { CookieService } from 'ngx-cookie-service';
import { RegisterRequest } from '../models/register-request.model';

@Injectable({
  providedIn: 'root', // This service will be provided in the root level
})
export class AuthService {
  // BehaviorSubject to store and emit the current user
  $user = new BehaviorSubject<User | undefined>(undefined);

  constructor(
    private http: HttpClient,
    private cookieService: CookieService,
  ) {}

  // Register a new user
  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/Auth/register`, {
      userName: request.userName,
      email: request.email,
      password: request.password,
    });
  }

  // Login a user
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.apiBaseUrl}/api/Auth/login`,
      {
        email: request.email,
        password: request.password,
      },
    );
  }

  // Set the current user and store user details in session storage
  setUser(user: User): void {
    this.$user.next(user); // Emit the new user
    sessionStorage.setItem('user-id', user.id);
    sessionStorage.setItem('user-name', user.userName);
    sessionStorage.setItem('user-email', user.email);
    sessionStorage.setItem('user-roles', user.roles.join(','));
  }

  // Return an Observable of the current user
  user(): Observable<User | undefined> {
    return this.$user.asObservable();
  }

  // Get the current user from session storage
  getUser(): User | undefined {
    const id = sessionStorage.getItem('user-id');
    const userName = sessionStorage.getItem('user-name');
    const email = sessionStorage.getItem('user-email');
    const roles = sessionStorage.getItem('user-roles');

    if (email && roles && userName && id) {
      const user: User = {
        id: id,
        userName: userName,
        email: email,
        roles: roles.split(','),
      };
      return user;
    }
    return undefined;
  }

  // Get all users from the database with optional filtering, sorting, and pagination
  getAllUsersFromDatabase(
    query?: string,
    sortBy?: string,
    sortDirection?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Observable<User[]> {
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
    return this.http.get<User[]>(`${environment.apiBaseUrl}/api/Auth/users`, {
      params: params,
    });
  }

  // Get the total count of users from the database
  getUserCount(): Observable<number> {
    return this.http.get<number>(`${environment.apiBaseUrl}/api/Auth/count`);
  }

  // Delete a user by ID
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/api/Auth/users/${id}`,
    );
  }

  // Log out the current user by clearing session storage and cookies
  logout(): void {
    sessionStorage.clear(); // Clear session storage
    this.cookieService.delete('Authorization', '/'); // Delete the authorization cookie
    this.$user.next(undefined); // Emit undefined to clear the current user
  }
}
