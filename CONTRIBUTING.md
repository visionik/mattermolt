# Contributing to MatterMolt

Thank you for your interest in contributing to MatterMolt! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git
- A MatterMost server instance (for testing)

### Getting Started

1. **Fork and clone the repository:**

```bash
git clone https://github.com/yourusername/mattermolt.git
cd mattermolt
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up your test environment:**

Create a test MatterMost server using Docker:

```bash
docker run --name mattermost-dev -d -p 8065:8065 mattermost/mattermost-preview
```

4. **Configure test credentials:**

Create a test bot in your MatterMost server and configure `~/.clawdbot/moltbot.json` with test credentials.

## Development Workflow

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

**Code style rules:**
- Use TypeScript strict mode
- Follow PEP 8 style conventions (adapted for TypeScript)
- Use 2 spaces for indentation
- Maximum line length: 100 characters
- Use single quotes for strings
- Always use semicolons
- Use async/await over callbacks
- Prefer const over let, never use var

### TypeScript Guidelines

- Enable strict mode in all files
- Avoid `any` type - use proper types or `unknown`
- Use interfaces for object shapes
- Use type guards for runtime type checking
- Document complex types with JSDoc comments

### Testing

We aim for ≥75% test coverage:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Testing guidelines:**
- Write tests before implementation (TDD)
- Unit tests for individual functions/classes
- Integration tests for component interactions
- Mock external dependencies (MatterMost API, Gateway)
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

### Building

```bash
# Build the project
npm run build

# Watch for changes and rebuild
npm run watch

# Type check without building
npm run typecheck
```

### Git Workflow

We use [Conventional Commits](https://www.conventionalcommits.org/):

**Commit format:**
```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert a previous commit

**Examples:**
```bash
git commit -m "feat(websocket): add reconnection with exponential backoff"
git commit -m "fix(messages): handle null message text gracefully"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(config): add validation tests for MattermostConfig"
```

### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Releases: `release/version`

### Pull Request Process

1. **Create a feature branch:**

```bash
git checkout -b feature/my-feature
```

2. **Make your changes:**
   - Write tests first (TDD)
   - Implement the feature
   - Ensure all tests pass
   - Ensure linting passes
   - Update documentation

3. **Commit your changes:**

```bash
git add .
git commit -m "feat(scope): description"
```

4. **Push to your fork:**

```bash
git push origin feature/my-feature
```

5. **Create a pull request:**
   - Use a descriptive title
   - Explain what changes you made and why
   - Reference any related issues
   - Ensure CI checks pass

6. **Address review feedback:**
   - Make requested changes
   - Push updates to the same branch
   - Respond to comments

### Code Review Guidelines

**For authors:**
- Keep PRs focused and reasonably sized (<500 lines)
- Write clear commit messages
- Update tests and documentation
- Respond promptly to feedback

**For reviewers:**
- Be constructive and respectful
- Focus on code quality and maintainability
- Check for test coverage
- Verify documentation is updated
- Test the changes locally if needed

## Project Structure

```
mattermolt/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── mattermost-channel.ts    # Channel adapter
│   ├── connection-manager.ts    # WebSocket connection
│   ├── message-handler.ts       # Message transformation
│   ├── file-handler.ts          # File operations
│   ├── session-mapper.ts        # Session mapping
│   ├── access-controller.ts     # Access control
│   ├── config.ts                # Configuration schema
│   └── logger.ts                # Logging utility
├── test/
│   ├── __tests__/               # Test files
│   └── fixtures/                # Test fixtures
├── dist/                        # Build output (generated)
├── coverage/                    # Coverage reports (generated)
└── docs/                        # Documentation
```

## Architecture Overview

MatterMolt follows the MoltBot channel adapter pattern:

1. **MattermostChannel** - Main adapter that extends Channel base class
2. **ConnectionManager** - Manages WebSocket connection lifecycle
3. **MessageHandler** - Transforms messages between formats
4. **FileHandler** - Handles file upload/download
5. **SessionMapper** - Maps conversations to session IDs
6. **AccessController** - Enforces access policies

## Debugging

### Enable Debug Logging

Set the log level to debug in your configuration:

```json
{
  "logging": {
    "level": "debug"
  }
}
```

### Common Issues

**Connection fails:**
- Verify MatterMost URL is correct
- Check bot token is valid
- Ensure bot has proper permissions
- Check network connectivity

**Messages not received:**
- Verify WebSocket connection is active
- Check event subscriptions
- Review access control settings
- Check bot is member of channel/team

**Tests fail:**
- Run `npm install` to ensure dependencies are current
- Clear `node_modules` and reinstall
- Check Node.js version compatibility
- Review test logs for specific errors

## Release Process

Releases are managed by maintainers:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release commit: `chore(release): v1.0.0`
4. Tag the release: `git tag v1.0.0`
5. Push to GitHub: `git push origin main --tags`
6. GitHub Actions will publish to npm automatically

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Contact maintainers for security issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
