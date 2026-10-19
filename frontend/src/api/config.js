// Where the backend API lives.
// For testing against a backend on your computer, start Expo with your computer's Wi-Fi IP, e.g.
//   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api npx expo start
// (or put that line in frontend/.env.local).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://perlas.ccshub.uk/api').replace(/\/+$/, '');
