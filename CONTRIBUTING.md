# Contributing to Frontierra

Thank you for your interest in contributing to Frontierra!

## Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```sh
   git clone https://github.com/your-username/frontierra.git
   cd frontierra
   ```

3. **Install dependencies**
   ```sh
   npm install
   ```

4. **Create a feature branch**
   ```sh
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes**

6. **Run the linter**
   ```sh
   npm run lint
   ```

7. **Test locally**
   ```sh
   npm run dev
   ```

8. **Build to verify**
   ```sh
   npm run build
   ```

9. **Commit your changes**
   ```sh
   git commit -m "feat: add your feature description"
   ```

10. **Push to your fork**
    ```sh
    git push origin feature/your-feature-name
    ```

11. **Open a Pull Request** on GitHub

## Code Guidelines

- **TypeScript**: All new code should be written in TypeScript
- **Determinism**: World generation must remain deterministic (no `Math.random()` or `Date.now()` in world gen code)
- **Components**: Keep components focused and small
- **Styling**: Use Tailwind CSS classes; avoid inline styles

## Commit Messages

We follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Questions?

Open an issue for any questions or discussions.
