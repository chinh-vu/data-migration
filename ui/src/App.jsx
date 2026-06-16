import { useState } from 'react';
import GenerateInstruction from './components/GenerateInstruction';
import EditInstruction from './components/EditInstruction';
import ValidateData from './components/ValidateData';
import LogViewer from './components/LogViewer';
import AuthSettings from './components/AuthSettings';

export default function App() {
  const [tab, setTab] = useState('generate');

  return (
    <div className="app">
      <header>
        <h1>NetSuite Data Migration Validator</h1>
        <nav>
          <button
            className={tab === 'generate' ? 'active' : ''}
            onClick={() => setTab('generate')}
          >
            Generate Instructions
          </button>
          <button
            className={tab === 'edit' ? 'active' : ''}
            onClick={() => setTab('edit')}
          >
            Edit Instructions
          </button>
          <button
            className={tab === 'validate' ? 'active' : ''}
            onClick={() => setTab('validate')}
          >
            Validate Data
          </button>
          <button
            className={tab === 'logs' ? 'active' : ''}
            onClick={() => setTab('logs')}
          >
            Logs
          </button>
          <button
            className={tab === 'auth' ? 'active' : ''}
            onClick={() => setTab('auth')}
          >
            Authentication
          </button>
        </nav>
      </header>
      <main>
        {tab === 'generate' && <GenerateInstruction />}
        {tab === 'edit' && <EditInstruction key={tab} />}
        {tab === 'validate' && <ValidateData key={tab} />}
        {tab === 'logs' && <LogViewer key={tab} />}
        {tab === 'auth' && <AuthSettings />}
      </main>
    </div>
  );
}
