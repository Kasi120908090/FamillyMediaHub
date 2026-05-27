# Frontend Architecture

## Overview

Family Media Hub is an Expo React Native mobile app. The frontend is responsible for authentication, family profile selection, media browsing, uploads/backups, local media caching, and automatic backend discovery on the current Wi-Fi network.

The app starts from `index.js`, renders `src/App.js`, discovers the backend, then mounts the main navigation and context providers.

## Tech Stack

- React Native `0.81.5`
- Expo SDK `54`
- React `19.1.0`
- React Navigation stack and bottom tabs
- AsyncStorage for persisted session and discovered backend URL
- Expo Network for Wi-Fi IP/subnet discovery
- Expo FileSystem for chunked uploads and local media cache
- Expo Video for video playback

## High-Level Structure

```txt
src/
  App.js
  components/
    auth/
    common/
    layout/
    media/
    navigation/
  config/
    endpoints.js
    env.js
  context/
    AuthContext.js
    ProfileContext.js
    ThemeContext.js
  hooks/
    useAsyncResource.js
    useBackupAutoSync.js
    useCachedMediaUri.js
  navigation/
    StackNavigator.js
  screens/
    auth/
    backup/
    media/
    profile/
  services/
    api.js
    authService.js
    backendDiscoveryService.js
    backupService.js
    mediaService.js
    userService.js
  theme/
  utils/
```

## Application Boot

`src/App.js` wraps the app with:

- `GestureHandlerRootView`
- `SafeAreaProvider`
- `ThemeProvider`
- `BackendGate`
- `ProfileProvider`
- `BackupAutoSyncController`
- `NavigationContainer`
- `StackNavigator`

Before authenticated screens mount, `BackendGate` runs backend discovery. If the backend is found, the app continues. If not, it shows:

```txt
Backend not found on this Wi-Fi
```

with a retry action.

## Backend Discovery

The backend URL is not hardcoded anymore. Discovery lives in:

```txt
src/services/backendDiscoveryService.js
```

Flow:

1. Read current device IP using `expo-network`.
2. Extract subnet prefix, for example `192.168.1`.
3. Scan `192.168.1.1` to `192.168.1.254` on port `8000`.
4. Request `/health` with a 1 second timeout.
5. If response contains `service === "my-backend"`, save:

```txt
http://<matched-ip>:8000
```

6. Persist the base URL in AsyncStorage.
7. Re-scan when Wi-Fi/network changes.

The backend `/health` response should include:

```json
{
  "service": "my-backend",
  "status": "ok"
}
```

## API Layer

All API requests go through:

```txt
src/services/api.js
```

`apiRequest(endpoint, options)`:

- Gets the discovered backend URL from `backendDiscoveryService`.
- Attaches JSON headers.
- Adds `Authorization: Bearer <token>` when a token is provided.
- Serializes JSON bodies.
- Handles `FormData` uploads.
- Normalizes API/network errors.

Media URLs are resolved through `resolveMediaUri(filePath)`, which also uses the discovered backend URL.

## Context Providers

### ProfileContext

File:

```txt
src/context/ProfileContext.js
```

Responsibilities:

- Persist and restore auth session.
- Store current user/profile.
- Store family children and selected child.
- Store parent devices.
- Store media items and recycle bin items.
- Load media for parent/child/device.
- Upload media.
- Manage first-login setup state.
- Determine route access flags.

Important state:

```txt
authToken
currentUser
profile
viewerProfile
children
selectedChildId
selectedChild
mediaItems
recycleBinItems
parentDevices
isAuthenticated
isBootstrapping
canManageMedia
```

### ThemeContext

File:

```txt
src/context/ThemeContext.js
```

Provides the active theme object used by screens and navigation.

## Navigation

File:

```txt
src/navigation/StackNavigator.js
```

The app uses a stack navigator with custom route guards.

Route groups:

