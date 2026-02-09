# Implementation Plan: Auth Module with JWT

We will implement a secure authentication system using Passport, JWT, and bcrypt.

## User Story

As a user, I want to register and log in to the system so that I can securely access protected resources.

## Proposed Changes

### 1. Configure Environment Variables
- Ensure `JWT_SECRET` and `JWT_EXPIRATION` are in `.env`.

### 2. Create Auth Module (`src/auth`)
- **Files**: `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- **Dependencies**: `PassportModule`, `JwtModule`, `UserModule` (needs to export `TypeOrmModule` feature or `UserService`).

### 3. Implement DTOs
- `RegisterDto`: email, password.
- `LoginDto`: email, password.
- **Validation**: Use `class-validator` for email format and password strength.

### 4. Implement AuthService (`src/auth/auth.service.ts`)
- `register(registerDto)`: Hash password, create user, return JWT.
- `login(loginDto)`: Validate password, return JWT.
- Helper: `validateUser(email, password)`, `signToken(userId, email)`.

### 5. Implement AuthController (`src/auth/auth.controller.ts`)
- `POST /auth/register`: Calls `service.register`.
- `POST /auth/login`: Calls `service.login`.
- **Response Format**: `{ errorCode: string, message: string }` on error.

### 6. proper Error Handling
- Use `AppException` or standard `HttpException` with custom structure.

### 7. JWT Strategy (`src/auth/jwt.strategy.ts`)
- Extract JWT from header (Bearer).
- Validate payload.

### 8. Custom Decorators & Guards
- `@CurrentUser()`: Extract user from request object.
- `JwtAuthGuard`: Extend `AuthGuard('jwt')`.

## Verification Plan

### Automated Tests
- Unit tests for `AuthService`.
- E2E tests for `/auth/register` and `/auth/login`.

### Manual Verification
- Use Postman/Curl to:
    1.  Register a new user.
    2.  Login with correct credentials -> receive JWT.
    3.  Login with incorrect credentials -> receive 401.
    4.  Access protected route without JWT -> receive 401.
