// Interface for the data required to register a new user
export interface RegisterRequest {
  userName: string; // Desired username for the new user
  email: string; // Email address of the new user
  password: string; // Password for the new user
}
