import { Component, OnDestroy, OnInit } from '@angular/core';
import { User } from '../models/user.model';
import { Observable, of, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-list',
  imports: [CommonModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  users$?: Observable<User[]>; // Observable for the list of users
  id: string | null = null; // ID of the selected user for deletion
  deleteUserSubscription$?: Subscription; // Subscription for delete user request
  banUserSubscription$?: Subscription; // Subscription for ban or unban user request
  usersQuant$?: Subscription; // Subscription for getting total user count
  usersSubscription$?: Subscription; // Subscription for getting user rows
  totalCount!: number; // Total number of users
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 8; // Number of users per page
  query = ''; // Current search query
  sortedBy = ''; // Field to sort by
  sortDirection: 'asc' | 'desc' = 'asc'; // Direction of sorting
  private allUsers: User[] = [];

  constructor(private authService: AuthService) {}

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
        this.usersSubscription$ = this.authService
          .getAllUsersFromDatabase(
            undefined,
            undefined,
            undefined,
            1,
            Math.max(value, this.pageSize),
          )
          .subscribe({
            next: (users) => {
              this.allUsers = users;
              this.loadUsers();
            },
          });
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

  // Ban or unban the selected user
  onBanToggle(user: User): void {
    const request$ = user.isBanned
      ? this.authService.unbanUser(user.id)
      : this.authService.banUser(user.id);

    this.banUserSubscription$?.unsubscribe();
    this.banUserSubscription$ = request$.subscribe({
      next: (updatedUser) => {
        this.allUsers = this.allUsers.map((existingUser) =>
          existingUser.id === updatedUser.id ? updatedUser : existingUser,
        );
        this.loadUsers();
      },
    });
  }

  // Search for users by query
  onSearch(query: string) {
    this.query = query.trim();
    this.pageNumber = 1;
    this.loadUsers();
  }

  // Sort the user list
  sort(sortBy: string) {
    if (this.sortedBy === sortBy) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortedBy = sortBy;
      this.sortDirection = 'asc';
    }

    this.pageNumber = 1;
    this.loadUsers();
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

  // Get a specific page of users
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.loadUsers();
  }

  // Get the next page of users
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.loadUsers();
  }

  // Get the previous page of users
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.loadUsers();
  }

  // Apply search, sorting, and pagination to the cached user collection
  private loadUsers(): void {
    let users = [...this.allUsers];
    const normalizedQuery = this.query.toLowerCase();

    if (normalizedQuery) {
      users = users.filter((user) =>
        user.userName.toLowerCase().includes(normalizedQuery),
      );
    }

    if (this.sortedBy) {
      users.sort((first, second) => {
        const result = first.userName
          .toLowerCase()
          .localeCompare(second.userName.toLowerCase());

        return this.sortDirection === 'asc' ? result : -result;
      });
    }

    this.totalCount = users.length;
    this.list = new Array(Math.ceil(this.totalCount / this.pageSize));

    if (this.pageNumber > this.list.length && this.list.length > 0) {
      this.pageNumber = this.list.length;
    }

    const skip = (this.pageNumber - 1) * this.pageSize;
    this.users$ = of(users.slice(skip, skip + this.pageSize));
  }
  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.deleteUserSubscription$?.unsubscribe();
    this.banUserSubscription$?.unsubscribe();
    this.usersQuant$?.unsubscribe();
    this.usersSubscription$?.unsubscribe();
  }
}
