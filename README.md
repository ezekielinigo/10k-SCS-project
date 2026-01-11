## Setup

1. If new ink files made, compile with
```bash
npm run compile:ink
```
2. From repo root, run
```bash
npx expo start
```
3. Open in Expo Go

## Building a custom Expo dev client (EAS)

To use native modules like `@shopify/react-native-skia` while keeping an Expo-style workflow, create a custom dev client with EAS:

1. Install the EAS CLI if you don't have it:

```bash
npm install -g eas-cli
# or use: npx eas
```

2. Install dependencies and `expo-dev-client`:

```bash
npm install
npm install --save-dev expo-dev-client
```

3. Build a development dev-client (cloud build):

```bash
eas build -p android --profile development
```

4. Install the generated APK on your device, then run Metro with the dev client:

```bash
expo start --dev-client
```

Notes:
- The repo includes `eas.json` with a `development` profile that builds an APK dev client.
- You can also run `eas build` with `--local` if you have Docker and want to build locally.
