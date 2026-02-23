import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
// import Dashboard from './pages/Dashboard'; // temporarily disabled
import MySkills from './pages/MySkills';
import Marketplace from './pages/Marketplace';
import Settings from './pages/Settings';
import Security from './pages/Security';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/my-skills" replace />,
      },
      // Dashboard temporarily disabled — static mock data
      // {
      //   path: 'dashboard',
      //   element: <Dashboard />,
      // },
      {
        path: 'my-skills',
        element: <MySkills />,
      },
      {
        path: 'marketplace',
        element: <Marketplace />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'security',
        element: <Security />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/my-skills" replace />,
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
