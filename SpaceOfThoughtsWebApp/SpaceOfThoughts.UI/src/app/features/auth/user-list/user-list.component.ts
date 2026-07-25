import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
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
  id: string | null = null; // ID of the user selected by an action modal
  deleteUserSubscription$?: Subscription; // Subscription for delete user request
  banUserSubscription$?: Subscription; // Subscription for ban or unban user request
  writingPrivilegesSubscription$?: Subscription; // Subscription for changing Writer access
  usersQuant$?: Subscription; // Subscription for getting total user count
  usersSubscription$?: Subscription; // Subscription for getting user rows
  totalCount!: number; // Total number of users
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 8; // Number of users per page
  query = ''; // Current search query
  sortedBy = 'userName'; // Sort users alphabetically by username by default
  sortDirection: 'asc' | 'desc' = 'asc'; // Direction of sorting
  currentUser?: User; // Signed-in user used only to control privileged UI visibility
  selectedUser?: User; // User targeted by the currently open confirmation modal
  updatingWritingPrivilegesForId?: string;
  privilegeMessage?: string;
  privilegeError?: string;
  private allUsers: User[] = [];
  private actionButtonResetTimeoutId?: number;

  constructor(
    private authService: AuthService,
    private readonly hostElement: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    this.currentUser = this.authService.getUser();

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

  // Select one row for the independent ban, writing-rights, or delete modal
  selectUser(user: User): void {
    this.selectedUser = user;
    this.id = user.id;
  }

  // Bootstrap restores focus to a modal trigger after the hidden event finishes.
  // Reset on the next task so Cancel, Close, and Submit all return every row action
  // to its untouched visual state.
  resetActionButtonState(): void {
    if (this.actionButtonResetTimeoutId !== undefined) {
      window.clearTimeout(this.actionButtonResetTimeoutId);
    }

    this.actionButtonResetTimeoutId = window.setTimeout(() => {
      this.hostElement.nativeElement
        .querySelectorAll<HTMLButtonElement>('.admin-user-actions > button')
        .forEach((button) => {
          button.blur();
          button.classList.remove('active', 'show');
        });

      this.actionButtonResetTimeoutId = undefined;
    }, 0);
  }

  // Delete the selected user
  onDelete(): void {
    if (this.id) {
      this.deleteUserSubscription$ = this.authService
        .deleteUser(this.id)
        .subscribe({
          next: () => {
            this.allUsers = this.allUsers.filter((user) => user.id !== this.id);
            this.selectedUser = undefined;
            this.id = null;
            this.loadUsers();
          },
        });
    }
  }

  // Ban or unban the selected user
  onBanToggle(user?: User): void {
    const targetUser = user ?? this.selectedUser;
    if (!targetUser) {
      return;
    }

    const request$ = targetUser.isBanned
      ? this.authService.unbanUser(targetUser.id)
      : this.authService.banUser(targetUser.id);

    this.banUserSubscription$?.unsubscribe();
    this.banUserSubscription$ = request$.subscribe({
      next: (updatedUser) => {
        this.allUsers = this.allUsers.map((existingUser) =>
          existingUser.id === updatedUser.id ? updatedUser : existingUser,
        );
        this.selectedUser = updatedUser;
        this.loadUsers();
      },
    });
  }

  // Only the seeded initial admin receives the non-delegable role behind this control
  get canGrantWritingPrivileges(): boolean {
    return this.currentUser?.roles.includes('InitialAdmin') ?? false;
  }

  // Check the target's current persisted role state
  hasWritingPrivileges(user: User): boolean {
    return user.roles.includes('Writer');
  }

  // Grant or revoke Writer access and update the row without a full page refresh
  onWritingPrivilegesToggle(user?: User): void {
    const targetUser = user ?? this.selectedUser;
    if (
      !targetUser ||
      !this.canGrantWritingPrivileges ||
      this.updatingWritingPrivilegesForId
    ) {
      return;
    }

    this.privilegeMessage = undefined;
    this.privilegeError = undefined;
    this.updatingWritingPrivilegesForId = targetUser.id;
    const isRevoking = this.hasWritingPrivileges(targetUser);
    const request$ = isRevoking
      ? this.authService.revokeWritingPrivileges(targetUser.id)
      : this.authService.grantWritingPrivileges(targetUser.id);

    this.writingPrivilegesSubscription$?.unsubscribe();
    this.writingPrivilegesSubscription$ = request$.subscribe({
      next: (updatedUser) => {
        this.allUsers = this.allUsers.map((existingUser) =>
          existingUser.id === updatedUser.id ? updatedUser : existingUser,
        );
        this.loadUsers();
        this.selectedUser = updatedUser;
        this.updatingWritingPrivilegesForId = undefined;
        this.privilegeMessage = isRevoking
          ? 'Writing access removed.'
          : 'Writing access granted.';
      },
      error: () => {
        this.updatingWritingPrivilegesForId = undefined;
        this.privilegeError = isRevoking
          ? 'Writing privileges could not be removed.'
          : 'Writing privileges could not be granted.';
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
        user.userName.toLowerCase().startsWith(normalizedQuery),
      );
    }

    if (this.sortedBy) {
      users.sort((first, second) => {
        const firstValue =
          this.sortedBy === 'email' ? first.email : first.userName;
        const secondValue =
          this.sortedBy === 'email' ? second.email : second.userName;
        const result = firstValue
          .toLowerCase()
          .localeCompare(secondValue.toLowerCase());

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
    if (this.actionButtonResetTimeoutId !== undefined) {
      window.clearTimeout(this.actionButtonResetTimeoutId);
    }

    this.deleteUserSubscription$?.unsubscribe();
    this.banUserSubscription$?.unsubscribe();
    this.writingPrivilegesSubscription$?.unsubscribe();
    this.usersQuant$?.unsubscribe();
    this.usersSubscription$?.unsubscribe();
  }
}
