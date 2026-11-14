import { useAuth } from "../../auth/AuthContext";
import AdminUsersPanel from "../../components/AdminUsersPanel";
import SectionCard from "../../components/dashboard/SectionCard";

function AdminUsers() {
  const { user } = useAuth();

  return (
    <SectionCard
      title="Accounts"
      description="Search, filter, promote and deactivate accounts. Role changes and deactivations revoke the affected user's sessions immediately."
    >
      <AdminUsersPanel currentUserId={user?.id} showFilters />
    </SectionCard>
  );
}

export default AdminUsers;
