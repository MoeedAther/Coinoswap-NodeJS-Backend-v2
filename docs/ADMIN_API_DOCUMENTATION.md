# Admin API Documentation

## Table of Contents
1. [Authentication APIs](#authentication-apis)
2. [Two-Factor Authentication APIs](#two-factor-authentication-apis)
3. [Password Management APIs](#password-management-apis)
4. [Settings Management APIs](#settings-management-apis)
5. [Partners Management APIs](#partners-management-apis)

---

## Base URL
```
http://localhost:5001/api/admin
```

---

## Authentication APIs

### 1. Register Admin

Create a new admin account.

**Endpoint:** `POST /api/admin/register`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePass123",
  "name": "Admin User"
}
```

**Validation Rules:**
- `email`: Required, valid email format
- `password`: Required, minimum 8 characters
- `name`: Required

**Success Response (201):**
```json
{
  "success": true,
  "message": "Admin registered successfully",
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "twoFactorEnabled": false,
    "createdAt": "2025-01-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "All fields are required: email, password, name"
}
```

**409 - Conflict:**
```json
{
  "success": false,
  "message": "Admin with this email already exists"
}
```

---

### 2. Login

Authenticate and create a session.

**Endpoint:** `POST /api/admin/login`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePass123",
  "twoFactorCode": "123456"
}
```

**Parameters:**
- `email`: Required
- `password`: Required
- `twoFactorCode`: Optional (required if 2FA is enabled)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "twoFactorEnabled": false
  }
}
```

**Error Responses:**

**401 - Invalid Credentials:**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**403 - 2FA Required:**
```json
{
  "success": false,
  "message": "2FA code is required",
  "requires2FA": true
}
```

---

### 3. Logout

Destroy current session and logout.

**Endpoint:** `POST /api/admin/logout`

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 4. Get Session

Get current logged-in admin session data.

**Endpoint:** `GET /api/admin/session`

**Authentication:** Required (Session-based)

**Success Response (200):**
```json
{
  "success": true,
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "twoFactorEnabled": false,
    "createdAt": "2025-01-27T10:00:00.000Z",
    "updatedAt": "2025-01-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

**401 - Not Authenticated:**
```json
{
  "success": false,
  "message": "Not authenticated"
}
```

---

## Two-Factor Authentication APIs

### 1. Enable 2FA

Generate 2FA secret and QR code.

**Endpoint:** `POST /api/admin/2fa/enable`

**Authentication:** Required (Session-based)

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Scan the QR code with your authenticator app and verify with a code",
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Notes:**
- The QR code is a base64-encoded PNG image
- Secret is in base32 format for manual entry
- 2FA is not yet enabled; verification is required

**Error Responses:**

**400 - Already Enabled:**
```json
{
  "success": false,
  "message": "2FA is already enabled"
}
```

**401 - Not Authenticated:**
```json
{
  "success": false,
  "message": "Not authenticated"
}
```

---

### 2. Verify and Activate 2FA

Verify 2FA code and activate 2FA.

**Endpoint:** `POST /api/admin/2fa/verify`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "twoFactorCode": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

**Error Responses:**

**401 - Invalid Code:**
```json
{
  "success": false,
  "message": "Invalid 2FA code"
}
```

**400 - Secret Not Found:**
```json
{
  "success": false,
  "message": "2FA secret not found. Please enable 2FA first"
}
```

---

### 3. Disable 2FA

Disable two-factor authentication.

**Endpoint:** `POST /api/admin/2fa/disable`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "password": "SecurePass123",
  "twoFactorCode": "123456"
}
```

**Parameters:**
- `password`: Required (current password)
- `twoFactorCode`: Required if 2FA is currently enabled

**Success Response (200):**
```json
{
  "success": true,
  "message": "2FA disabled successfully"
}
```

**Error Responses:**

**401 - Invalid Password:**
```json
{
  "success": false,
  "message": "Invalid password"
}
```

**401 - Invalid 2FA Code:**
```json
{
  "success": false,
  "message": "Invalid 2FA code"
}
```

---

## Password Management APIs

### 1. Change Password

Change admin password and automatically logout.

**Endpoint:** `POST /api/admin/change-password`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePass456",
  "twoFactorCode": "123456"
}
```

**Parameters:**
- `currentPassword`: Required
- `newPassword`: Required (min 8 characters)
- `twoFactorCode`: Optional (required if 2FA is enabled)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Important Notes:**
- After successful password change, the session is automatically destroyed
- The session cookie is cleared from the client
- Admin must login again with the new password to continue
- This is a security measure to ensure the new password is valid and to prevent session hijacking

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "New password must be at least 8 characters long"
}
```

**401 - Invalid Current Password:**
```json
{
  "success": false,
  "message": "Invalid current password"
}
```

**403 - 2FA Required:**
```json
{
  "success": false,
  "message": "2FA code is required for password change",
  "requires2FA": true
}
```

**500 - Session Destruction Failed:**
```json
{
  "success": false,
  "message": "Password changed but failed to logout. Please logout manually."
}
```

**Notes:**
- If this error occurs, the password was successfully changed but automatic logout failed
- Admin should manually logout and login with the new password
- This is a rare edge case related to session store issues

---

## Settings Management APIs

### 1. Get All Settings

Retrieve all application settings.

**Endpoint:** `GET /api/admin/settings`

**Success Response (200):**
```json
{
  "success": true,
  "settings": [
    {
      "id": 1,
      "key": "app_name",
      "value": "Coinoswap",
      "type": "string",
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    },
    {
      "id": 2,
      "key": "partners",
      "value": [
        {
          "name": "changelly",
          "isEnabled": true,
          "hasGiveAway": false
        }
      ],
      "type": "object",
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

### 2. Get Setting by Key

Retrieve a specific setting by key.

**Endpoint:** `GET /api/admin/settings/:key`

**URL Parameters:**
- `key`: Setting key (e.g., "app_name", "partners")

**Example:** `GET /api/admin/settings/app_name`

**Success Response (200):**
```json
{
  "success": true,
  "setting": {
    "id": 1,
    "key": "app_name",
    "value": "Coinoswap",
    "type": "string",
    "created_at": "2025-01-27T10:00:00.000Z",
    "updated_at": "2025-01-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Setting with key 'app_name' not found"
}
```

---

### 3. Create or Update Setting (Upsert)

Create a new setting or update an existing one.

**Endpoint:** `POST /api/admin/settings`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "key": "maintenance_mode",
  "value": "false",
  "type": "boolean"
}
```

**Parameters:**
- `key`: Required (unique identifier)
- `value`: Required (setting value)
- `type`: Optional (default: "string")
  - Valid types: `"string"`, `"number"`, `"boolean"`, `"object"`

**Example with Object Type:**
```json
{
  "key": "email_config",
  "value": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false
  },
  "type": "object"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Setting 'maintenance_mode' saved successfully",
  "setting": {
    "id": 3,
    "key": "maintenance_mode",
    "value": "false",
    "type": "boolean",
    "created_at": "2025-01-27T10:00:00.000Z",
    "updated_at": "2025-01-27T10:00:00.000Z"
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "key and value are required"
}
```

**400 - Invalid Type:**
```json
{
  "success": false,
  "message": "Invalid type. Must be one of: string, number, boolean, object"
}
```

---

### 4. Delete Setting

Delete a setting by key.

**Endpoint:** `DELETE /api/admin/settings/:key`

**Authentication:** Required (Session-based)

**URL Parameters:**
- `key`: Setting key to delete

**Example:** `DELETE /api/admin/settings/maintenance_mode`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Setting 'maintenance_mode' deleted successfully"
}
```

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Setting with key 'maintenance_mode' not found"
}
```

---

## Partners Management APIs

### 1. Get Partners

Get all exchange partners and their status.

**Endpoint:** `GET /api/admin/settings/partners`

**Success Response (200):**
```json
{
  "success": true,
  "partners": [
    {
      "name": "changelly",
      "isEnabled": true,
      "hasGiveAway": false
    },
    {
      "name": "changenow",
      "isEnabled": true,
      "hasGiveAway": true
    },
    {
      "name": "stealthex",
      "isEnabled": false,
      "hasGiveAway": false
    }
  ],
  "totalExchanges": 9,
  "enabledExchanges": 7,
  "disabledExchanges": 2,
  "activeGiveAways": 3
}
```

**Valid Exchange Names:**
- `changelly`
- `changenow`
- `changehero`
- `simpleswap`
- `godex`
- `stealthex`
- `letsexchange`
- `exolix`
- `easybit`

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Partners settings not found"
}
```

---

### 2. Update Partners

Update all partners configuration.

**Endpoint:** `PUT /api/admin/settings/partners`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "partners": [
    {
      "name": "changelly",
      "isEnabled": true,
      "hasGiveAway": false
    },
    {
      "name": "changenow",
      "isEnabled": true,
      "hasGiveAway": true
    },
    {
      "name": "changehero",
      "isEnabled": false,
      "hasGiveAway": false
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Partners settings updated successfully",
  "partners": [...],
  "totalExchanges": 9,
  "enabledExchanges": 7,
  "disabledExchanges": 2,
  "activeGiveAways": 3
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Partners array is required"
}
```

**400 - Invalid Exchange:**
```json
{
  "success": false,
  "message": "Invalid exchange name: unknown_exchange",
  "validExchanges": ["changelly", "changenow", ...]
}
```

---

### 3. Toggle Partner

Enable/disable a single partner or update giveaway status.

**Endpoint:** `POST /api/admin/settings/partners/toggle`

**Authentication:** Required (Session-based)

**Request Body:**
```json
{
  "partnerName": "changelly",
  "isEnabled": true,
  "hasGiveAway": false
}
```

**Parameters:**
- `partnerName`: Required
- `isEnabled`: Optional (boolean)
- `hasGiveAway`: Optional (boolean)

**Notes:**
- You can update `isEnabled`, `hasGiveAway`, or both
- Only provided fields will be updated

**Success Response (200):**
```json
{
  "success": true,
  "message": "changelly has been updated successfully",
  "partners": [...],
  "totalExchanges": 9,
  "enabledExchanges": 8,
  "disabledExchanges": 1,
  "activeGiveAways": 3
}
```

**Error Responses:**

**400 - Invalid Partner:**
```json
{
  "success": false,
  "message": "Invalid partner name: unknown_partner",
  "validExchanges": ["changelly", "changenow", ...]
}
```

**404 - Partner Not Found:**
```json
{
  "success": false,
  "message": "Partner changelly not found"
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Detailed error message",
  "message": "User-friendly error message"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (authentication failed) |
| 403 | Forbidden (2FA required, insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal Server Error |

---

## Authentication & Sessions

### Session-Based Authentication

Most endpoints require authentication. After successful login, a session is created:

- Session cookie name: `sessionCoinoSwap`
- Session duration: 24 hours
- Session is stored in MySQL database

### How to Authenticate

1. **Login:** Call `POST /api/admin/login` with credentials
2. **Session Cookie:** The server sets a session cookie
3. **Subsequent Requests:** Include the session cookie in all requests
4. **Check Session:** Call `GET /api/admin/session` to verify authentication
5. **Logout:** Call `POST /api/admin/logout` to destroy session

### Example with cURL

```bash
# Login and save cookies
curl -X POST http://localhost:5001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' \
  -c cookies.txt

# Use session cookie for authenticated request
curl -X GET http://localhost:5001/api/admin/session \
  -b cookies.txt
```

---

## Best Practices

### Security
1. Always use HTTPS in production
2. Enable 2FA for all admin accounts
3. Use strong passwords (min 8 chars, mixed case, numbers)
4. Regularly rotate passwords
5. Never commit API keys or secrets to version control

### Error Handling
1. Always check the `success` field in responses
2. Handle 401/403 errors by redirecting to login
3. Display user-friendly error messages from `message` field
4. Log detailed errors from `error` field for debugging

### Session Management
1. Check session validity before sensitive operations
2. Implement session timeout on frontend
3. Clear session data on logout
4. Handle session expiry gracefully

---

## Testing

### Using the Built-in API Tester

Navigate to: `http://localhost:5001/api-tester`

The API tester provides:
- Interactive UI for testing all endpoints
- Pre-filled example values
- Real-time response display
- Session management

### Testing Workflow

1. **Register:** Create admin account
2. **Login:** Authenticate and create session
3. **Test Endpoints:** Use session cookie automatically
4. **Enable 2FA:** Test two-factor authentication flow
5. **Settings:** Test CRUD operations on settings
6. **Logout:** Destroy session

---

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Authentication with session management
- Two-factor authentication (TOTP)
- Password management
- Settings CRUD operations
- Partners management

---

## Support

For issues, questions, or contributions:
- GitHub: [Link to repository]
- Email: support@coinoswap.com

---

**Last Updated:** January 27, 2025
