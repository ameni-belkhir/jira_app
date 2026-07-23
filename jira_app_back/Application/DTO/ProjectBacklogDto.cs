using System.Collections.Generic;

namespace Application.DTO
{
    public class ProjectBacklogDto
    {
        public List<SprintDto> Sprints { get; set; } = new List<SprintDto>();
        public List<TicketDto> BacklogTickets { get; set; } = new List<TicketDto>();
    }
}
