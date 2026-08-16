namespace Application.DTO
{
    public class RoleChangeImpactDto
    {
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public string CurrentRoleInProject { get; set; } = string.Empty;
    }
}
