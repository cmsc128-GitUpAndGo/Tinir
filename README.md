# Tinir

Tinir is an accommodation finder for UPV students and property owners. This repository currently contains an Expo starter using React Native, TypeScript, and Expo Router.

## Requirements

- Git
- Node.js 22.13 or later within the 22.x release line, with npm (compatible with the installed Expo SDK 58)
- An Android emulator, a compatible phone setup, or a browser to preview the app

Check your installation:

```bash
node --version
npm --version
```

## Set up the project

Clone the repository and install the dependencies recorded in `package-lock.json`:

```bash
git clone https://github.com/cmsc128-GitUpAndGo/Tinir.git
cd Tinir
npm ci
```

If you already have this repository open, run `npm ci` from its root folder. Expo is already initialized here; `create-expo-app` is only needed when creating a new project.

## Start the app

```bash
npm start
```

Keep this terminal running while developing. Choose how to open the app:

| Target | How to open it | What you need |
|---|---|---|
| Phone | Scan the terminal QR code with Expo Go | An Expo Go version compatible with SDK 58; phone and computer on the same Wi-Fi |
| Android emulator | Press `a`, or run `npm run android` | Android Studio with an Android SDK and a configured emulator |
| iOS Simulator | Press `i`, or run `npm run ios` | macOS with Xcode and an installed simulator |
| Web | Press `w`, or run `npm run web` | A browser; useful for checking the web version |

If Expo Go does not support this SDK or a required native module, use a [development build](https://docs.expo.dev/develop/development-builds/introduction/). On a physical iOS device, Expo Go requires the CLI and phone app to be signed into the same Expo account; run `npx expo login` on the computer.

Edit `src/app/index.tsx` to change the home screen. Saving a file normally refreshes the app automatically. Press `Ctrl+C` in the terminal to stop the server.

## Useful commands

Run these from the repository root:

```bash
# Check TypeScript
npx tsc --noEmit

# Check Expo configuration and dependencies
npx expo-doctor

# Lint the app (first run may install ESLint and generate its config)
npm run lint

# Add an SDK-compatible package
npx expo install <package-name>
```

## Connection problems

If the phone cannot reach the development server, first check that both devices are on the same Wi-Fi. For networks that block local connections, try a tunnel:

```bash
npx expo start --tunnel
```

Expo may prompt to install its tunnel dependency. Tunnel connections can be slower than local Wi-Fi.

For stale bundler output, restart with a cleared cache:

```bash
npx expo start --clear
```

## Project layout

```text
src/app/          Screens and navigation layouts
src/components/   Shared UI components
src/hooks/        Shared hooks
src/constants/    Theme constants
assets/           Images and app icons
docs/             Product and technical documents
app.json          Expo app configuration
```

Product documents: [PRD](docs/PRD.md), [TRD](docs/TRD.md), and [Requirements](docs/REQUIREMENTS.md).

For more setup details, see the [Expo development guide](https://docs.expo.dev/get-started/start-developing/) and [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/).
