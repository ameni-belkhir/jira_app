namespace Application.DTO
{
    public class ProjectMemberResultDto
    {
        public int UserId { get; set; }
        public string RoleInProject { get; set; } = string.Empty;
        public bool EmailSent { get; set; }
    }
}
