# Security Specification & Test Payloads

## 1. Data Invariants
1. **User Scoping**: All user data (tasks, categories, settings) must be strictly partitioned under `/users/{userId}/...` where `{userId} == request.auth.uid`. No cross-user reads or writes are permitted.
2. **Identity Integrity**: Unauthenticated requests must be denied for any read or write operation.
3. **Task Validation**: Task items must have a non-empty `id` and `name` with bounded string sizes (`id <= 128`, `name <= 500`).
4. **Category Validation**: Category items must have bounded string sizes (`id <= 128`, `name <= 100`).
5. **Path Hardening**: Path variables (`userId`, `taskId`, `categoryId`, `settingId`) must be valid IDs within length constraints.
6. **Default-Deny Catch-All**: All unmapped collections or paths must be completely blocked (`allow read, write: if false;`).

## 2. Dirty Dozen Test Payloads (Designed to Break Invariants)
1. **Unauthenticated Read**: Attempting to read `/users/user123/tasks` without credentials -> PERMISSION_DENIED.
2. **Cross-User Read**: User `A` attempting to read `/users/B/tasks` -> PERMISSION_DENIED.
3. **Cross-User Write**: User `A` attempting to create `/users/B/tasks/t1` -> PERMISSION_DENIED.
4. **Oversized Task Title Injection**: Task title with 50,000 characters -> PERMISSION_DENIED.
5. **Junk Path ID Injection**: Document ID with 2,000 characters or illegal symbols -> PERMISSION_DENIED.
6. **Shadow Field Injection**: Task with unauthorized administrative bypass flags (`isAdmin: true`) -> PERMISSION_DENIED.
7. **Cross-User Category Deletion**: User `A` deleting User `B`'s category -> PERMISSION_DENIED.
8. **Root Collection Poisoning**: Attempting to write directly to `/users` root collection -> PERMISSION_DENIED.
9. **Arbitrary Collection Write**: Attempting to write to `/system_config` or `/admin` -> PERMISSION_DENIED.
10. **Type Mismatch Injection**: Setting task `importance` to a string `"high"` instead of a number -> PERMISSION_DENIED.
11. **Settings Tampering by Third-Party**: User `A` modifying User `B`'s `/users/B/settings/prefs` -> PERMISSION_DENIED.
12. **Unauthenticated Batch Write**: Attempting a multi-doc write batch without auth -> PERMISSION_DENIED.
