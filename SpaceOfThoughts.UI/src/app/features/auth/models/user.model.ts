// Interface representing a user's data
export interface User {
    id: string; // User's unique identifier
    userName: string; // User's username
    email: string; // User's email address
    roles: string[]; // Array of roles assigned to the user
}
