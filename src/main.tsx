import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlannerProvider } from './context/PlannerContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import '../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PlannerProvider>
        <App />
      </PlannerProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
