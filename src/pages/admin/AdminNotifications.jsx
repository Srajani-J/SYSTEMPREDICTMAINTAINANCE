import NotificationPanel from "../../components/NotificationPanel";
import SectionCard from "../../components/dashboard/SectionCard";

function AdminNotifications() {
  return (
    <SectionCard
      title="Notifications"
      description="Alerts raised by model predictions. Acknowledge, assign or resolve them here; the panel refreshes every 15 seconds while the tab is visible."
    >
      <NotificationPanel />
    </SectionCard>
  );
}

export default AdminNotifications;
