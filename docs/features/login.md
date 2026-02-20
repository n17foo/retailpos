# Login & Authentication

## User Story

**As a** retail store employee  
**I want to** securely authenticate using my preferred method  
**So that** I can access the POS system quickly at the start of my shift

## Rules

- 6 authentication methods: PIN, Biometric, Password, MagStripe, RFID/NFC, Platform Login
- PIN cannot be disabled — always available as offline fallback
- Platform Login cannot be disabled — required for online mode
- Available methods filtered by platform mode (online vs offline)
- Hardware-dependent methods (MagStripe, RFID/NFC) only appear when hardware is detected
- Invalid credentials trigger shake animation and error message
- Audit log records every login attempt (success and failure)

---

## Flow 1: PIN Login (Default)

1. **Login screen loads** → AuthService checks platform mode and available providers
2. **PIN pad displayed** → 6-digit numeric input shown as default method
3. **Employee enters PIN** → digits masked as they are typed
4. **Submit** → AuthService delegates to PinAuthProvider
5. **PinAuthProvider** → hashes input, compares against SQLite user record
6. **Success** → onLogin(credential, user) called → navigates to Order screen
7. **Failure** → shake animation, error message, PIN cleared for retry

## Flow 2: Biometric Login

1. **Employee selects Biometric** from method switcher → UI clears previous input
2. **Tap "Authenticate" button** → system prompts device biometric (fingerprint/face)
3. **BiometricAuthProvider** → calls device biometric API (dynamic require)
4. **Success** → onLogin("biometric", user) → navigates to Order screen
5. **Failure / Cancel** → error shown, can switch to PIN fallback

## Flow 3: Password Login

1. **Employee selects Password** from method switcher
2. **Text input displayed** → employee types password and presses Enter
3. **PasswordAuthProvider** → hashes input, validates against SQLite
4. **Success** → onLogin(password, user) → navigates to Order screen
5. **Failure** → error message, input cleared

## Flow 4: MagStripe Card Login

1. **Employee selects MagStripe** → only visible if card reader hardware detected
2. **UI shows "Waiting for card swipe..."** → hidden input captures card data
3. **Card swiped** → MagstripeAuthProvider validates card data against SQLite
4. **Success** → onLogin(cardData, user) → navigates to Order screen
5. **Failure** → error shown, prompt to swipe again

## Flow 5: RFID/NFC Badge Login

1. **Employee selects RFID/NFC** → only visible if NFC reader hardware detected
2. **UI shows "Waiting for badge tap..."** → hidden input captures badge data
3. **Badge tapped** → RfidNfcAuthProvider validates against SQLite
4. **Success** → onLogin(badgeData, user) → navigates to Order screen
5. **Failure** → error shown, prompt to tap again

## Flow 6: Platform Login (Online Mode Only)

1. **Employee selects Platform Login** → only available in online mode
2. **Tap "Log In via Platform"** → PlatformAuthProvider checks existing token
3. **TokenService validates** → verifies platform API token is still valid
4. **Valid token** → onLogin("platform_auth", user) → navigates to Order screen
5. **Expired token** → attempts refresh via registered token provider
6. **Refresh fails** → error shown, prompt to re-authenticate with platform

## Flow 7: Method Switching & Fallback

1. **Login screen shows method switcher** → lists all available methods for current mode
2. **Employee taps different method** → UI transitions to selected method interface
3. **Previous input cleared** → error state reset
4. **If primary method fails** → authenticateWithPrimary() falls back to PIN
5. **PIN always works** → ensures employee can always log in

## Flow 8: Provider Setup (Admin)

1. **Admin opens Settings → Authentication tab** → reads authConfig.authMode
2. **Available methods filtered by mode** → online shows platform + offline methods, offline shows offline only
3. **Admin enables/disables methods** → PIN and platform_auth toggles locked
4. **Hardware methods** → admin calls setHardwareAvailable() when readers connected
5. **Save** → persists to AuthConfigService → affects login screen on next load

## Questions

- What happens when biometric authentication fails multiple times in a row?
- How does the system handle network timeouts during platform token validation?
- How are authentication failures logged and surfaced to administrators?
- What is the lockout policy after repeated failed attempts?
- How are stored credential hashes rotated or migrated?
