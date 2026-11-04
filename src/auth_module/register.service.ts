import {inject, Injectable} from '@angular/core';
import type {RegisterRequest} from '../contracts/auth';
import {AuthCallService} from './auth-call.service';

@Injectable({providedIn: 'root'})
export class RegisterService {
  private readonly call = inject(AuthCallService);
  register(body: RegisterRequest) { return this.call.register(body); }
}
