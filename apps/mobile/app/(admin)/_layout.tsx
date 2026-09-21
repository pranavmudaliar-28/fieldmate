import { RoleGuard } from '../../src/features/auth/RoleGuard';

export default function AdminLayout() {
  return <RoleGuard role="ADMIN" />;
}
