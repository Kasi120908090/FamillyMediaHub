# Frontend Flow

## Startup Flow

```txt
Open app
  |
  v
BackendGate scans current Wi-Fi
  |
  +-- Backend found
  |     |
  |     v
  |   Save backend URL
  |     |
  |     v
  |   Mount ProfileProvider and navigation
  |
  +-- Backend not found
        |
        v
      Show "Backend not found on this Wi-Fi"
        |
        v
      User can tap "Scan Again"
```

## Auth Flow

```txt
Splash
  |
  +-- cached profile/session exists -> AuthProfile
  |
  +-- no cached profile/session -> Welcome

Welcome
  |
  v
AuthProfile / Login
  |
  +-- login success
  |     |
  |     +-- first login incomplete -> FirstLoginSetup
  |     |
  |     +-- parent/child ready -> default authenticated route
  |
  +-- login error -> show error in auth screen
```

## Session Restore Flow

```txt
ProfileProvider bootstraps
  |
  v
Read token and user from AsyncStorage
  |
  +-- no token -> unauthenticated
  |
  +-- token found
        |
        v
      authService.getMe(token)
        |
        +-- success -> merge user, persist session
        |
        +-- unauthorized -> clear session
        |
        +-- first login incomplete -> mark first login required
```

## Route Guard Flow

```txt
User navigates to route
  |
  v
withRouteGuard checks auth/session state
  |
  +-- screen requires auth and user is not logged in -> AuthProfile
  |
  +-- first login required -> FirstLoginSetup
  |
  +-- parent admin only route and user is not parent admin -> default route
  |
  +-- allowed -> render screen
```

## Main App Flow

```txt
Authenticated user
  |
  v
Gallery
  |
  +-- Images
  +-- Videos
  +-- Files
  +-- Upload
  +-- Backup Dashboard
  +-- Profile
  +-- Recycle Bin
```

## Parent/Child Profile Flow

```txt
Parent account
  |
  +-- view parent media
  |
  +-- select child
        |
        v
      load child details
        |
        v
      load child media

Child account
  |
  v
Force selected child to logged-in child profile
  |
  v
Load own media
```

## Gallery Flow

```txt
Open Gallery
  |
  v
loadChildMedia(...)
  |
  v
mediaItems stored in ProfileContext
  |
  v
Gallery filters by:
  - selected child
  - media type
  - search query
  - date range
  - sort order
  |
  v
Render grouped sections
```

Gallery item actions:

```txt
Tap image -> ImageViewer modal
Tap video -> VideoPlayer modal
Tap file  -> Files screen
```

## Image Flow

```txt
ImagesScreen / Gallery image tile
  |
  v
resolveMediaUri(file_path)
  |
  v
CachedImage
  |
  +-- remote URL already cached -> use local file URI
  |
  +-- not cached -> download to Expo cache directory
```

Full-screen image:

```txt
Tap image
  |
  v
ImageViewer
  |
  +-- swipe images
  +-- pinch zoom
  +-- share
  +-- move to recycle bin if allowed
```

## Video Flow

```txt
VideosScreen / Gallery video tile
  |
  v
VideoThumbnail
  |
  +-- thumbnail URL exists -> CachedImage
  |
  +-- no thumbnail URL -> lightweight video icon fallback
```

Playback:

```txt
Tap video
  |
  v
Video modal
  |
  v
VideoPlayer streams from discovered backend URL
  |
  +-- native controls
  +-- poster thumbnail if available
  +-- delete/move to recycle bin if allowed
```

## Upload Flow

```txt
User selects media/file
  |
  v
UploadScreen builds payload
  |
  v
ProfileContext.uploadMedia
  |
  v
mediaService.uploadMedia
  |
  +-- normal file/video <= 100MB
  |     |
  |     v
  |   FormData POST /users/media/upload
  |
  +-- large video > 100MB
        |
        v
      init chunked upload
        |
        v
      upload chunks
        |
        v
      complete upload
```

After upload:

```txt
uploaded item inserted into mediaItems
media list cache cleared
previewUri uses selected local file URI
```

## Recycle Bin Flow

```txt
Move media to recycle bin
  |
  v
Remove item from mediaItems
  |
  v
Add item to recycleBinItems with deleted_at
```

Restore:

```txt
Tap restore
  |
  v
Remove from recycleBinItems
  |
  v
Add back to mediaItems
```

Note: current recycle-bin behavior is frontend/local state based.

## Backup Flow

```txt
Authenticated user
  |
  v
BackupAutoSyncController
  |
  v
useBackupAutoSync
  |
  +-- checks devices/settings
  +-- queues eligible files
  +-- uploads through backupService
  +-- updates progress/status
```

Backup screens:

```txt
BackupDashboardScreen -> overview and backup status
BackupSettingsScreen  -> backup preferences/settings
```

## Wi-Fi Change Flow

```txt
Network state changes
  |
  v
backendDiscoveryService scans again
  |
  +-- backend found
  |     |
  |     v
  |   update saved base URL
  |
  +-- backend not found
        |
        v
      show not-found gate
```

## Error Flow

Common frontend error paths:

```txt
Backend not discovered -> "Backend not found on this Wi-Fi"
Network request failed -> unable to reach discovered server
401 unauthorized -> clear session and return to auth
403 first login incomplete -> FirstLoginSetup
Validation/API error -> parsed API message shown by calling screen
```

