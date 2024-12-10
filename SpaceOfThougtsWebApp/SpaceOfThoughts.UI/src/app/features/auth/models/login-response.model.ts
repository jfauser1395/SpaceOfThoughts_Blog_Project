// Interface for the response received after a successful login
export interface LoginResponse {
    id: string; // User's unique identifier
    userName: string; // User's username
    email: string; // User's email address
    token: string; // JWT token for authentication
    roles: string[]; // Array of roles assigned to the user
}
