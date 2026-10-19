import crypto from 'node:crypto';

// Short random ids with a prefix, like the app uses: u3f9a1c2b7e, p8d02e4a1c9 ...
export const newId = (prefix) => `${prefix}${crypto.randomBytes(5).toString('hex')}`;

export const nowIso = () => new Date().toISOString();
