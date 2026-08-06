using System.Collections.Generic;

namespace Domain.Entity
{
    public static class InterfaceKeys
    {
        public const string Dashboard = "dashboard";
        public const string Projects = "projects";
        public const string Statistics = "statistics";
        public const string Chat = "chat";
        public const string Backlog = "backlog";
        public const string Kanban = "kanban";
        public const string AdminUsers = "admin-users";
        public const string AdminProjects = "admin-projects";
        public const string AdminStatistics = "admin-statistics";
        public const string Profile = "profile";

        public static readonly IReadOnlyList<string> All = new[]
        {
            Dashboard,
            Projects,
            Statistics,
            Chat,
            Backlog,
            Kanban,
            AdminUsers,
            AdminProjects,
            AdminStatistics,
            Profile
        };
    }
}
