using System.Collections.Generic;

namespace Application.DTO
{
    public class ProjectDto
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public ICollection<int> MemberIds { get; set; } = new List<int>();
        // Related entity ids present on Project
        public ICollection<int> TicketIds { get; set; } = new List<int>();
        public ICollection<int> SprintIds { get; set; } = new List<int>();
    }
}
