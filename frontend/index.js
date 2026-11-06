// App entry.
// The background task that looks for order updates must be defined before anything else runs:
// Android can start the app just to run it, without opening a screen.
import './src/notifications/backgroundCheck';
import 'expo-router/entry';
