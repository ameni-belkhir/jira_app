namespace Application.DTO
{
    public class ProjectMemberSummaryDto
    {
        public int UserId { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string RoleInProject { get; set; } = string.Empty;
    }
}
