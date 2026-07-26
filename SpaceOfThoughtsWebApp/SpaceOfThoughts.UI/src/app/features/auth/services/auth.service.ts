import { Injectable, inject } from '@angular/core';
import { LoginRequest } from '../models/login-request.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginResponse } from '../models/login-response.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { User } from '../models/user.model';
import { RegisterRequest } from '../models/register-request.model';
import { UpdateProfileRequest } from '../models/update-profile-request.model';

@Injectable({
  providedIn: 'root', // This service will be provided in the root level
})
export class AuthService {
  private http = inject(HttpClient);

  // BehaviorSubject to store and emit the current user
  $user = new BehaviorSubject<User | undefined>(undefined);

  // Register a new user and receive the session data needed for immediate login
  register(request: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.apiBaseUrl}/api/Auth/register`,
      {
        userName: request.userName,
        email: request.email,
        password: request.password,
      },
    );
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

  // Get the current user's editable profile
  getCurrentProfile(): Observable<User> {
    return this.http.get<User>(`${environment.apiBaseUrl}/api/Auth/me`);
  }

  // Update the current user's profile credentials
  updateProfile(request: UpdateProfileRequest): Observable<LoginResponse> {
    return this.http.put<LoginResponse>(
      `${environment.apiBaseUrl}/api/Auth/me`,
      request,
    );
  }

  // Delete the currently authenticated user's own account
  deleteCurrentAccount(): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/api/Auth/me`);
  }

  // Upload or replace the current user's profile picture
  uploadProfileImage(
    file: File,
    profileImagePosition?: string,
  ): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);

    if (profileImagePosition) {
      formData.append('profileImagePosition', profileImagePosition);
    }

    return this.http.post<User>(
      `${environment.apiBaseUrl}/api/Auth/profile-image`,
      formData,
    );
  }

  // Store login response data as the current user
  setUserFromLoginResponse(response: LoginResponse): void {
    this.setUser({
      id: response.id,
      userName: response.userName,
      email: response.email,
      roles: response.roles,
      profileImageUrl: response.profileImageUrl ?? null,
      profileImagePosition: response.profileImagePosition ?? null,
      isBanned: false,
    });
  }

  // Set the current user and store user details in session storage
  setUser(user: User): void {
    this.$user.next(user); // Emit the new user
    sessionStorage.setItem('user-id', user.id);
    sessionStorage.setItem('user-name', user.userName);
    sessionStorage.setItem('user-email', user.email);
    sessionStorage.setItem('user-roles', user.roles.join(','));

    if (user.profileImageUrl) {
      sessionStorage.setItem('user-profile-image-url', user.profileImageUrl);
    } else {
      sessionStorage.removeItem('user-profile-image-url');
    }

    if (user.profileImagePosition) {
      sessionStorage.setItem(
        'user-profile-image-position',
        user.profileImagePosition,
      );
    } else {
      sessionStorage.removeItem('user-profile-image-position');
    }
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
    const profileImageUrl = sessionStorage.getItem('user-profile-image-url');
    const profileImagePosition = sessionStorage.getItem(
      'user-profile-image-position',
    );

    if (email && roles && userName && id) {
      const user: User = {
        id: id,
        userName: userName,
        email: email,
        roles: roles.split(','),
        profileImageUrl: profileImageUrl || null,
        profileImagePosition: profileImagePosition || null,
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

  // Ban a user by ID
  banUser(id: string): Observable<User> {
    return this.http.put<User>(
      `${environment.apiBaseUrl}/api/Auth/users/${id}/ban`,
      {},
    );
  }

  // Unban a user by ID
  unbanUser(id: string): Observable<User> {
    return this.http.put<User>(
      `${environment.apiBaseUrl}/api/Auth/users/${id}/unban`,
      {},
    );
  }

  // Grant Writer privileges; the API restricts this operation to the initial admin
  grantWritingPrivileges(id: string): Observable<User> {
    return this.http.put<User>(
      `${environment.apiBaseUrl}/api/Auth/users/${id}/writing-privileges`,
      {},
    );
  }

  // Remove Writer privileges; the API restricts this operation to the initial admin
  revokeWritingPrivileges(id: string): Observable<User> {
    return this.http.delete<User>(
      `${environment.apiBaseUrl}/api/Auth/users/${id}/writing-privileges`,
    );
  }

  // Clear client state immediately and ask the API to remove its HttpOnly cookie.
  logout(): void {
    this.clearLocalSession();
    this.http
      .post<void>(`${environment.apiBaseUrl}/api/Auth/logout`, {})
      .subscribe({
        // Local logout still succeeds if the API is temporarily unavailable.
        error: () => undefined,
      });
  }

  clearLocalSession(): void {
    sessionStorage.clear();
    this.$user.next(undefined);
  }
}
