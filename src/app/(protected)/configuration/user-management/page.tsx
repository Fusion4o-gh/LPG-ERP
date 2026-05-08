import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function UserManagementPage() {
  return <ComingSoonPage title="User Management" section="Configuration" legacyPath="/User" relatedLinks={[{ href: "/settings/roles", label: "Roles & Permissions" }]} />;
}
