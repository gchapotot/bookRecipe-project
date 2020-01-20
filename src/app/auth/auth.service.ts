import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { throwError, BehaviorSubject } from 'rxjs';

import { User } from './user.model';

import { firebaseConfig } from 'config/config'

export interface AuthResponseData {
    kind: string;
    idToken: string;
    email: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    user = new BehaviorSubject<User>(null);
    tokenExpirationDuration: any;

    constructor(
        private http: HttpClient, 
        private router: Router
    ) { }

    signup(email: string, password: string) {
        return this.http.post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + firebaseConfig,
            {
                email: email,
                password: password,
                returnSecureToken: true
            }
        ).pipe(
            catchError(this.errorHandling), tap(
                resData => {
                    this.authHandling(resData.email, resData.localId, resData.idToken, +resData.expiresIn);
                }
            )
        );
    }

    login(email: string, password: string) {
        return this.http.post<AuthResponseData>('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebaseConfig,
            {
                email: email,
                password: password,
                returnSecureToken: true
            }
        ).pipe(
            catchError(this.errorHandling), tap(
                resData => {
                    this.authHandling(resData.email, resData.localId, resData.idToken, +resData.expiresIn);
                }
            )
        );
    }

    autoLogin() {
        const userData: {
            email: string,
            id: string,
            _token: string,
            _tokenExpirationDate: string
        } = JSON.parse(localStorage.getItem('userData'));

        if (!userData) {
            return;
        }

        const loadedUser = new User(userData.email, userData.id, userData._token, new Date(userData._tokenExpirationDate));

        if (loadedUser.token) {
            this.user.next(loadedUser);
            const expirationDuration = new Date(userData._tokenExpirationDate).getTime() - new Date().getTime();
            this.autoLogout(expirationDuration);
        }

    }

    logout() {
        this.user.next(null);
        this.router.navigate(['/auth']);
        localStorage.removeItem('userData');
        if (this.tokenExpirationDuration) {
            clearTimeout(this.tokenExpirationDuration);
        }
        this.tokenExpirationDuration = null;
    }

    autoLogout(expirationDuration: number) {
        console.log(expirationDuration);
        this.tokenExpirationDuration = setTimeout(() => {
            this.logout();
        }, expirationDuration);
    }

    private authHandling(email: string, id: string, token: string, expriresIn: number) {
        const expirationDate = new Date(new Date().getTime() + expriresIn * 1000);
        const user = new User(
            email,
            id,
            token,
            expirationDate);
        this.user.next(user);
        localStorage.setItem('userData', JSON.stringify(user));
        this.autoLogout(expriresIn * 1000);
        
    }

    private errorHandling(error: HttpErrorResponse) {
        console.log(error);
        let errorMessage = 'Unknown Error !';
        if (!error.error || !error.error.error) {
            return throwError(errorMessage);
        }
        switch (error.error.error.message) {
            case 'EMAIL_EXISTS':
                errorMessage = 'This email exists already !';
                break;
            case 'INVALID_PASSWORD':
                errorMessage = 'Invalid password !';
                break;
            case 'EMAIL_NOT_FOUND':
                errorMessage = 'Email not found !';
                break;
        };
        return throwError(errorMessage);
    }
}