import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_PERMISSIONS, type Role } from '@/lib/permissions';

const ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'RECEPTIONIST', 'STAFF', 'VIEWER'];

export function RolesPermissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-accent" />
          Roles & Permissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Workspace permissions are enforced by the backend from the shared role map.
          Platform Super Admin is a separate flag and cannot be assigned through business team invitations.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {role}
                <Badge variant="secondary">{ROLE_PERMISSIONS[role].length} permissions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {ROLE_PERMISSIONS[role].map((permission) => (
                <Badge key={permission} variant="outline">{permission}</Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
