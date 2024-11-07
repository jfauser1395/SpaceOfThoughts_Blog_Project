import { Component, OnDestroy, OnInit } from '@angular/core';
import { User } from '../models/user.model';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  users$?: Observable<User[]>; // Observable for the list of users
  id: string | null = null; // ID of the selected user for deletion
  deleteUserSubscription$?: Subscription; // Subscription for delete user request
  usersQuant$?: Subscription; // Subscription for getting total user count
  totalCount!: number; // Total number of users
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 5; // Number of users per page
  sortedBy: string; // Field to sort by
  sortDirection: string; // Direction of sorting

  constructor(private authService: AuthService) {
    this.sortedBy = 'userName'; // Default sorting by username
    this.sortDirection = 'asc'; // Default sorting direction
  }

  ngOnInit(): void {
     // Scroll to the top of the page smoothly on component initialization
     window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
    
    // Get the total user count
    this.usersQuant$ = this.authService.getUserCount().subscribe({
      next: (value) => {
        this.totalCount = value;
        this.list = new Array(Math.ceil(value / this.pageSize));
        // Get all users from the API
        this.users$ = this.authService.getAllUsersFromDatabase(
          undefined,
          this.sortedBy,
          this.sortDirection,
        );
      },
    });
  }

  // Set the ID of the user to be deleted
  setUserId(userId: string) {
    this.id = userId;
  }

  // Delete the selected user
  onDelete(): void {
    if (this.id) {
      this.deleteUserSubscription$ = this.authService
        .deleteUser(this.id)
        .subscribe({
          next: (response) => {
            this.ngOnInit(); // Refresh the user list after deletion
          },
        });
    }
  }

  // Search for users by query
  onSearch(query: string) {
    this.users$ = this.authService.getAllUsersFromDatabase(query);
  }

  // Sort the user list
  sort(sortBy: string, sortDirection: string) {
    this.users$ = this.authService.getAllUsersFromDatabase(
      undefined,
      sortBy,
      sortDirection,
    );
  }

  // Get a specific page of users
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.users$ = this.authService.getAllUsersFromDatabase(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the next page of users
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.users$ = this.authService.getAllUsersFromDatabase(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the previous page of users
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.users$ = this.authService.getAllUsersFromDatabase(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }
  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.deleteUserSubscription$?.unsubscribe();
  }
}
