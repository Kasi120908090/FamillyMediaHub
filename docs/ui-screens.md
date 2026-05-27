# UI Screens

This file lists the main mobile screens and where to place screenshots.

Real screenshots should be captured from a device/emulator after the backend is running on the same Wi-Fi and `/health` returns:

```json
{
  "service": "my-backend",
  "status": "ok"
}
```

## Screenshot Folder

Use this folder:

```txt
docs/screenshots/
```

Recommended image names:

```txt
01-backend-scanning.png
02-backend-not-found.png
03-welcome.png
04-login-profile.png
05-gallery.png
06-images-grid.png
07-image-viewer.png
08-videos-grid.png
09-video-player.png
10-files.png
11-upload.png
12-backup-dashboard.png
13-profile.png
14-recycle-bin.png
```

## Screen Map

| Screen | File | Purpose | Screenshot |
| --- | --- | --- | --- |
| Backend scanning | `src/App.js` | Scans current Wi-Fi for backend | `docs/screenshots/01-backend-scanning.png` |
| Backend not found | `src/App.js` | Shows backend discovery failure and retry | `docs/screenshots/02-backend-not-found.png` |
| Splash | `src/screens/auth/SplashScreen.js` | Initial loading/session routing | `docs/screenshots/03-splash.png` |
| Welcome | `src/screens/auth/WelcomeScreen.js` | First-time entry screen | `docs/screenshots/03-welcome.png` |
| Auth profile/login | `src/screens/auth/ProfileScreen.js` | Profile selection and login entry | `docs/screenshots/04-login-profile.png` |
| First login setup | `src/screens/auth/FirstLoginSetupScreen.js` | Required initial verification/setup | `docs/screenshots/first-login-setup.png` |
| Gallery | `src/screens/media/GalleryScreen.js` | Combined media timeline | `docs/screenshots/05-gallery.png` |
| Images | `src/screens/media/ImagesScreen.js` | Image grid/list | `docs/screenshots/06-images-grid.png` |
| Image viewer | `src/components/media/ImageViewer.js` | Full-screen image viewing | `docs/screenshots/07-image-viewer.png` |
| Videos | `src/screens/media/VideosScreen.js` | Video grid/list | `docs/screenshots/08-videos-grid.png` |
| Video player | `src/components/media/VideoPlayer.js` | Full-screen video playback | `docs/screenshots/09-video-player.png` |
| Files | `src/screens/media/FilesScreen.js` | Uploaded documents/files | `docs/screenshots/10-files.png` |
| Upload | `src/screens/media/UploadScreen.js` | Manual upload flow | `docs/screenshots/11-upload.png` |
| Backup dashboard | `src/screens/backup/BackupDashboardScreen.js` | Backup overview | `docs/screenshots/12-backup-dashboard.png` |
| Backup settings | `src/screens/backup/BackupSettingsScreen.js` | Backup preferences | `docs/screenshots/backup-settings.png` |
| Profile | `src/screens/profile/ProfileScreen.js` | User/profile controls | `docs/screenshots/13-profile.png` |
| Edit profile | `src/screens/profile/EditProfileScreen.js` | Edit user details | `docs/screenshots/edit-profile.png` |
| Appearance | `src/screens/profile/AppearanceScreen.js` | Theme/appearance settings | `docs/screenshots/appearance.png` |
| Recycle bin | `src/screens/media/RecycleBinScreen.js` | Restore deleted media | `docs/screenshots/14-recycle-bin.png` |

## How To Capture Screenshots

### Android Emulator

1. Start backend on the same network/host reachable by emulator.
2. Start the app:

```sh
npm run android
```

3. Navigate to the screen.
4. Use Android Studio emulator screenshot button, or:

```sh
adb exec-out screencap -p > docs/screenshots/05-gallery.png
```

### Expo Dev Client / Physical Android Phone

1. Connect phone and backend machine to the same Wi-Fi.
2. Make sure the backend is running on port `8000`.
3. Open the app.
4. Take normal phone screenshots.
5. Place images in `docs/screenshots/`.

### Web Preview

The project can export web successfully, but mobile UI screenshots are best captured from Android/iOS because the app is designed as a mobile app and uses native network/media modules.

## UI Navigation Summary

```txt
BackendGate
  |
  v
Splash / Welcome / AuthProfile
  |
  v
Gallery
  |
  +-- Images
  +-- Videos
  +-- Files
  +-- Upload
  +-- BackupDashboard
  +-- Profile
  +-- RecycleBin
```

