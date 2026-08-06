using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectRoleAndSprintMembersAndSubTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create the new ProjectMembers table with role support
            migrationBuilder.CreateTable(
                name: "ProjectMembers",
                columns: table => new
                {
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RoleInProject = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InvitedById = table.Column<int>(type: "int", nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectMembers", x => new { x.ProjectId, x.UserId });
                    table.ForeignKey(
                        name: "FK_ProjectMembers_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 2. Copy existing data from old anonymous ProjectMember table into the new one
            //    with default RoleInProject = 'Senior' for existing rows
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ProjectMember')
                BEGIN
                    INSERT INTO [ProjectMembers] ([ProjectId], [UserId], [RoleInProject], [InvitedById], [JoinedAt])
                    SELECT [ProjectId], [UserId], 'Senior', NULL, GETUTCDATE()
                    FROM [ProjectMember]
                END");

            // 3. Drop the old anonymous join table (only after its data is preserved)
            migrationBuilder.DropTable(
                name: "ProjectMember");

            // 4. Add ParentTicketId column for sub-ticket support
            migrationBuilder.AddColumn<int>(
                name: "ParentTicketId",
                table: "Tickets",
                type: "int",
                nullable: true);

            // 5. Create SprintMembers table for developer sprint assignment
            migrationBuilder.CreateTable(
                name: "SprintMembers",
                columns: table => new
                {
                    SprintId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SprintMembers", x => new { x.SprintId, x.UserId });
                    table.ForeignKey(
                        name: "FK_SprintMembers_Sprints_SprintId",
                        column: x => x.SprintId,
                        principalTable: "Sprints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SprintMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 6. Indexes
            migrationBuilder.CreateIndex(
                name: "IX_Tickets_ParentTicketId",
                table: "Tickets",
                column: "ParentTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMembers_UserId",
                table: "ProjectMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SprintMembers_UserId",
                table: "SprintMembers",
                column: "UserId");

            // 7. Self-referencing FK for sub-tickets
            migrationBuilder.AddForeignKey(
                name: "FK_Tickets_Tickets_ParentTicketId",
                table: "Tickets",
                column: "ParentTicketId",
                principalTable: "Tickets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // 1. Remove FK
            migrationBuilder.DropForeignKey(
                name: "FK_Tickets_Tickets_ParentTicketId",
                table: "Tickets");

            // 2. Drop indexes
            migrationBuilder.DropIndex(
                name: "IX_Tickets_ParentTicketId",
                table: "Tickets");

            // 3. Recreate the old anonymous ProjectMember table
            migrationBuilder.CreateTable(
                name: "ProjectMember",
                columns: table => new
                {
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectMember", x => new { x.ProjectId, x.UserId });
                    table.ForeignKey(
                        name: "FK_ProjectMember_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectMember_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 4. Copy data back from new ProjectMembers to old ProjectMember
            //    (only ProjectId, UserId — the extra columns didn't exist before)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ProjectMembers')
                BEGIN
                    INSERT INTO [ProjectMember] ([ProjectId], [UserId])
                    SELECT [ProjectId], [UserId]
                    FROM [ProjectMembers]
                END");

            // 5. Drop the new tables and column
            migrationBuilder.DropTable(
                name: "ProjectMembers");

            migrationBuilder.DropTable(
                name: "SprintMembers");

            // 6. Remove ParentTicketId
            migrationBuilder.DropColumn(
                name: "ParentTicketId",
                table: "Tickets");

            // 7. Recreate old index
            migrationBuilder.CreateIndex(
                name: "IX_ProjectMember_UserId",
                table: "ProjectMember",
                column: "UserId");
        }
    }
}
