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
  /** Основной адрес жителя: с него начинается новая заявка. */
  primary: boolean;
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
  /** Идентификаторы загруженных вложений. */
  attachmentIds: string[];
};
export type CreateRequestResult = {
  id: string;
  /** Номер заявки для жителя. */
  number: number;
  /** Время создания, ISO 8601. */
  createdAt: string;
  status: 'new';
  /** За сколько минут отвечает диспетчер. */
  answerWithinMin: number;
};

export type UploadAttachmentInput = {
  file: { uri: string; name: string; mimeType?: string; size?: number };
  signal?: AbortSignal;
  /** Доля загруженного, от 0 до 1. */
  onProgress?: (fraction: number) => void;
};
export type UploadAttachmentResult = { id: string };

/** Контракт данных мобильного приложения (см. api/openapi.yaml). */
export interface ApiClient {
  requestCode(input: RequestCodeInput): Promise<RequestCodeResult>;
  verifyCode(input: VerifyCodeInput): Promise<VerifyCodeResult>;
  searchHouses(input: { query: string }): Promise<House[]>;
  submitResidency(input: SubmitResidencyInput): Promise<SubmitResidencyResult>;
  getResidencies(): Promise<Residency[]>;
  suggestCategory(input: { text: string; signal?: AbortSignal }): Promise<Category | null>;
  createRequest(input: CreateRequestInput): Promise<CreateRequestResult>;
  getCategories(): Promise<Category[]>;
  /** При отмене через signal бросает ApiError('aborted'). */
  uploadAttachment(input: UploadAttachmentInput): Promise<UploadAttachmentResult>;
}

export type ApiErrorCode =
  'invalid_code' | 'rate_limited' | 'network' | 'validation' | 'aborted' | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Через сколько секунд повторить (для rate_limited). */
  readonly retryAfterSec?: number;

  constructor(code: ApiErrorCode, message?: string, retryAfterSec?: number) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}
