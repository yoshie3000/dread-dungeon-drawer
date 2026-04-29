# OSR Map Builder

A web-based tool for creating Old School Renaissance (OSR) style dungeon maps, featuring Dyson-style cross-hatching, dynamic object placement, and high-quality SVG export.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

## Development Setup

To run the application in development mode with Hot Module Replacement (HMR):

1. Install the dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173` (or the URL provided in your terminal).

## Production Build

To build the application for production deployment:

1. Create a production build:
```bash
npm run build
```
This will compile the TypeScript code and generate static assets in the `dist` directory.

2. Preview the production build locally:
```bash
npm run preview
```

### Deployment

The generated `dist` folder contains everything needed to run the application. You can deploy this folder to any static hosting service such as GitHub Pages, Vercel, Netlify, or an Nginx/Apache server.
