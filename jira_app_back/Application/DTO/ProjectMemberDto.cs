using System;

namespace Application.DTO
{
    public class ProjectMemberDto
    {
        public int UserId { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string RoleInProject { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; }
    }
}
