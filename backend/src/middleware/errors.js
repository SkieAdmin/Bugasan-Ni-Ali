// Turns every error into a JSON response: { error: "message", fields?: {...} }
import { HttpError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` });
}

// Express recognizes an error handler by its 4 arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.fields && { fields: err.fields }) });
  }
  // Errors from express.json() (bad JSON, body too large ...) carry their own status.
  if (err.type && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'The request body is not valid JSON.' : err.message;
    return res.status(err.status).json({ error: message });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
