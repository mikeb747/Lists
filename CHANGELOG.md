# Changelog

## 2026-10-20
- Keep task drags active when the pointer moves horizontally away from the drag handle by tracking captured pointer events at the window level.
- Prevent vertical touch movement on category tabs from scrolling the page, retain horizontal tab-strip swipes, and keep tab drag gestures captured.
- Arm tab reordering after the configured activation delay; begin dragging on movement so a stationary long press still opens tab options.

## 2026-10-19
- Merged case-insensitive duplicate tabs during cloud sync, keeping the cloud colour and appending local tasks to the cloud tab.
- Blocked duplicate task names regardless of case, including bulk paste and subtask conversion.
- Added task and tab reordering with edge auto-scroll, and kept Add Task actions accessible while scrolling.
- Changed manual JSON export filenames to `lists-bak-YYYYMMDDHHMM.json`.
- Updated the README to describe Firebase sync and manual JSON backup instead of Google Drive backup.
