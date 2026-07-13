// Interface for updating the current user's profile
export interface UpdateProfileRequest {
  // Updated username for the current user
  userName: string;

  // Updated email address for the current user
  email: string;

  // Current password required when changing the password
  currentPassword?: string | null;

  // Optional new password for the current user
  newPassword?: string | null;

  // Saved object position for the user's profile image
  profileImagePosition?: string | null;
}
