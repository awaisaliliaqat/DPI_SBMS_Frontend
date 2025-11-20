import './App.css';
import AppRoutes from './routes/AppRoutes';
import { BrowserRouter } from 'react-router-dom';


function App() {
  return (
      <BrowserRouter basename="/diamond-paints">
       <AppRoutes/>
      </BrowserRouter>
  );
}

export default App;
