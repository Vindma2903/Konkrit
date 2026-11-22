export type Channel = 'phone' | 'email';
export type ResidencyRole = 'owner' | 'tenant';
export type Verification = 'receipt' | 'document';
export type ResidencyStatus = 'pending' | 'confirmed';

export type User = {
  id: string;
  phone?: string;
  email?: string;
};

export type House = {
  id: string;
  /** Название ЖК или дома. */
  title: string;
  address: string;
  /** Название управляющей компании. */
  company: string;
};

export type Residency = {
  id: string;
  houseId: string;
  /** Полный адрес дома. */
  address: string;
  apartment: string;
  status: ResidencyStatus;
};

export type Category = {
  id: string;
  name: string;
};

export type RequestCodeInput = { channel: Channel; value: string };
export type RequestCodeResult = { retryAfterSec: number };

export type VerifyCodeInput = { channel: Channel; value: string; code: string };
export type VerifyCodeResult = {
  accessToken: string;
  refreshToken: string;
  user: User;
  hasResidency: boolean;
};

export type SubmitResidencyInput = {
  houseId: string;
  apartment: string;
  /** Нужен при подтверждении по коду из квитанции. */
  account?: string;
  role: ResidencyRole;
  verification: Verification;
};
export type SubmitResidencyResult = { id: string; status: 'pending' };

export type CreateRequestInput = {
  categoryId: string;
  description: string;
  residencyId: string;
};
export type CreateRequestResult = { id: string };

/** Контракт данных мобильного приложения (см. api/openapi.yaml). */
export interface ApiClient {
  requestCode(input: RequestCodeInput): Promise<RequestCodeResult>;
  verifyCode(input: VerifyCodeInput): Promise<VerifyCodeResult>;
  searchHouses(input: { query: string }): Promise<House[]>;
  submitResidency(input: SubmitResidencyInput): Promise<SubmitResidencyResult>;
  getResidencies(): Promise<Residency[]>;
  suggestCategory(input: { text: string; signal?: AbortSignal }): Promise<Category | null>;
  createRequest(input: CreateRequestInput): Promise<CreateRequestResult>;
}

export type ApiErrorCode = 'invalid_code' | 'network' | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
  }
}
