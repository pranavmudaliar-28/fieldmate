import { RoleGuard } from '../../src/features/auth/RoleGuard';

export default function WorkerLayout() {
  return <RoleGuard role="FIELD_WORKER" />;
}
