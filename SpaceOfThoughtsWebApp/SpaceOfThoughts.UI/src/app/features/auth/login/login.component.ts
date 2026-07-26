import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { StyleService } from '../../../../services/style.service';
import { LoginRequest } from '../models/login-request.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterModule, ReactiveFormsModule, NgClass],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly styleService = inject(StyleService);
  private readonly destroyRef = inject(DestroyRef);

  // Typed controls guarantee that the API request contains two strings
  readonly loginFormGroup = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  // Signals notify the OnPush template when an asynchronous login finishes
  readonly errorTitle = signal<readonly string[]>([]);
  readonly requestOk = signal(true);
  readonly isSubmitting = signal(false);
  readonly passwordFieldType = signal<'password' | 'text'>('password');

  ngOnInit(): void {
    // Scroll up after loading the component
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Keep the login card fixed while this full-screen page is active
    this.styleService.setBodyStyle('overflow', 'hidden');

    // Remove server errors when the user edits either credential
    this.loginFormGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetFormErrors());
  }

  // Re-run required validators without retaining a previous API error
  resetFormErrors(): void {
    this.errorTitle.set([]);
    this.requestOk.set(true);
    this.loginFormGroup.controls.email.updateValueAndValidity({
      emitEvent: false,
    });
    this.loginFormGroup.controls.password.updateValueAndValidity({
      emitEvent: false,
    });
  }

  // Authenticate the typed credentials and retain the returned user session
  onFormSubmit(): void {
    if (!this.loginFormGroup.valid) {
      this.loginFormGroup.markAllAsTouched();
      return;
    }

    const model: LoginRequest = this.loginFormGroup.getRawValue();
    this.isSubmitting.set(true);

    this.authService
      .login(model)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          // The API has already set the HttpOnly authentication cookie
          this.authService.setUserFromLoginResponse(response);
          void this.router.navigateByUrl('/');
        },
        error: (error) => {
          // Show API validation details or a useful fallback for network errors
          this.requestOk.set(error.ok);
          const errors = (error.error?.errors ?? {}) as Record<
            string,
            string[]
          >;
          const messages = Object.values(errors).flat();
          this.errorTitle.set(
            messages.length > 0 ? messages : ['Unable to sign in.'],
          );
          this.loginFormGroup.controls.email.setErrors({ customError: true });
          this.loginFormGroup.controls.password.setErrors({
            customError: true,
          });
        },
      });
  }

  // Toggle the visibility of the password field
  togglePasswordVisibility(): void {
    this.passwordFieldType.update((type) =>
      type === 'password' ? 'text' : 'password',
    );
  }

  // Restore the page-level body style when the login screen closes
  ngOnDestroy(): void {
    this.styleService.removeBodyStyle('overflow');
  }
}
