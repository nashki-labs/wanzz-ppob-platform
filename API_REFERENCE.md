# WANZZ PPOB API Reference v2.1
### *Official Technical Specification*

This document provides definitive documentation for all API endpoints in the Wanzz PPOB Platform.

- **Base URL**: `http://localhost:3000/api` (or your production URL)
- **Content-Type**: `application/json`
- **Authentication**: Bearer Token in `Authorization` header (`Authorization: Bearer <token>`)

### Authentication Levels
- **Public**: No token required.
- **User**: Valid JWT required.
- **Admin**: Valid JWT + `role: admin` required.

---

## 🔐 Auth Module (`/auth`)
Manages user lifecycle and profile security.

### POST `/auth/register` (Public)
Register a new user account.
- **Body**:
  ```json
  {
    "name": "Ikhsan",            // string, required
    "email": "user@example.com", // string, valid email, unique
    "password": "secretpassword", // string, min 6 chars
    "phone": "08123456789"       // string, optional
  }
  ```
- **Success (200)**: returns JWT `token` and `user` object.
- **Errors**: `400` (Validation), `409` (Email exists).

### POST `/auth/login` (Public)
Login to get a JWT token.
- **Body**: `{ "email": "user@example.com", "password": "secretpassword" }`
- **Success (200)**: returns JWT `token` and `user` object.
- **Errors**: `401` (Invalid credentials).

### GET `/auth/me` (User)
Get the currently authenticated user's profile.
- **Success (200)**: returns sanitized `user` object.

### GET `/auth/history` (User)
Get the transaction and deposit history for the current user.
- **Success (200)**: returns `transactions` array and `deposits` array.

### POST `/auth/update` (User)
Update the current user's profile.
- **Body**:
  ```json
  {
    "name": "New Name",      // string, optional
    "email": "new@mail.com", // string, optional, unique
    "phone": "08123",        // string, optional
    "password": "newpass"    // string, optional, min 6 chars
  }
  ```
- **Success (200)**: returns updated `user` object.

---

## 💸 Transaction Module (`/`)
Handles PPOB orders, deposits, and status synchronizations.

### GET `/products` (Public)
Fetch live PPOB products (with active profit margin applied).
- **Success (200)**: returns `data` array of product objects.

### GET `/deposit-methods` (Public)
Fetch all active deposit methods from the current active gateway (CiaaTopUp or Pakasir).
- **Success (200)**: returns `data` array of method objects.

### POST `/transaction/create` (User)
Initiate a PPOB product purchase.
- **Body**:
  ```json
  {
    "product_code": "TELKOMSEL10",
    "product_name": "Pulsa 10k",
    "target": "08123456789"
  }
  ```
- **Success (200)**: returns `reff_id`, `new_balance`, and gateway `data`.
- **Errors**: `400` (Insufficient Balance or Gateway Rejection).

### POST `/deposit/create` (User)
Create a balance deposit invoice.
- **Body**:
  ```json
  {
    "nominal": 50000,           // number, min 10000
    "method": "qris",           // string (from /deposit-methods)
    "existing_deposit_id": ""   // string, optional
  }
  ```
- **Success (200)**: returns `data` object with `qr_image_url`, `payment_number`, etc.

### POST `/deposit/cancel` (User)
Cancel an active, pending deposit invoice.
- **Body**: `{ "deposit_id": "dep-123..." }`
- **Success (200)**: returns success message.

### GET `/transaction/:id/sync` (User/Admin)
Manually sync a transaction's status from the vendor. Users can only sync their own.
- **Success (200)**: returns updated gateway `data`.

### GET `/deposit/:id/sync` (User/Admin)
Manually sync a deposit's status from the gateway. Users can only sync their own.
- **Success (200)**: returns `current_status`.

---

## 🎮 Pterodactyl Module (`/pterodactyl`)
Game panel provisioning.

### GET `/pterodactyl/packages` (Public)
List available server packages and pricing.
- **Success (200)**: returns `configured` boolean and `data` array of packages.

### GET `/pterodactyl/eggs` (Public)
List available nests and eggs (e.g., NodeJS).
- **Success (200)**: returns `data` array of nested eggs.

### POST `/pterodactyl/purchase` (User)
Purchase and provision a new game server.
- **Body**: `{ "package_id": "1gb", "egg_id": 15 }` (`egg_id` is optional, defaults to NodeJS).
- **Success (200)**: returns panel credentials (`panel_username`, `panel_password`, etc.).
- **Errors**: `400` (Insufficient Balance), `503` (Pterodactyl Not Configured).

### GET `/pterodactyl/my-panels` (User)
List all servers owned by the user.
- **Success (200)**: returns `data` array of panels.

### GET `/pterodactyl/panel/:id` (User)
Get detailed info for a specific panel owned by the user.
- **Success (200)**: returns `data` object.

---

## 🛡️ Admin Module (`/admin`)
System management. Requires Admin token.

### GET `/admin/users` (Admin)
List all registered users.
### GET `/admin/transactions` (Admin)
List all transactions sequentially.
### GET `/admin/deposits` (Admin)
List all deposits sequentially.
### GET `/admin/settings` (Admin)
Get global settings (`maintenance`, `activeDepositMethod`, `profitPercent`).

### POST `/admin/maintenance` (Admin)
Toggle global maintenance mode.
- **Body**: `{ "enabled": true }`

### POST `/admin/settings/deposit-method` (Admin)
Change active deposit provider.
- **Body**: `{ "method": "ciaatopup" }` (or `"pakasir"`)

### POST `/admin/settings/profit-margin` (Admin)
Update global PPOB profit markup.
- **Body**: `{ "percent": 5 }` (integer 0-100)

### GET `/admin/ptero-settings` (Admin)
Get Pterodactyl configuration (domain, api key, raw packages JSON).

### POST `/admin/ptero-settings` (Admin)
Update Pterodactyl configuration.
- **Body**:
  ```json
  {
    "packages": { "1gb": { "memo": 1024, "cpu": 30, ... } }, // optional
    "domain": "https://new-panel.com",                       // optional
    "apiKey": "ptla_new_key"                                 // optional
  }
  ```

### GET `/admin/messages/:userId` (Admin)
Get chat history for a specific user ID.

---

## 💬 Chat Module (`/chat`)

### GET `/chat/` (User)
Get user's support chat messages.
- **Success (200)**: returns `data` array.

### POST `/chat/` (User)
Send a message to support (notifies Admin via Telegram).
- **Body**: `{ "text": "Hello support!" }`
- **Success (200)**: returns generated message object.

### POST `/chat/support` (Public/Legacy)
Legacy endpoint for direct support messages via HTTP form.

---

## 🔗 Callbacks Module (`/callback`)

### POST `/callback/pakasir` (Public)
Webhook endpoint for Pakasir payment notifications.
- **Body**: Handled internally by Pakasir signature validation.
- **Success (200)**: Always returns `OK`.

---

## 📦 Standard Response Patterns

**Success (Status 200)**
```json
{
  "status": "success",
  "data": { ... } // Or other specific keys depending on endpoint
}
```

**Error (Status 4xx/5xx)**
```json
{
  "status": "error",
  "message": "Human readable error explanation."
}
```
