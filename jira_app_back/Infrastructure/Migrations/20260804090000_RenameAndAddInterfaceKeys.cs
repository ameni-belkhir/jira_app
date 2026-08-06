using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameAndAddInterfaceKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only migration: no schema change.
            // 1) Rename the "users" interface key to "admin-users" (frontend key mismatch).
            // 2) Remove the "roles" interface key, which has no frontend page (absent from NAV_ITEMS).
            migrationBuilder.Sql(@"
                UPDATE UserPermissions SET InterfaceKey = 'admin-users' WHERE InterfaceKey = 'users';
                DELETE FROM UserPermissions WHERE InterfaceKey = 'roles';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse only the rename. The "roles" rows deleted in Up() cannot be restored
            // (their previous content is unknown at this point).
            migrationBuilder.Sql(@"
                UPDATE UserPermissions SET InterfaceKey = 'users' WHERE InterfaceKey = 'admin-users';");
        }
    }
}
