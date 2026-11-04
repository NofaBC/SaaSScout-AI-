export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "REQUEST_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
