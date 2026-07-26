import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Current user profile loaded from the API
  currentUser?: User;
  selectedProfileImageFile?: File;
  selectedProfileImagePreviewUrl?: string;

  // Avatar editor limits used by the zoom control
  readonly minimumAvatarZoom = 85;
  readonly maximumAvatarZoom = 170;
  readonly avatarZoomStep = 1;

  // Avatar crop and positioning defaults
  private readonly croppedAvatarSize = 512;
  private readonly defaultAvatarZoom = 100;
  private readonly selectedImageDefaultAvatarZoom = 134;
  private readonly minimumAvatarPanOffsetPercent = 12.5;
  private readonly defaultAvatarPosition = '50% 50% 100%';
  private readonly savedCroppedAvatarPosition = '50% 50%';
  avatarPositionX = 50;
  avatarPositionY = 50;
  avatarZoom = this.defaultAvatarZoom;
  isProfilePictureEditorOpen = false;
  isDraggingAvatar = false;

  // Active pointer and incremental drag values used for smooth two-axis movement
  private activeAvatarPointerId?: number;
  private avatarDragTarget?: HTMLElement;
  private dragLastClientX = 0;
  private dragLastClientY = 0;
  private dragPositionX = 50;
  private dragPositionY = 50;
  isLoading = true;
  isSavingProfile = false;
  isUploadingProfileImage = false;
  isDeletingAccount = false;
  isDeleteAccountConfirmationOpen = false;
  profileError?: string;
  profileSuccess?: string;
  imageError?: string;
  imageSuccess?: string;
  deleteAccountError?: string;

  // Reactive form for profile credentials and optional password change
  profileForm = new FormGroup({
    userName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(256)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(256),
      ],
    }),
    currentPassword: new FormControl('', { nonNullable: true }),
    newPassword: new FormControl('', { nonNullable: true }),
    confirmPassword: new FormControl('', { nonNullable: true }),
  });

  private profileSubscription?: Subscription;
  private updateProfileSubscription?: Subscription;
  private uploadProfileImageSubscription?: Subscription;
  private deleteAccountSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Scroll up after loading the profile page
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

    // Load the editable profile data
    this.loadProfile();
  }

  // End the current session from the account profile page
  onLogout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/', { replaceUrl: true });
  }

  // Handle profile image file selection
  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.imageError = undefined;
    this.imageSuccess = undefined;

    if (!file) {
      return;
    }

    if (!this.isProfileImageFileValid(file)) {
      input.value = '';
      return;
    }

    // Create a temporary preview URL for the avatar editor
    this.revokeSelectedProfileImagePreview();
    this.selectedProfileImageFile = file;
    this.selectedProfileImagePreviewUrl = URL.createObjectURL(file);
    this.avatarPositionX = 50;
    this.avatarPositionY = 50;
    this.avatarZoom = this.selectedImageDefaultAvatarZoom;
  }

  // Open the profile picture editor popup
  openProfilePictureEditor(): void {
    this.imageError = undefined;
    this.imageSuccess = undefined;
    this.isProfilePictureEditorOpen = true;
  }

  // Close the profile picture editor and reset unsaved image changes
  closeProfilePictureEditor(): void {
    if (this.isUploadingProfileImage) {
      return;
    }

    this.imageError = undefined;
    this.imageSuccess = undefined;
    this.selectedProfileImageFile = undefined;
    this.revokeSelectedProfileImagePreview();
    this.finishAvatarDrag(this.activeAvatarPointerId);
    this.applyAvatarPosition(this.currentUser);
    this.isProfilePictureEditorOpen = false;
  }

  // Crop and upload the selected profile image
  async onUploadProfileImage(): Promise<void> {
    this.imageError = undefined;
    this.imageSuccess = undefined;

    if (!this.avatarImageUrl) {
      this.imageError = 'Choose a JPG, PNG, or WEBP picture first.';
      return;
    }

    this.isUploadingProfileImage = true;
    this.uploadProfileImageSubscription?.unsubscribe();

    // Prepare a cropped square image before sending it to the API
    let croppedProfileImageFile: File;
    try {
      croppedProfileImageFile = await this.createCroppedProfileImageFile();
    } catch (error) {
      this.imageError =
        error instanceof Error
          ? error.message
          : 'Unable to prepare this profile picture.';
      this.isUploadingProfileImage = false;
      return;
    }

    // Upload the cropped avatar and update the current user session
    this.uploadProfileImageSubscription = this.authService
      .uploadProfileImage(
        croppedProfileImageFile,
        this.savedCroppedAvatarPosition,
      )
      .subscribe({
        next: (updatedUser) => {
          this.applyUser(updatedUser);
          this.authService.setUser(updatedUser);
          this.selectedProfileImageFile = undefined;
          this.revokeSelectedProfileImagePreview();
          this.imageSuccess = 'Profile picture updated.';
          this.isUploadingProfileImage = false;
          this.isProfilePictureEditorOpen = false;
        },
        error: (error) => {
          this.imageError =
            this.getRequestErrorMessage(error) ||
            'Unable to upload this profile picture.';
          this.isUploadingProfileImage = false;
        },
      });
  }

  // Handle profile credential form submission
  onSaveProfile(): void {
    this.profileError = undefined;
    this.profileSuccess = undefined;

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const newPassword = this.profileForm.controls.newPassword.value.trim();
    const confirmPassword =
      this.profileForm.controls.confirmPassword.value.trim();
    const currentPassword =
      this.profileForm.controls.currentPassword.value.trim();

    // New password must be confirmed before saving
    if (newPassword && newPassword !== confirmPassword) {
      this.profileForm.controls.confirmPassword.setErrors({ mismatch: true });
      return;
    }

    // Current password is required when changing the password
    if (newPassword && !currentPassword) {
      this.profileForm.controls.currentPassword.setErrors({ required: true });
      return;
    }

    this.isSavingProfile = true;
    this.updateProfileSubscription?.unsubscribe();

    // Save profile fields and keep the stored avatar position in sync
    this.updateProfileSubscription = this.authService
      .updateProfile({
        userName: this.profileForm.controls.userName.value.trim(),
        email: this.profileForm.controls.email.value.trim(),
        currentPassword: currentPassword || null,
        newPassword: newPassword || null,
        profileImagePosition: this.avatarObjectPosition,
      })
      .subscribe({
        next: (response) => {
          this.authService.setUserFromLoginResponse(response);
          this.applyUser(this.authService.getUser());
          this.profileForm.controls.currentPassword.reset('');
          this.profileForm.controls.newPassword.reset('');
          this.profileForm.controls.confirmPassword.reset('');
          this.profileSuccess = 'Profile updated.';
          this.isSavingProfile = false;
        },
        error: (error) => {
          const validationErrors = error?.error?.errors;
          if (validationErrors?.userName) {
            const userNameControl = this.profileForm.controls.userName;
            userNameControl.setErrors({
              ...userNameControl.errors,
              duplicate: true,
            });
            userNameControl.markAsTouched();
          }

          if (validationErrors?.email) {
            const emailControl = this.profileForm.controls.email;
            emailControl.setErrors({
              ...emailControl.errors,
              duplicate: true,
            });
            emailControl.markAsTouched();
          }

          this.profileError =
            this.getRequestErrorMessage(error) ||
            'Unable to update your profile.';
          this.isSavingProfile = false;
        },
      });
  }

  // Show the explicit confirmation step before allowing permanent account deletion
  openDeleteAccountConfirmation(): void {
    this.deleteAccountError = undefined;
    this.isDeleteAccountConfirmationOpen = true;
  }

  // Return to the normal profile view without deleting the account
  closeDeleteAccountConfirmation(): void {
    if (this.isDeletingAccount) {
      return;
    }

    this.deleteAccountError = undefined;
    this.isDeleteAccountConfirmationOpen = false;
  }

  // Delete the signed-in user's account and clear the now-invalid local session
  onDeleteAccount(): void {
    if (!this.canDeleteAccount || this.isDeletingAccount) {
      return;
    }

    this.deleteAccountError = undefined;
    this.isDeletingAccount = true;
    this.deleteAccountSubscription?.unsubscribe();

    this.deleteAccountSubscription = this.authService
      .deleteCurrentAccount()
      .subscribe({
        next: () => {
          // Remove all local authentication state before leaving the protected profile page
          this.authService.logout();
          void this.router.navigateByUrl('/', { replaceUrl: true });
        },
        error: (error) => {
          this.deleteAccountError = this.getDeleteAccountErrorMessage(error);
          this.isDeletingAccount = false;
        },
      });
  }

  // Start dragging the avatar preview
  onAvatarPointerDown(event: PointerEvent): void {
    if (
      !this.avatarImageUrl ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    const avatar = event.currentTarget as HTMLElement;
    this.activeAvatarPointerId = event.pointerId;
    this.avatarDragTarget = avatar;
    this.isDraggingAvatar = true;
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;
    this.dragPositionX = this.avatarPositionX;
    this.dragPositionY = this.avatarPositionY;
    avatar.setPointerCapture(event.pointerId);
  }

  // Track pointer movement on the window so vertical dragging is not lost to the popup
  @HostListener('window:pointermove', ['$event'])
  onAvatarPointerMove(event: PointerEvent): void {
    if (
      !this.isDraggingAvatar ||
      event.pointerId !== this.activeAvatarPointerId
    ) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.updateAvatarPositionFromDrag(event);
  }

  // Finish dragging the avatar preview
  @HostListener('window:pointerup', ['$event'])
  onAvatarPointerUp(event: PointerEvent): void {
    if (
      !this.isDraggingAvatar ||
      event.pointerId !== this.activeAvatarPointerId
    ) {
      return;
    }

    this.updateAvatarPositionFromDrag(event);
    this.finishAvatarDrag(event.pointerId);
  }

  // Cancel an interrupted drag without applying an unreliable final pointer position
  @HostListener('window:pointercancel', ['$event'])
  onAvatarPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.activeAvatarPointerId) {
      this.finishAvatarDrag(event.pointerId);
    }
  }

  // Update avatar zoom from the range input
  onAvatarZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.avatarZoom = this.clampZoom(Number(input.value));
  }

  // Image URL used by the avatar preview
  get avatarImageUrl(): string | undefined {
    return (
      this.selectedProfileImagePreviewUrl ||
      this.currentUser?.profileImageUrl ||
      undefined
    );
  }

  // Combined avatar position string including zoom
  get avatarPosition(): string {
    return `${this.avatarPositionX}% ${this.avatarPositionY}% ${this.avatarZoom}%`;
  }

  // Object-position string saved for cropped avatars
  get avatarObjectPosition(): string {
    return `${this.avatarPositionX}% ${this.avatarPositionY}%`;
  }

  // Transform used to visually pan the enlarged avatar image
  get avatarImageTransform(): string {
    return this.buildAvatarTransform(
      this.avatarPositionX,
      this.avatarPositionY,
      this.avatarZoom,
    );
  }

  // Initial shown when the user does not have a profile image
  get userInitial(): string {
    const userName =
      this.profileForm.controls.userName.value.trim() ||
      this.currentUser?.userName;
    return userName ? userName.charAt(0).toUpperCase() : '?';
  }

  // The initial seeded administrator is intentionally excluded from self-service deletion
  get canDeleteAccount(): boolean {
    return (
      !!this.currentUser && !this.currentUser.roles.includes('InitialAdmin')
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions and release preview URLs to prevent memory leaks
    this.profileSubscription?.unsubscribe();
    this.updateProfileSubscription?.unsubscribe();
    this.uploadProfileImageSubscription?.unsubscribe();
    this.deleteAccountSubscription?.unsubscribe();
    this.finishAvatarDrag(this.activeAvatarPointerId);
    this.revokeSelectedProfileImagePreview();
  }

  // Load the current user's editable profile data
  private loadProfile(): void {
    this.isLoading = true;
    this.profileSubscription?.unsubscribe();
    this.profileSubscription = this.authService.getCurrentProfile().subscribe({
      next: (user) => {
        this.applyUser(user);
        this.authService.setUser(user);
        this.isLoading = false;
      },
      error: () => {
        const fallbackUser = this.authService.getUser();
        if (fallbackUser) {
          // Use the session user if the profile endpoint cannot be reached
          this.applyUser(fallbackUser);
        } else {
          this.profileError = 'Unable to load your profile.';
        }

        this.isLoading = false;
      },
    });
  }

  // Apply user values to the component state and form
  private applyUser(user?: User): void {
    if (!user) {
      return;
    }

    this.currentUser = user;
    this.applyAvatarPosition(user);

    this.profileForm.patchValue({
      userName: user.userName,
      email: user.email,
    });
  }

  // Apply saved avatar position values or defaults
  private applyAvatarPosition(user?: User): void {
    const position = this.parseAvatarPosition(user?.profileImagePosition);
    this.avatarPositionX = position.x;
    this.avatarPositionY = position.y;
    this.avatarZoom = position.zoom;
  }

  // Convert pointer movement into percentage-based avatar position
  private updateAvatarPositionFromDrag(event: PointerEvent): void {
    const avatar = this.avatarDragTarget;
    if (!avatar) {
      return;
    }

    const bounds = avatar.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const deltaX =
      ((event.clientX - this.dragLastClientX) / bounds.width) * 100;
    const deltaY =
      ((event.clientY - this.dragLastClientY) / bounds.height) * 100;

    this.dragPositionX = this.clampPercent(this.dragPositionX - deltaX);
    this.dragPositionY = this.clampPercent(this.dragPositionY - deltaY);
    this.avatarPositionX = Math.round(this.dragPositionX);
    this.avatarPositionY = Math.round(this.dragPositionY);
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;
  }

  // Release pointer capture and clear all state associated with the current drag
  private finishAvatarDrag(pointerId?: number): void {
    if (
      pointerId !== undefined &&
      this.avatarDragTarget?.hasPointerCapture(pointerId)
    ) {
      this.avatarDragTarget.releasePointerCapture(pointerId);
    }

    this.isDraggingAvatar = false;
    this.activeAvatarPointerId = undefined;
    this.avatarDragTarget = undefined;
  }

  // Keep avatar position inside the preview frame
  private clampPercent(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  // Keep avatar zoom inside the configured range
  private clampZoom(value: number): number {
    if (Number.isNaN(value)) {
      return this.defaultAvatarZoom;
    }

    return Math.min(
      this.maximumAvatarZoom,
      Math.max(this.minimumAvatarZoom, Math.round(value)),
    );
  }

  // Build the translate transform that visually pans a zoomed avatar image
  private buildAvatarTransform(x: number, y: number, zoom: number): string {
    const zoomPercent = this.clampZoom(zoom);
    const maxOffset = Math.max(
      this.minimumAvatarPanOffsetPercent,
      (Math.abs(zoomPercent - 100) / (2 * zoomPercent)) * 100,
    );
    const offsetX = (((50 - x) / 50) * maxOffset).toFixed(2);
    const offsetY = (((50 - y) / 50) * maxOffset).toFixed(2);

    return `translate(${offsetX}%, ${offsetY}%)`;
  }

  // Parse a saved avatar position string into editable values
  private parseAvatarPosition(position?: string | null): {
    x: number;
    y: number;
    zoom: number;
  } {
    const [xText, yText, zoomText] = (
      position ?? this.defaultAvatarPosition
    ).split(' ');
    const x = this.parsePercent(xText);
    const y = this.parsePercent(yText);
    const zoom = this.parseZoom(zoomText);

    return { x, y, zoom };
  }

  // Parse a percentage string into a safe avatar position
  private parsePercent(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));
    if (Number.isNaN(parsed)) {
      return 50;
    }

    return Math.min(100, Math.max(0, parsed));
  }

  // Parse a percentage string into a safe avatar zoom
  private parseZoom(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));
    return this.clampZoom(parsed);
  }

  // Create the cropped profile image file that will be uploaded to the API
  private async createCroppedProfileImageFile(): Promise<File> {
    const imageUrl = this.avatarImageUrl;
    if (!imageUrl) {
      throw new Error('Choose a JPG, PNG, or WEBP picture first.');
    }

    const image = await this.loadImage(
      imageUrl,
      // Saved images need CORS enabled before drawing to canvas
      !this.selectedProfileImagePreviewUrl,
    );
    const canvas = document.createElement('canvas');
    canvas.width = this.croppedAvatarSize;
    canvas.height = this.croppedAvatarSize;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to crop this profile picture.');
    }

    this.drawCroppedAvatarImage(context, image);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    if (!blob) {
      throw new Error('Unable to crop this profile picture.');
    }

    return new File([blob], this.getCroppedProfileImageFileName(), {
      lastModified: Date.now(),
      type: 'image/jpeg',
    });
  }

  // Draw the selected avatar into the square crop canvas
  private drawCroppedAvatarImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
  ): void {
    const canvasSize = this.croppedAvatarSize;
    const zoom = this.clampZoom(this.avatarZoom);
    const imageBoxSize = (canvasSize * zoom) / 100;
    // Keep both axes movable even when the image exactly fills the crop frame
    const maxOffset = Math.max(
      this.minimumAvatarPanOffsetPercent,
      (Math.abs(zoom - 100) / (2 * zoom)) * 100,
    );
    const offsetX =
      ((((50 - this.avatarPositionX) / 50) * maxOffset) / 100) * imageBoxSize;
    const offsetY =
      ((((50 - this.avatarPositionY) / 50) * maxOffset) / 100) * imageBoxSize;
    const imageBoxX = (canvasSize - imageBoxSize) / 2 + offsetX;
    const imageBoxY = (canvasSize - imageBoxSize) / 2 + offsetY;
    const imageAspectRatio = image.naturalWidth / image.naturalHeight;
    const drawWidth =
      imageAspectRatio >= 1 ? imageBoxSize * imageAspectRatio : imageBoxSize;
    const drawHeight =
      imageAspectRatio >= 1 ? imageBoxSize : imageBoxSize / imageAspectRatio;
    const overflowX = Math.max(0, drawWidth - imageBoxSize);
    const overflowY = Math.max(0, drawHeight - imageBoxSize);
    const drawX = imageBoxX - overflowX * (this.avatarPositionX / 100);
    const drawY = imageBoxY - overflowY * (this.avatarPositionY / 100);

    // Fill transparency and any exposed crop area with the required black background
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvasSize, canvasSize);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  // Load an image element for canvas cropping
  private loadImage(
    source: string,
    useCrossOrigin: boolean,
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      if (useCrossOrigin) {
        image.crossOrigin = 'anonymous';
      }

      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('Unable to load this profile picture for cropping.'));
      image.src = source;
    });
  }

  // Build a predictable file name for the cropped avatar upload
  private getCroppedProfileImageFileName(): string {
    const originalName =
      this.selectedProfileImageFile?.name ?? 'profile-picture';
    const fileNameWithoutExtension =
      originalName.replace(/\.[^.]+$/, '') || 'profile-picture';

    return `${fileNameWithoutExtension}-cropped.jpg`;
  }

  // Validate profile image file type and size before previewing it
  private isProfileImageFileValid(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const allowedTypes = [
      'image/jpeg',
      'image/pjpeg',
      'image/png',
      'image/webp',
      '',
    ];
    const hasValidExtension = extension
      ? allowedExtensions.includes(extension)
      : false;
    const hasValidType = allowedTypes.includes(file.type);

    if (!hasValidExtension && !hasValidType) {
      this.imageError = 'Please choose a JPG, PNG, or WEBP image.';
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'Profile picture size cannot be more than 5MB.';
      return false;
    }

    return true;
  }

  // Release the temporary object URL used for the selected image preview
  private revokeSelectedProfileImagePreview(): void {
    if (this.selectedProfileImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedProfileImagePreviewUrl);
      this.selectedProfileImagePreviewUrl = undefined;
    }
  }

  // Extract a friendly error message from API validation responses
  private getRequestErrorMessage(error: any): string | undefined {
    if (error?.status === 404) {
      return 'Profile picture upload is not available yet. Restart the API and try again.';
    }

    if (error?.status === 401) {
      return 'Your session expired. Sign in again and try saving the picture.';
    }

    if (error?.status === 413) {
      return 'Profile picture size cannot be more than 5MB.';
    }

    const errors = error?.error?.errors ?? error?.error;
    if (typeof errors === 'string') {
      return errors;
    }

    if (!errors || typeof errors !== 'object') {
      return undefined;
    }

    const firstError = Object.values(errors)
      .flat()
      .find((message) => !!message);
    return typeof firstError === 'string' ? firstError : undefined;
  }

  // Provide deletion-specific guidance while preserving API validation details
  private getDeleteAccountErrorMessage(error: any): string {
    if (error?.status === 404 || error?.status === 405) {
      return 'The running API has not loaded account deletion yet. Restart the API and try again.';
    }

    if (error?.status === 401) {
      return 'Your session expired. Sign in again before deleting your account.';
    }

    return (
      this.getRequestErrorMessage(error) || 'Unable to delete your account.'
    );
  }
}
