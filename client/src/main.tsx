import { AppProvider } from "./_contexts/app";
import Routes from "./routes";

export default function Main() {
    return (
        <AppProvider>
            <Routes />
        </AppProvider>
    );
}
