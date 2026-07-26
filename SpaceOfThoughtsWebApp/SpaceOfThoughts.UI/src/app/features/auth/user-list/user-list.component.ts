import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, switchMap } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-list',
  imports: [],
  templateUrl: './user-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  // Signals store user data, table controls, and asynchronous action feedback
  readonly pageNumber = signal(1);
  readonly pageSize = 8;
  readonly query = signal('');
  readonly sortedBy = signal<'userName' | 'email'>('userName');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly currentUser = signal<User | undefined>(undefined);
  readonly selectedUser = signal<User | undefined>(undefined);
  readonly updatingWritingPrivilegesForId = signal<string | undefined>(
    undefined,
  );
  readonly privilegeMessage = signal<string | undefined>(undefined);
  readonly privilegeError = signal<string | undefined>(undefined);
  private readonly selectedUserId = signal<string | null>(null);
  private readonly allUsers = signal<readonly User[]>([]);

  // Derive search, sorting, totals, and pagination only when their signals change
  private readonly matchingUsers = computed(() => {
    const normalizedQuery = this.query().toLowerCase();
    const sortedBy = this.sortedBy();
    const direction = this.sortDirection();
    let users = [...this.allUsers()];

    if (normalizedQuery) {
      users = users.filter(
        (user) =>
          user.userName.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery),
      );
    }

    users.sort((first, second) => {
      const firstValue = sortedBy === 'email' ? first.email : first.userName;
      const secondValue = sortedBy === 'email' ? second.email : second.userName;
      const result = firstValue
        .toLowerCase()
        .localeCompare(secondValue.toLowerCase());
      return direction === 'asc' ? result : -result;
    });

    return users;
  });
  readonly totalCount = computed(() => this.matchingUsers().length);
  readonly list = computed(
    () => new Array(Math.ceil(this.totalCount() / this.pageSize)),
  );
  readonly users = computed(() => {
    const skip = (this.pageNumber() - 1) * this.pageSize;
    return this.matchingUsers().slice(skip, skip + this.pageSize);
  });

  private deleteUserSubscription?: Subscription;
  private banUserSubscription?: Subscription;
  private writingPrivilegesSubscription?: Subscription;
  private actionButtonResetTimeoutId?: number;

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    this.currentUser.set(this.authService.getUser());

    // Fetch every row once so local signals can handle responsive table controls
    this.authService
      .getUserCount()
      .pipe(
        switchMap((count) =>
          this.authService.getAllUsersFromDatabase(
            undefined,
            undefined,
            undefined,
            1,
            Math.max(count, this.pageSize),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (users) => this.allUsers.set(users),
      });
  }

  // Select one row for the independent ban, writing-rights, or delete modal
  selectUser(user: User): void {
    this.selectedUser.set(user);
    this.selectedUserId.set(user.id);
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

  // Delete the selected user and remove the row without reloading the page
  onDelete(): void {
    const selectedUserId = this.selectedUserId();
    if (!selectedUserId) {
      return;
    }

    this.deleteUserSubscription?.unsubscribe();
    this.deleteUserSubscription = this.authService
      .deleteUser(selectedUserId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allUsers.update((users) =>
            users.filter((user) => user.id !== selectedUserId),
          );
          this.selectedUser.set(undefined);
          this.selectedUserId.set(null);
          this.clampPageToAvailableRows();
        },
      });
  }

  // Ban or unban the selected user
  onBanToggle(user?: User): void {
    const targetUser = user ?? this.selectedUser();
    if (!targetUser) {
      return;
    }

    const request$ = targetUser.isBanned
      ? this.authService.unbanUser(targetUser.id)
      : this.authService.banUser(targetUser.id);

    this.banUserSubscription?.unsubscribe();
    this.banUserSubscription = request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.replaceUser(updatedUser);
          this.selectedUser.set(updatedUser);
        },
      });
  }

  // Only the seeded initial admin receives the non-delegable role behind this control
  get canGrantWritingPrivileges(): boolean {
    return this.currentUser()?.roles.includes('InitialAdmin') ?? false;
  }

  // Check the target's current persisted role state
  hasWritingPrivileges(user: User): boolean {
    return user.roles.includes('Writer');
  }

  // Grant or revoke Writer access and update the row without a full page refresh
  onWritingPrivilegesToggle(user?: User): void {
    const targetUser = user ?? this.selectedUser();
    if (
      !targetUser ||
      !this.canGrantWritingPrivileges ||
      this.updatingWritingPrivilegesForId()
    ) {
      return;
    }

    this.privilegeMessage.set(undefined);
    this.privilegeError.set(undefined);
    this.updatingWritingPrivilegesForId.set(targetUser.id);
    const isRevoking = this.hasWritingPrivileges(targetUser);
    const request$ = isRevoking
      ? this.authService.revokeWritingPrivileges(targetUser.id)
      : this.authService.grantWritingPrivileges(targetUser.id);

    this.writingPrivilegesSubscription?.unsubscribe();
    this.writingPrivilegesSubscription = request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.replaceUser(updatedUser);
          this.selectedUser.set(updatedUser);
          this.updatingWritingPrivilegesForId.set(undefined);
          this.privilegeMessage.set(
            isRevoking ? 'Writing access removed.' : 'Writing access granted.',
          );
        },
        error: () => {
          this.updatingWritingPrivilegesForId.set(undefined);
          this.privilegeError.set(
            isRevoking
              ? 'Writing privileges could not be removed.'
              : 'Writing privileges could not be granted.',
          );
        },
      });
  }

  // Search for users by username or email
  onSearch(query: string): void {
    this.query.set(query.trim());
    this.pageNumber.set(1);
  }

  // Sort the user list
  sort(sortBy: 'userName' | 'email'): void {
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

  // Get a specific page of users
  getPage(pageNumber: number): void {
    this.pageNumber.set(pageNumber);
  }

  // Get the next page of users
  getNextPage(): void {
    if (this.pageNumber() + 1 > this.list().length) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber + 1);
  }

  // Get the previous page of users
  getPrevPage(): void {
    if (this.pageNumber() - 1 < 1) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber - 1);
  }

  // Replace one persisted user while preserving the current table controls
  private replaceUser(updatedUser: User): void {
    this.allUsers.update((users) =>
      users.map((existingUser) =>
        existingUser.id === updatedUser.id ? updatedUser : existingUser,
      ),
    );
  }

  // Keep the selected page valid after deleting the last row on a page
  private clampPageToAvailableRows(): void {
    const lastPage = Math.max(1, this.list().length);
    if (this.pageNumber() > lastPage) {
      this.pageNumber.set(lastPage);
    }
  }

  // Clear the pending Bootstrap focus-reset callback when the page closes
  ngOnDestroy(): void {
    if (this.actionButtonResetTimeoutId !== undefined) {
      window.clearTimeout(this.actionButtonResetTimeoutId);
    }
  }
}
