import { Component, OnInit, OnDestroy } from '@angular/core';
import { LoginRequest } from '../models/login-request.model';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CookieService } from 'ngx-cookie-service';
import { Router, RouterModule } from '@angular/router';
import { StyleService } from '../../../../services/style.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  private user?: Subscription; // Subscription for user login
  private formSubscription?: Subscription; // Subscription for form value changes
  model: LoginRequest; // Model to hold login data
  errorTitle: string[] = []; // Array to hold error messages
  requestOk: boolean = true; // Flag to check if the request is successful
  passwordFieldType: string = 'password'; // Type for password field
  loginFormGroup!: FormGroup; // FormGroup for the login form

  constructor(
    private authService: AuthService, // Inject AuthService for authentication
    private cookieService: CookieService, // Inject CookieService for handling cookies
    private router: Router, // Inject Router for navigation
    private styleService: StyleService, // Inject StyleService for styling
  ) {
    // Initialize the login model with empty values
    this.model = {
      email: '',
      password: '',
    };
  }

  ngOnInit(): void {
    // Scroll up after loading the component
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Set the body style to hide overflow
    this.styleService.setBodyStyle('overflow', 'hidden');

    // Declare and initialize the login form group
    this.loginFormGroup = new FormGroup({
      email: new FormControl(null, Validators.required),
      password: new FormControl(null, Validators.required),
    });

    // Subscribe to valueChanges observable for form controls to reset form errors
    this.formSubscription = this.loginFormGroup.valueChanges.subscribe(() => {
      this.resetFormErrors();
    });
  }

  // Reset form errors for all form controls
  resetFormErrors(): void {
    Object.keys(this.loginFormGroup.controls).forEach((key) => {
      this.loginFormGroup.get(key)?.setErrors(null);
    });
  }

  // Handle form submission
  onFormSubmit() {
    // Check if the form is valid
    if (this.loginFormGroup.valid) {
      this.model.email = this.loginFormGroup.get('email')?.value;
      this.model.password = this.loginFormGroup.get('password')?.value;

      // Call the login method from AuthService
      this.user = this.authService.login(this.model).subscribe({
        next: (response) => {
          // Set authorization cookie with the received token
          this.cookieService.set(
            'Authorization',
            `Bearer ${response.token}`,
            undefined,
            '/',
            undefined,
            true,
            'Strict',
          );

          // Set the user in the AuthService
          this.authService.setUser({
            id: response.id,
            userName: response.userName,
            email: response.email,
            roles: response.roles,
          });

          // Redirect to the home page
          this.router.navigateByUrl('/');
        },
        error: (error) => {
          // Handle login errors
          this.requestOk = error.ok;
          this.errorTitle = [];

          // Iterate through the error object and collect error messages
          for (let key in error.error.errors) {
            if (error.error.errors.hasOwnProperty(key)) {
              this.errorTitle.push(error.error.errors[key]);
            }
          }

          // Set custom errors on the form controls if there are error messages
          if (this.errorTitle) {
            this.loginFormGroup.get('email')?.setErrors({ customError: true });
            this.loginFormGroup
              .get('password')
              ?.setErrors({ customError: true });
          }
        },
      });
    } else {
      // Mark all form controls as touched if the form is invalid
      this.loginFormGroup.markAllAsTouched();
    }
  }

  // Toggle the visibility of the password field
  togglePasswordVisibility() {
    this.passwordFieldType =
      this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.user?.unsubscribe();
    this.formSubscription?.unsubscribe();
  }
}