- Auth: `Splash`, `Welcome`, `AuthProfile`
- First login and verification: `FirstLoginSetup`, `VerifyIdentity`, `VerifyOTP`
- Main media: `Gallery`, `Images`, `Videos`, `Files`, `RecycleBin`, `Upload`
- Profile: `Profile`, `EditProfile`, `Notifications`, `Appearance`
- Backup: `BackupDashboard`, `BackupSettings`

Most authenticated screens are wrapped with:

```txt
withRouteGuard(...)
withBottomNav(...)
```

`withRouteGuard` redirects unauthenticated users back to auth/profile selection.

`withBottomNav` adds bottom navigation and the menu drawer around main screens.

## Media Architecture

Media rendering is split between screens, components, services, and utilities.

### Screens

- `GalleryScreen.js`: combined image/video/file timeline.
- `ImagesScreen.js`: image-only grid/list and image viewer.
- `VideosScreen.js`: video-only grid/list and video modal.
- `FilesScreen.js`: file/document list.
- `RecycleBinScreen.js`: locally managed recycle bin view.
- `UploadScreen.js`: manual media upload.

### Components

- `ImageViewer.js`: full-screen image viewer.
- `VideoPlayer.js`: full-screen/video playback wrapper.
- `VideoThumbnail.js`: video thumbnail or lightweight fallback icon.
- `CachedImage.js`: image component that caches remote images locally.
- `ZoomableMedia.js`: pinch/zoom wrapper.
- `MediaDesign.js`: shared UI pieces for media screens.

### Local Image/Thumbnail Cache

Files:

```txt
src/hooks/useCachedMediaUri.js
src/components/media/CachedImage.js
```

Remote image and thumbnail URLs are downloaded into Expo cache directory and reused by URI hash. This reduces repeat backend requests during fast navigation.

The app does not cache full videos before playback because videos can be large and would increase startup/open latency and storage usage.

### Media List Cache

File:

```txt
src/services/mediaService.js
```

Media list API calls are cached for a short time and in-flight requests are deduplicated. This prevents repeated list fetches when screens are opened quickly.

Uploads clear the media list cache.

## Upload Architecture

File:

```txt
src/services/mediaService.js
```

Small uploads use normal `FormData`.

Large videos use chunked upload:

1. Init upload.
2. Split file into chunks.
3. Hash each chunk.
4. Upload each chunk.
5. Complete upload with final checksum.
6. Remove temporary chunk files.

Large video threshold:

```txt
100 MB
```

Chunk size:

```txt
8 MB
```

## Backup Architecture

Files:

```txt
src/hooks/useBackupAutoSync.js
src/services/backupService.js
src/services/backupAutoSyncService.js
src/services/backupBackgroundTask.js
src/services/backupQueueStore.js
```

The backup system handles:

- Device backup initialization.
- File status checks.
- Upload progress.
- Background/queued backup support.
- Backup dashboard and settings UI.

## Data Flow Diagram

```txt
App start
  |
  v
BackendGate
  |
  v
backendDiscoveryService
  |
  +-- get phone IP/subnet
  +-- scan port 8000
  +-- call /health
  +-- save discovered base URL
  |
  v
ProfileProvider
  |
  +-- restore token/user from AsyncStorage
  +-- call auth/me
  +-- load children/devices/media
  |
  v
StackNavigator
  |
  +-- auth screens
  +-- gallery/images/videos/files
  +-- upload/backup/profile
```

## Important Runtime Storage

AsyncStorage keys include:

```txt
@family-media-hub/token
@family-media-hub/user
@family-media-hub/backend-base-url
@family-media-hub/backend-subnet
@family-media-hub/profile-options
```

## Backend Requirements

The mobile app expects:

- Backend reachable from phone on same Wi-Fi/LAN.
- Backend listens on port `8000`.
- `/health` returns `service: "my-backend"`.
- API routes match `src/config/endpoints.js`.
- Media file paths can be resolved relative to backend base URL.

