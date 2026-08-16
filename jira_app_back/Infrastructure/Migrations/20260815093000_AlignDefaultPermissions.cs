using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Data-only migration : aligne les permissions (UserPermissions) existantes sur
    /// la nouvelle spec des rôles. Le Dashboard et les statistiques globales ne sont
    /// accessibles qu'à l'Admin. Ce jeu de clés correspond à GetDefaultInterfaceKeys.
    /// </summary>
    public partial class AlignDefaultPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Retirer le Dashboard / les statistiques pour ScrumMaster, Senior et Developer.
            migrationBuilder.Sql(@"
                DELETE up
                FROM UserPermissions up
                INNER JOIN Users u ON up.UserId = u.Id
                INNER JOIN Roles r ON u.RoleId = r.Id
                WHERE r.Description IN ('ScrumMaster', 'Senior', 'Developer')
                  AND up.InterfaceKey IN ('dashboard', 'statistics');
            ");

            // 2) Ajouter les clés manquantes du jeu cible par rôle (idempotent).
            migrationBuilder.Sql(@"
                INSERT INTO UserPermissions (UserId, InterfaceKey, IsEnabled)
                SELECT u.Id, k.InterfaceKey, 1
                FROM Users u
                INNER JOIN Roles r ON u.RoleId = r.Id
                CROSS JOIN (VALUES
                    ('ScrumMaster', 'projects'), ('ScrumMaster', 'chat'), ('ScrumMaster', 'backlog'),
                    ('ScrumMaster', 'kanban'), ('ScrumMaster', 'profile'),
                    ('Senior', 'projects'), ('Senior', 'chat'), ('Senior', 'backlog'),
                    ('Senior', 'kanban'), ('Senior', 'profile'),
                    ('Developer', 'projects'), ('Developer', 'backlog'), ('Developer', 'kanban'),
                    ('Developer', 'chat'), ('Developer', 'profile')
                ) AS k(RoleName, InterfaceKey)
                WHERE r.Description = k.RoleName
                  AND NOT EXISTS (
                      SELECT 1 FROM UserPermissions up2
                      WHERE up2.UserId = u.Id AND up2.InterfaceKey = k.InterfaceKey
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restaure approximativement les clés retirées (le jeu « avant » n'est pas stocké).
            migrationBuilder.Sql(@"
                INSERT INTO UserPermissions (UserId, InterfaceKey, IsEnabled)
                SELECT u.Id, k.InterfaceKey, 1
                FROM Users u
                INNER JOIN Roles r ON u.RoleId = r.Id
                CROSS JOIN (VALUES
                    ('ScrumMaster', 'dashboard'), ('ScrumMaster', 'statistics'),
                    ('Senior', 'dashboard'), ('Senior', 'statistics'),
                    ('Developer', 'dashboard')
                ) AS k(RoleName, InterfaceKey)
                WHERE r.Description = k.RoleName
                  AND NOT EXISTS (
                      SELECT 1 FROM UserPermissions up2
                      WHERE up2.UserId = u.Id AND up2.InterfaceKey = k.InterfaceKey
                  );
            ");
        }
    }
}
