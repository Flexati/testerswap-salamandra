# Manus Builder Pipeline Fix - Dead Code Removal

## Problem

The Manus builder pipeline ships dead code in every Capacitor app built:

- `assets/public/__manus__/debug-collector.js`
- `assets/native-bridge.js`
- `assets/public/cordova.js`

These files are **never referenced** in `index.html` or the main JS bundle. They increase APK size unnecessarily and indicate a template-level issue in the Manus builder.

## Evidence

Found in both SnapChef and TesterSwap Salamandra builds:

```bash
# In APK
unzip -l app-release.apk | grep manus
# → assets/public/__manus__/debug-collector.js present

# In bundle
grep "__manus__\|debug-collector" assets/index.html assets/public/index.html
# → 0 occurrences
```

## Root Cause

The Manus builder template (likely `vite-plugin-manus-runtime` or base template) includes these files unconditionally in the Capacitor web assets output, but they are not imported/used by the application code.

## Fix Required (Template Level)

In the Manus builder template / `vite-plugin-manus-runtime`:

1. **Make debug-collector conditional** - Only include in development builds (`NODE_ENV !== 'production'`)
2. **Remove cordova.js** - Not needed for pure Capacitor apps (only for Cordova compatibility)
3. **Make native-bridge conditional** - Only include if Capacitor plugins actually require it

### Example Fix for vite-plugin-manus-runtime

```typescript
// In the plugin's asset generation logic
const isDev = process.env.NODE_ENV !== 'production';

const manusAssets = [
  // Only in dev
  ...(isDev ? ['__manus__/debug-collector.js'] : []),
  // Never include cordova.js for Capacitor-only apps
  // 'cordova.js',
  // Only if needed
  ...(needsNativeBridge ? ['native-bridge.js'] : []),
];
```

## Impact

- **APK size reduction**: ~50-100KB per app
- **Security**: Removes unused debug code from production
- **Consistency**: Fixes pattern across all Build Factory apps

## Affected Apps

- SnapChef (confirmed)
- TesterSwap Salamandra (confirmed)
- Likely all Manus-built Capacitor apps

## Priority

**MEDIUM** - Template fix benefits all future apps; existing apps need rebuild after fix.

## Owner

@code-quality-architect (template/pipeline level fix)