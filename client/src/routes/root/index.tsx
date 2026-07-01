import { Button } from "_components/ui/button";
import DashboardLayout from "_layouts/dashboard";

export default function RootRoutes() {
    return (
        <DashboardLayout
            title="Root dashboard"
            description="System-level actions and VPS administration."
            actions={
                <>
                    <Button>Primary action</Button>
                    <Button variant="outline" asChild>
                        <a href="/api/healthz">Check API</a>
                    </Button>
                </>
            }
        >
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-border p-4">
                    <h2 className="text-sm font-medium">System</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Root runtime is active.
                    </p>
                </div>
            </section>
        </DashboardLayout>
    );
}
