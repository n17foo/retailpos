# Contributing to RetailPOS

Thank you for your interest in contributing to RetailPOS! We welcome contributions from the community. This document provides guidelines and information about how to contribute to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 20.x or later
- Yarn package manager
- Expo CLI
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/retail-pos.git
   cd retail-pos
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/n17foo/retail-pos.git
   ```

## Development Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   yarn ios    # for iOS simulator
   yarn android # for Android emulator
   yarn web    # for web development
   ```

### Project Structure

```
retail-pos/
├── components/        # Reusable UI components
├── contexts/          # React contexts for state management
├── hooks/            # Custom React hooks
├── repositories/     # Data access layer (SQLite)
├── screens/          # Screen components
├── services/         # Business logic and external APIs
├── utils/            # Utility functions
└── locales/          # Internationalization files
```

## How to Contribute

### Types of Contributions

- **Bug fixes**: Fix existing issues
- **Features**: Add new functionality
- **Documentation**: Improve documentation
- **Tests**: Add or improve test coverage
- **Code refactoring**: Improve code quality and maintainability

### Development Workflow

1. **Choose an issue**: Look for issues labeled `good first issue` or `help wanted`
2. **Create a branch**: Use a descriptive branch name
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```
3. **Make changes**: Implement your changes following our coding standards
4. **Test your changes**: Ensure tests pass and functionality works
5. **Commit your changes**: Use clear, descriptive commit messages
6. **Push to your fork**: Push your branch to your fork
7. **Create a Pull Request**: Open a PR against the main branch

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style (checked by ESLint)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer functional programming patterns where appropriate

### React

- Use functional components with hooks
- Follow React best practices
- Use TypeScript for prop types
- Keep components small and focused
- Use custom hooks for shared logic

### Git Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

Examples:

```
feat(auth): add PIN-based authentication
fix(login): resolve SafeAreaView deprecation warning
docs(api): update platform service documentation
```

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

### Testing Guidelines

- Write tests for new features
- Update tests when fixing bugs
- Aim for good test coverage
- Use descriptive test names
- Test both happy path and error cases

## Submitting Changes

### Pull Request Process

1. **Ensure your PR is ready**:
   - All tests pass
   - Code follows our standards
   - Documentation is updated
   - Commit messages are clear

2. **Create a Pull Request**:
   - Use a descriptive title
   - Fill out the PR template
   - Reference any related issues
   - Add screenshots for UI changes

3. **Code Review**:
   - Address review feedback
   - Make requested changes
   - Keep conversations focused and productive

4. **Merge**:
   - Once approved, your PR will be merged
   - Delete your branch after merging

### PR Template

Please fill out the pull request template with:

- Description of changes
- Type of change (bug fix, feature, etc.)
- Testing instructions
- Screenshots (if applicable)
- Related issues

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Clear title**: Summarize the issue
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, device, app version
- **Screenshots**: If applicable
- **Additional context**: Any other relevant information

### Feature Requests

For feature requests, please include:

- **Clear title**: Describe the feature
- **Problem**: What problem does this solve?
- **Solution**: How should it work?
- **Alternatives**: Other solutions considered
- **Additional context**: Screenshots, mockups, etc.

## Community

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs and request features
- **Pull Requests**: Submit code changes
- **Discord/Slack**: Join our community chat (if available)

## Recognition

Contributors will be recognized in our README and potentially in release notes. Significant contributions may lead to being listed as a maintainer.

Thank you for contributing to RetailPOS! 🚀
