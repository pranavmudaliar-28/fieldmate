import { RoleGuard } from '../../src/features/auth/RoleGuard';

export default function ManagerLayout() {
  return <RoleGuard role="MANAGER" />;
}
