# Multi-Tool Hub

A web-based multi-tool application built with Next.js, React, and Tailwind CSS.

## Features

- **Resume Builder** - Create and edit resumes with live preview and PDF export
- **Dictionary** - Word definitions and translations (EN/VI)
- **Currency Converter** - Convert between currencies
- **Unit Converter** - Convert between different units of measurement
- **Dark Mode Support** - Toggle between light and dark themes
- **Multi-language** - English and Vietnamese UI

## Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- npm (comes with Node.js)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

### 3. Open in Browser

Navigate to **[http://localhost:3000](http://localhost:3000)**

The app supports hot-reload, so changes to your code will automatically update in the browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server (after build) |
| `npm run lint` | Run ESLint to check code quality |
| `npm run test` | Run tests in watch mode (Vitest) |
| `npm run test:run` | Run tests once |

## Project Structure

```
multitool/
├── docs/              # Documentation files
├── public/            # Static assets
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── lib/           # Utilities, types, and contexts
│   └── tools/         # Tool implementations
├── .gitignore
├── package.json
├── vitest.config.ts   # Vitest configuration
└── README.md
```

## Tech Stack

- **Framework:** Next.js 16
- **UI:** React 19, Tailwind CSS 4
- **Icons:** Lucide React
- **Language:** TypeScript
- **Testing:** Vitest, Testing Library
- **PDF:** @react-pdf/renderer

## Troubleshooting

**Port 3000 already in use?**  
Next.js will automatically use port 3001, or you can specify a custom port:

```bash
npm run dev -- -p 3001
```

**Build errors?**  
Clear the cache and reinstall:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)
