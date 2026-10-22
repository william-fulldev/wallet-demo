import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    // React llama a este método cuando un hijo lanza un error al dibujarse.
    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("Error de renderizado:", error, info.componentStack);
    }

    render(): ReactNode {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <main className="screen">
                <section className="glass panel" role="alert">
                    <h2>Algo salió mal</h2>
                    {/* Los detalles técnicos solo en desarrollo: al usuario no le sirven. */}
                    {import.meta.env.DEV && <p className="muted">{this.state.error.message}</p>}
                    <button type="button" className="btn-primary" onClick={() => window.location.assign("/home")}>
                        Volver al inicio
                    </button>
                </section>
            </main>
        );
    }
}
