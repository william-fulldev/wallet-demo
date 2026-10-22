import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MovementsPage from "./pages/MovementsPage";
import DepositPage from "./pages/DepositPage";
import ExchangePage from "./pages/ExchangePage";
import SendPage from "./pages/SendPage";


/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

import "@ionic/react/css/palettes/dark.always.css";
import "@ionic/react/css/palettes/dark.class.css";
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.css";
import "./theme/wallet.css";
import { AuthRedirect } from "./auth/AuthRedirect";

setupIonicReact();

// retry: false porque apiRequest ya gestiona el 401; reintentar un 4xx no arregla nada.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

const App: React.FC = () => (
  <IonApp>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <IonReactRouter>
            <AuthRedirect />
            <IonRouterOutlet>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/movements"
                element={
                  <ProtectedRoute>
                    <MovementsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deposit"
                element={
                  <ProtectedRoute>
                    <DepositPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exchange"
                element={
                  <ProtectedRoute>
                    <ExchangePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/send/:contactId?"
                element={
                  <ProtectedRoute>
                    <SendPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </IonRouterOutlet>
          </IonReactRouter>
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </IonApp>
);

export default App;
