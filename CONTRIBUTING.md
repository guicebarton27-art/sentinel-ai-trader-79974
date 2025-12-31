# Contributing to Sentinel AI Trader

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Git
- GitHub account
- Basic knowledge of React, TypeScript, and trading concepts

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/sentinel-ai-trader-79974.git
cd sentinel-ai-trader-79974
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/guicebarton27-art/sentinel-ai-trader-79974.git
```

4. Install dependencies:
```bash
npm install
```

5. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

## 🌿 Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

### Creating a Branch

```bash
# For features
git checkout -b feature/add-binance-integration

# For bug fixes
git checkout -b fix/chart-rendering-issue

# For documentation
git checkout -b docs/update-api-guide
```

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(trading): add support for Binance exchange

Implement Binance API integration for order execution
and market data streaming.

Closes #123
```

```bash
fix(risk): correct VaR calculation for multi-asset portfolios

The previous implementation didn't account for correlation
between assets, leading to underestimated risk.

Fixes #456
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm run test:coverage
```

### Manual Testing Checklist
- [ ] Authentication flow works
- [ ] Bot controls function correctly
- [ ] Charts render without errors
- [ ] Risk calculations are accurate
- [ ] No console errors or warnings
- [ ] Mobile responsive
- [ ] Accessible (keyboard navigation, screen readers)

## 📋 Pull Request Process

### Before Submitting

1. **Update from upstream**:
```bash
git fetch upstream
git rebase upstream/main
```

2. **Run linter**:
```bash
npm run lint
```

3. **Build successfully**:
```bash
npm run build
```

4. **Test thoroughly**:
```bash
npm test
```

### Submitting PR

1. Push your branch:
```bash
git push origin feature/your-feature
```

2. Go to GitHub and create a Pull Request

3. Fill out the PR template:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)

4. Request review from maintainers

### PR Title Format

```
[TYPE] Brief description (#issue-number)
```

Examples:
- `[FEAT] Add Binance integration (#123)`
- `[FIX] Correct VaR calculation (#456)`
- `[DOCS] Update deployment guide (#789)`

## 🎨 Code Style

### TypeScript
- Use TypeScript strict mode
- Define explicit types (avoid `any`)
- Use interfaces for object shapes
- Prefer functional components with hooks

### React
- Use functional components
- Extract custom hooks for reusable logic
- Keep components small and focused
- Use proper prop typing

### Example Component

```typescript
import { FC } from 'react';

interface TradingCardProps {
  title: string;
  value: number;
  onChange?: (value: number) => void;
}

export const TradingCard: FC<TradingCardProps> = ({ 
  title, 
  value, 
  onChange 
}) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
};
```

### Naming Conventions
- **Components**: PascalCase (`TradingDashboard`)
- **Files**: PascalCase for components (`TradingDashboard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useTradingBot`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_POSITION_SIZE`)
- **Variables**: camelCase (`portfolioValue`)

## 📁 Project Structure

```
src/
├── components/
│   ├── trading/          # Trading-specific components
│   ├── auth/             # Authentication components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── integrations/         # External service integrations
├── lib/                  # Utility functions
├── pages/                # Route pages
└── types/                # TypeScript type definitions
```

### Where to Add New Features

- **New strategy**: `src/components/trading/`
- **New hook**: `src/hooks/`
- **New utility**: `src/lib/`
- **New page**: `src/pages/`
- **New API integration**: `src/integrations/`

## 🐛 Bug Reports

### Good Bug Report Includes:
1. **Clear title**: "Chart fails to render on mobile Safari"
2. **Steps to reproduce**:
   - Go to dashboard
   - Scroll to chart section
   - Observe blank area
3. **Expected behavior**: Chart should render
4. **Actual behavior**: Blank white box
5. **Environment**: 
   - Browser: Safari 16.3 on iOS 16.2
   - Device: iPhone 13 Pro
6. **Screenshots**: (attach if applicable)
7. **Console errors**: (paste any error messages)

### Bug Report Template

```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: 
- Browser:
- Version:

## Additional Context
Any other relevant information
```

## 💡 Feature Requests

### Good Feature Request Includes:
1. **Clear title**: "Add support for trailing stop orders"
2. **Problem statement**: "Currently only market and limit orders are supported"
3. **Proposed solution**: "Implement trailing stop logic in ExecutionRouter"
4. **Alternatives considered**: "Could use exchange's native trailing stops"
5. **Use case**: "Protect profits during volatile markets"

## 🔒 Security

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security concerns to: [security contact]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## 📚 Documentation

### Documentation Needs
- API documentation
- Component documentation
- Trading strategy guides
- Setup tutorials
- Troubleshooting guides

### Writing Good Docs
- Clear and concise
- Include code examples
- Add screenshots/diagrams
- Keep up to date
- Proofread for errors

## 🏅 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (if applicable)

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/guicebarton27-art/sentinel-ai-trader-79974/discussions)
- Check existing issues and PRs
- Review documentation

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what's best for the community
- Show empathy towards others

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Sentinel AI Trader! 🚀
