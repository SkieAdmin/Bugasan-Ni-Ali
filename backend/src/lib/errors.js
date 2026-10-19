// Errors with an HTTP status. Throw one anywhere in a route or service and the
// error handler turns it into a JSON response: { error: "message", fields?: {...} }.

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, fields);
export const unauthorized = (message = 'Please log in first.') => new HttpError(401, message);
export const forbidden = (message = 'You are not allowed to do this.') => new HttpError(403, message);
export const notFound = (what = 'Item') => new HttpError(404, `${what} not found.`);
export const conflict = (message) => new HttpError(409, message);
