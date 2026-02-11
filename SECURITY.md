# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in RetailPOS, please help us by reporting it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing [INSERT SECURITY EMAIL] with the following information:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any suggested fixes or mitigations
- Your contact information for follow-up

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Investigation**: We will investigate the issue and may ask for additional information
3. **Updates**: We will keep you informed about our progress
4. **Resolution**: We will work to resolve the issue and release a fix
5. **Disclosure**: We will coordinate disclosure with you

We follow responsible disclosure practices and will give credit to security researchers who help improve our security.

## Security Best Practices for Contributors

When contributing to RetailPOS, please follow these security best practices:

### Code Security

- Never commit sensitive information (API keys, passwords, etc.)
- Use environment variables for configuration
- Validate and sanitize all user inputs
- Use prepared statements for database queries
- Implement proper authentication and authorization
- Handle errors securely (don't leak sensitive information)

### Dependencies

- Keep dependencies up to date
- Review dependency changes in pull requests
- Use tools like `yarn audit` to check for vulnerabilities
- Pin dependency versions appropriately

### API Security

- Use HTTPS for all API communications
- Implement rate limiting where appropriate
- Validate API keys and tokens
- Use secure token storage (Keychain on mobile)

### Data Protection

- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement proper session management
- Follow data minimization principles

## Security Updates

Security updates will be released as patch versions. Critical security fixes may result in immediate releases outside of regular release cycles.

## Contact

For security-related questions or concerns, contact [INSERT CONTACT EMAIL].

Thank you for helping keep RetailPOS secure! 🛡️
