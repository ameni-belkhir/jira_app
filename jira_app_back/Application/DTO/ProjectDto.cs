using System.Collections.Generic;

namespace Application.DTO
{
    public class ProjectDto
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int CreatedById { get; set; }
        public ICollection<ProjectMemberSummaryDto> Members { get; set; } = new List<ProjectMemberSummaryDto>();
        public ICollection<int> ScrumMasterIds { get; set; } = new List<int>();
        public ICollection<int> TicketIds { get; set; } = new List<int>();
        public ICollection<int> SprintIds { get; set; } = new List<int>();
    }
}
