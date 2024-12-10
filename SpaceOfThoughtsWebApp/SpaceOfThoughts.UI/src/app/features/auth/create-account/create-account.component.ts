import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { StyleService } from '../../../../services/style.service';
import { RegisterRequest } from '../models/register-request.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ReactiveFormsModule],
  templateUrl: './create-account.component.html',
  styleUrl: './create-account.component.css',
})
export class CreateAccountComponent implements OnInit, OnDestroy {
  private addedUser?: Subscription; // Subscription for adding a user
  private formSubscription?: Subscription; // Subscription for form value changes
  signUpForm!: FormGroup; // FormGroup for the sign-up form
  model: RegisterRequest; // Model to hold form data
  passwordIsEqual: boolean = false; // Flag to check if passwords are equal
  passwordErrorMassage: string = ''; // Error message for password mismatch
  errorTitle: string[] = []; // Array to hold error titles
  errorTitleEmail: string = ''; // Error message for email
  errorTitleUserName: string = ''; // Error message for username
  requestOk: boolean = true; // Flag to check if the request is OK
  passwordFieldType: string = 'password'; // Type for password field
  passwordFieldTypeRepeat: string = 'password'; // Type for repeated password field

  constructor(
    private authService: AuthService, // Inject AuthService for authentication
    private router: Router, // Inject Router for navigation
    private styleService: StyleService, // Inject StyleService for styling
  ) {
    // Initialize the model with empty values
    this.model = {
      userName: '',
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

    // Declare and initialize the sign-up form
    this.signUpForm = new FormGroup({
      userName: new FormControl(null, Validators.required),
      email: new FormControl(null, [
        Validators.required,
        Validators.email,
        Validators.pattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$'),
      ]),
      password1: new FormControl(null, Validators.required),
      password2: new FormControl(null, Validators.required),
    });

    // Subscribe to valueChanges observable for password fields to reset email errors
    this.formSubscription = this.signUpForm
      .get('password1')
      ?.valueChanges.subscribe(() => {
        this.resetEmailError();
      });

    this.formSubscription?.add(
      this.signUpForm.get('password2')?.valueChanges.subscribe(() => {
        this.resetEmailError();
      }),
    );
  }

  // Reset form errors for password fields
  resetEmailError(): void {
    this.signUpForm.get('password1')?.setErrors(null);
    this.signUpForm.get('password2')?.setErrors(null);
  }

  onFormSubmit() {
    // Check password equality
    if (
      this.signUpForm.get('password1')?.value ===
        this.signUpForm.get('password2')?.value &&
      this.signUpForm.get('password1')?.value != ''
    ) {
      // Check form validity
      if (this.signUpForm.valid) {
        this.model.userName = this.signUpForm.get('userName')?.value;
        this.model.email = this.signUpForm.get('email')?.value;
        this.model.password = this.signUpForm.get('password1')?.value;
        this.passwordIsEqual = true;

        // Register the new user
        this.addedUser = this.authService.register(this.model).subscribe({
          next: (response) => {
            this.router.navigateByUrl('/'); // Navigate to the home page on successful registration
          },
          error: (error) => {
            // Handle registration errors
            this.requestOk = error.ok;
            this.errorTitleUserName = error.error.errors['userName'];
            this.errorTitleEmail = error.error.errors['email'];
            this.errorTitle = [];

            // Iterate through the error object and collect error messages
            for (let key in error.error.errors) {
              if (error.error.errors.hasOwnProperty(key)) {
                this.errorTitle.push(error.error.errors[key]);
              }
            }

            // Check which field caused the error and set custom errors on the form controls
            const errorObj = error.error.errors;
            for (const key in errorObj) {
              if (errorObj.hasOwnProperty(key)) {
                if (key === 'email') {
                  this.signUpForm
                    .get('email')
                    ?.setErrors({ customError: true });
                } else if (key === 'userName') {
                  this.signUpForm
                    .get('userName')
                    ?.setErrors({ customError: true });
                } else {
                  this.signUpForm
                    .get('password1')
                    ?.setErrors({ customError: true });
                  this.signUpForm
                    .get('password2')
                    ?.setErrors({ customError: true });
                }
              }
            }
          },
        });
      } else {
        this.signUpForm.markAllAsTouched(); // Mark all form controls as touched if the form is invalid
      }
    } else {
      // Handle password mismatch
      this.passwordIsEqual = false;
      this.signUpForm.get('password1')?.setErrors({ customError: true });
      this.signUpForm.get('password2')?.setErrors({ customError: true });
      this.passwordErrorMassage = '*Entered passwords do not match'; // Set password error message
    }
  }

  // Toggle the visibility of the password field
  togglePasswordVisibility() {
    this.passwordFieldType =
      this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  // Toggle the visibility of the repeated password field
  togglePasswordVisibilityRepeat() {
    this.passwordFieldTypeRepeat =
      this.passwordFieldTypeRepeat === 'password' ? 'text' : 'password';
  }

  // Unsubscribe form subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.addedUser?.unsubscribe();
    this.formSubscription?.unsubscribe();
  }
}
