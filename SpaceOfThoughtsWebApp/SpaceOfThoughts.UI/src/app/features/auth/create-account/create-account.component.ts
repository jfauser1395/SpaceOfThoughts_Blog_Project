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
import { finalize, merge } from 'rxjs';
import { StyleService } from '../../../../services/style.service';
import { RegisterRequest } from '../models/register-request.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-create-account',
  imports: [RouterModule, ReactiveFormsModule, NgClass],
  templateUrl: './create-account.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './create-account.component.css',
})
export class CreateAccountComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly styleService = inject(StyleService);
  private readonly destroyRef = inject(DestroyRef);

  // Typed, non-nullable controls remove null checks from the registration request
  readonly signUpForm = new FormGroup({
    userName: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.pattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$'),
      ],
    }),
    password1: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    password2: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  // Signals expose request feedback and password visibility to the OnPush view
  readonly passwordIsEqual = signal(true);
  readonly errorTitle = signal<readonly string[]>([]);
  readonly errorTitleEmail = signal('');
  readonly errorTitleUserName = signal('');
  readonly requestOk = signal(true);
  readonly isSubmitting = signal(false);
  readonly passwordFieldType = signal<'password' | 'text'>('password');
  readonly passwordFieldTypeRepeat = signal<'password' | 'text'>('password');
  readonly passwordErrorMessage = '*Entered passwords do not match';

  ngOnInit(): void {
    // Scroll up after loading the component
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Keep the account card fixed while this full-screen page is active
    this.styleService.setBodyStyle('overflow', 'hidden');

    // Clear a previous mismatch as soon as either password is edited
    merge(
      this.signUpForm.controls.password1.valueChanges,
      this.signUpForm.controls.password2.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetPasswordErrors());
  }

  // Re-run built-in validators without preserving an old server or mismatch error
  resetPasswordErrors(): void {
    this.passwordIsEqual.set(true);
    this.signUpForm.controls.password1.updateValueAndValidity({
      emitEvent: false,
    });
    this.signUpForm.controls.password2.updateValueAndValidity({
      emitEvent: false,
    });
  }

  // Validate credentials, register the account, and use the returned login session
  onFormSubmit(): void {
    const { userName, email, password1, password2 } =
      this.signUpForm.getRawValue();

    // Check password equality before calling the API
    if (password1 === password2 && password1 !== '') {
      if (!this.signUpForm.valid) {
        this.signUpForm.markAllAsTouched();
        return;
      }

      const model: RegisterRequest = {
        userName,
        email,
        password: password1,
      };
      this.passwordIsEqual.set(true);
      this.isSubmitting.set(true);

      // Register the user and retain the authenticated response from the API
      this.authService
        .register(model)
        .pipe(
          finalize(() => this.isSubmitting.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (response) => {
            // The API has already set the HttpOnly cookie for this new account
            this.authService.setUserFromLoginResponse(response);
            void this.router.navigateByUrl('/', { replaceUrl: true });
          },
          error: (error) => {
            // Map API validation details back to their matching form controls
            this.requestOk.set(error.ok);
            const errors = (error.error?.errors ?? {}) as Record<
              string,
              string[]
            >;
            this.errorTitleUserName.set(errors['userName']?.[0] ?? '');
            this.errorTitleEmail.set(errors['email']?.[0] ?? '');
            this.errorTitle.set(Object.values(errors).flat());

            for (const key in errors) {
              if (!Object.prototype.hasOwnProperty.call(errors, key)) {
                continue;
              }

              if (key === 'email') {
                this.signUpForm.controls.email.setErrors({
                  customError: true,
                });
              } else if (key === 'userName') {
                this.signUpForm.controls.userName.setErrors({
                  customError: true,
                });
              } else {
                this.signUpForm.controls.password1.setErrors({
                  customError: true,
                });
                this.signUpForm.controls.password2.setErrors({
                  customError: true,
                });
              }
            }
          },
        });
      return;
    }

    // Mark both password controls when their values do not match
    this.passwordIsEqual.set(false);
    this.signUpForm.controls.password1.setErrors({ customError: true });
    this.signUpForm.controls.password2.setErrors({ customError: true });
  }

  // Toggle the visibility of the password field
  togglePasswordVisibility(): void {
    this.passwordFieldType.update((type) =>
      type === 'password' ? 'text' : 'password',
    );
  }

  // Toggle the visibility of the repeated password field
  togglePasswordVisibilityRepeat(): void {
    this.passwordFieldTypeRepeat.update((type) =>
      type === 'password' ? 'text' : 'password',
    );
  }

  // Restore the page-level body style when the account screen closes
  ngOnDestroy(): void {
    this.styleService.removeBodyStyle('overflow');
  }
}
