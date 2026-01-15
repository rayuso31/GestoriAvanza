import { Header } from '../components/Header';
import { BatchUpload } from '../components/BatchUpload';

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col text-slate-900">
            <Header />
            <main className="flex-1 w-full px-6 py-6">
                <BatchUpload />
            </main>
            <footer className="py-6 text-center text-slate-400 text-sm">
                © {new Date().getFullYear()} Avanza Portal. Todos los derechos reservados.
            </footer>
        </div>
    );
}
