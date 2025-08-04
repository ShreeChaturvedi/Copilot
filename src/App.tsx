import { QueryProvider, ThemeProvider } from './components/providers';
import { MainLayout } from './components/layout';

function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <MainLayout />
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;
