import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Vite + React</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => setCount((count) => count + 1)}
          >
            count is {count}
          </button>
          <p className="mt-4 text-gray-600">
            Edit <code className="bg-gray-200 px-1 rounded">src/App.tsx</code>{' '}
            and save to test HMR
          </p>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          React Calendar App - Migration Foundation
        </p>
      </div>
    </div>
  );
}

export default App;
