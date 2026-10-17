import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlannerProvider } from './context/PlannerContext';
import { App } from './App';
import '../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlannerProvider>
      <App />
    </PlannerProvider>
  </React.StrictMode>
);
