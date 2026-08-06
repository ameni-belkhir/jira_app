using System;

namespace Domain.Entity
{
    public class ProjectMember
    {
        public int ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        public string RoleInProject { get; set; } = string.Empty;
        public int? InvitedById { get; set; }
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    }
}
