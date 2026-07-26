namespace Application.DTO
{
    public class RoleDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public ICollection<int> UserIds { get; set; } = new List<int>();
    }
}
