import { AppProvider } from "./_contexts/app";
import Routes from "./routes";
import { BrowserRouter } from "react-router-dom";

export default function Main() {
    return (
        <BrowserRouter>
            <AppProvider>
                <Routes />
            </AppProvider>
        </BrowserRouter>
    );
}
