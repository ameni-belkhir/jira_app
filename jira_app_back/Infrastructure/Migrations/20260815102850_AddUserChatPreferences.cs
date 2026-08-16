using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserChatPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserChatPreferences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BackgroundType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BackgroundKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SentBubbleColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReceivedBubbleColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserChatPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserChatPreferences_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserChatPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserChatPreferences_ConversationId",
                table: "UserChatPreferences",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "UX_UserChatPreferences_GlobalPerUser",
                table: "UserChatPreferences",
                column: "UserId",
                unique: true,
                filter: "[ConversationId] IS NULL");

            migrationBuilder.CreateIndex(
                name: "UX_UserChatPreferences_PerConversation",
                table: "UserChatPreferences",
                columns: new[] { "UserId", "ConversationId" },
                unique: true,
                filter: "[ConversationId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserChatPreferences");
        }
    }
}
