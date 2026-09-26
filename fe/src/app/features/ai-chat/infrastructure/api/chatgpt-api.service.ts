import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { map, timeout } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { NO_AUTOMATIC_REPLAY } from '../../../../api/interceptors/request-policy';

export interface ChatgptStatus {
  enabled: boolean;
  status: 'disconnected' | 'pending' | 'connected' | 'expired';
  expiresAt?: string;
  attemptId?: string;
  verificationUri?: string;
  userCode?: string;
  intervalSeconds?: number;
}

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ChatgptApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v3/ai/chatgpt`;
  private readonly options = { context: new HttpContext().set(NO_AUTOMATIC_REPLAY, true) };

  status() {
    return this.http.get<ApiResponse<ChatgptStatus>>(`${this.base}/status`, this.options)
      .pipe(timeout(20_000), map(response => response.data));
  }

  start() {
    return this.http.post<ApiResponse<ChatgptStatus>>(`${this.base}/device`, {}, this.options)
      .pipe(timeout(30_000), map(response => response.data));
  }

  poll(attemptId: string) {
    return this.http.post<ApiResponse<ChatgptStatus>>(`${this.base}/poll`, { attemptId }, this.options)
      .pipe(timeout(30_000), map(response => response.data));
  }

  ask(question: string) {
    return this.http.post<ApiResponse<{ answer: string }>>(`${this.base}/ask`, { question }, this.options)
      .pipe(timeout(95_000), map(response => response.data));
  }

  disconnect() {
    return this.http.delete<ApiResponse<ChatgptStatus>>(`${this.base}/connection`, this.options)
      .pipe(timeout(20_000), map(response => response.data));
  }
}
