import SystemDashboard from "_components/system-dashboard";
import DashboardLayout from "_layouts/dashboard";
import { runtime } from "../../runtime";

export default function RootRoutes() {
    return (
        <DashboardLayout
            title="System overview"
            description={`${runtime.osName} · Tổng quan tài nguyên máy chủ theo thời gian thực.`}
        >
            <SystemDashboard />
        </DashboardLayout>
    );
}
